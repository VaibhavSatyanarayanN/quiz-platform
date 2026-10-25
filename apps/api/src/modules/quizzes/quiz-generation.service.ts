import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, UnrecoverableError } from 'bullmq';

import { Quiz } from './entities/quiz.entity.js';
import { QuizVersion } from './entities/quiz-version.entity.js';
import { QuizVersionStatus } from './enums/quiz-version-status.enum.js';
import { QuizQuestionGeneration } from './entities/quiz-question-generation.entity.js';
import { GenerationStatus } from './enums/generation-status.enum.js';
import { GenerateQuestionsDto } from './dto/generate-questions.dto.js';
import { GenerateQuestionsFromPdfDto } from './dto/generate-questions-from-pdf.dto.js';
import { GenerateQuestionsResponseDto } from './dto/generate-questions-response.dto.js';
import { GenerationStatusResponseDto } from './dto/generation-status-response.dto.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { AiPdfStorageService } from './services/ai-pdf-storage.service.js';
import { Question } from './entities/question.entity.js';
import { Option } from './entities/option.entity.js';
import { QuestionType } from './enums/question-type.enum.js';
import { DifficultyLevel } from './enums/difficulty-level.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { AiQuestionGenerationJobPayload } from './interfaces/ai-job-payload.interface.js';

export interface FormattedQuestionToPersist {
  text: string;
  questionType: QuestionType;
  marks: number;
  options: Array<{
    text: string;
    isCorrect: boolean;
    order?: number;
  }>;
}

@Injectable()
export class QuizGenerationService {
  private readonly logger = new Logger(QuizGenerationService.name);

  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,

    @InjectRepository(QuizVersion)
    private readonly quizVersionRepository: Repository<QuizVersion>,

    @InjectRepository(QuizQuestionGeneration)
    private readonly generationRepository: Repository<QuizQuestionGeneration>,

    private readonly organizationService: OrganizationService,
    private readonly aiPdfStorageService: AiPdfStorageService,
    private readonly dataSource: DataSource,

    @InjectQueue('ai-question-generation')
    private readonly aiQueue: Queue<AiQuestionGenerationJobPayload>,
  ) {}

  private async getCreatorOrganizationId(creatorId: string): Promise<string | null> {
    const membership = await this.organizationService.getPrimaryMembership(creatorId);
    return membership?.organizationId ?? null;
  }

  private async verifyQuizAccess(quizId: string, user: AuthenticatedUser): Promise<Quiz> {
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Direct creator always has access
    if (quiz.creatorId === user.userId) {
      return quiz;
    }

    // Organization member check if quiz belongs to an organization
    if (quiz.organizationId) {
      const userOrgId = await this.getCreatorOrganizationId(user.userId);
      if (userOrgId === quiz.organizationId) {
        return quiz;
      }
    }

    throw new ForbiddenException('You do not have permission to access this quiz');
  }

  private sanitizePromptParams(params: Record<string, any>): Record<string, any> {
    if (!params || typeof params !== 'object') return {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sourcePdfPath, ...safeParams } = params;
    return safeParams;
  }

  private sanitizeErrorMessage(msg: string | null): string | null {
    if (!msg) return null;
    // Strip local filesystem paths, IP addresses, and tracebacks
    return msg
      .replace(/[a-zA-Z]:\\[^ \n\r\t]+|\/[a-zA-Z0-9_\-./]+/g, '[internal path]')
      .slice(0, 500);
  }

  async createGeneration(
    quizId: string,
    versionId: string,
    dto: GenerateQuestionsDto,
    user: AuthenticatedUser,
  ): Promise<GenerateQuestionsResponseDto> {
    const quiz = await this.verifyQuizAccess(quizId, user);

    const version = await this.quizVersionRepository.findOne({
      where: {
        id: versionId,
        quizId: quiz.id,
      },
    });

    if (!version) {
      throw new NotFoundException('Quiz version not found for this quiz');
    }

    if (version.status !== QuizVersionStatus.DRAFT) {
      throw new BadRequestException('Questions can only be generated for draft quiz versions');
    }

    // Prevent duplicate concurrent generation jobs on the same draft version
    const activeGeneration = await this.generationRepository.findOne({
      where: {
        targetVersionId: version.id,
        status: In([GenerationStatus.PENDING, GenerationStatus.PROCESSING]),
      },
    });

    if (activeGeneration) {
      throw new BadRequestException(
        'A question generation is already in progress for this quiz version.',
      );
    }

    // Create generation record first
    const generation = this.generationRepository.create({
      organizationId: quiz.organizationId,
      creatorId: user.userId,
      quizId: quiz.id,
      targetVersionId: version.id,
      jobId: 'pending', // Temporary placeholder until created
      status: GenerationStatus.PENDING,
      promptParams: {
        topic: dto.topic,
        targetQuestionCount: dto.targetQuestionCount,
        questionTypes: dto.questionTypes,
        difficulty: dto.difficulty,
        bloomTaxonomyLevel: dto.bloomTaxonomyLevel,
        customInstructions: dto.customInstructions,
        language: dto.language ?? 'en',
      },
    });

    const savedGeneration = await this.generationRepository.save(generation);
    const deterministicJobId = `job_${savedGeneration.id}`;
    savedGeneration.jobId = deterministicJobId;
    await this.generationRepository.save(savedGeneration);

    const jobPayload: AiQuestionGenerationJobPayload = {
      generationId: savedGeneration.id,
      quizId: quiz.id,
      targetVersionId: version.id,
      creatorId: user.userId,
      organizationId: quiz.organizationId,
      promptParams: savedGeneration.promptParams as any,
    };

    try {
      await this.aiQueue.add('generate-questions', jobPayload, {
        jobId: deterministicJobId,
      });
    } catch (error) {
      // If queue submission fails, mark generation record as FAILED immediately
      savedGeneration.status = GenerationStatus.FAILED;
      savedGeneration.errorMessage = 'Failed to enqueue generation job to queue';
      savedGeneration.completedAt = new Date();
      await this.generationRepository.save(savedGeneration);

      this.logger.error(`Failed to enqueue job for generation [${savedGeneration.id}]`, error);
      throw new InternalServerErrorException(
        'Failed to enqueue question generation job. Please try again later.',
      );
    }

    const estimatedProcessingTimeSeconds = Math.max(10, dto.targetQuestionCount * 2);

    return {
      generationId: savedGeneration.id,
      jobId: deterministicJobId,
      status: savedGeneration.status,
      createdAt: savedGeneration.createdAt,
      estimatedProcessingTimeSeconds,
    };
  }

  async createGenerationFromPdf(
    quizId: string,
    versionId: string,
    file: Express.Multer.File | undefined,
    dto: GenerateQuestionsFromPdfDto,
    user: AuthenticatedUser,
  ): Promise<GenerateQuestionsResponseDto> {
    if (!file) {
      throw new BadRequestException('A PDF file is required.');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('The uploaded PDF file is empty.');
    }

    if (file.buffer.length < 5) {
      throw new BadRequestException('The uploaded file is not a valid PDF.');
    }

    // Magic bytes check
    const signature = file.buffer.subarray(0, 5).toString('ascii');
    if (signature !== '%PDF-') {
      throw new BadRequestException('The uploaded file is not a valid PDF (invalid signature).');
    }

    const quiz = await this.verifyQuizAccess(quizId, user);

    const version = await this.quizVersionRepository.findOne({
      where: {
        id: versionId,
        quizId: quiz.id,
      },
    });

    if (!version) {
      throw new NotFoundException('Quiz version not found for this quiz');
    }

    if (version.status !== QuizVersionStatus.DRAFT) {
      throw new BadRequestException('Questions can only be generated for draft quiz versions');
    }

    // Prevent duplicate concurrent generation jobs on the same draft version
    const activeGeneration = await this.generationRepository.findOne({
      where: {
        targetVersionId: version.id,
        status: In([GenerationStatus.PENDING, GenerationStatus.PROCESSING]),
      },
    });

    if (activeGeneration) {
      throw new BadRequestException(
        'A question generation is already in progress for this quiz version.',
      );
    }

    // Create record first to get unique UUID
    const generation = this.generationRepository.create({
      organizationId: quiz.organizationId,
      creatorId: user.userId,
      quizId: quiz.id,
      targetVersionId: version.id,
      jobId: 'pending',
      status: GenerationStatus.PENDING,
      promptParams: {
        topic: dto.topic || `Assessment from ${file.originalname}`,
        targetQuestionCount: dto.targetQuestionCount ?? 10,
        questionTypes: dto.questionTypes ?? [QuestionType.SINGLE_CHOICE],
        difficulty: dto.difficulty ?? DifficultyLevel.MEDIUM,
        bloomTaxonomyLevel: dto.bloomTaxonomyLevel,
        customInstructions: dto.customInstructions,
        language: dto.language ?? 'en',
        originalFilename: file.originalname,
      },
    });

    const savedGeneration = await this.generationRepository.save(generation);

    // Save PDF to durable/secure storage (outside of Redis)
    let savedPdfPath: string;
    try {
      savedPdfPath = await this.aiPdfStorageService.saveUploadedPdf(savedGeneration.id, file);
    } catch {
      savedGeneration.status = GenerationStatus.FAILED;
      savedGeneration.errorMessage = 'Failed to store uploaded source PDF file.';
      savedGeneration.completedAt = new Date();
      await this.generationRepository.save(savedGeneration);
      throw new InternalServerErrorException('Failed to process source PDF upload.');
    }

    savedGeneration.promptParams.sourcePdfPath = savedPdfPath;
    const deterministicJobId = `job_${savedGeneration.id}`;
    savedGeneration.jobId = deterministicJobId;
    await this.generationRepository.save(savedGeneration);

    const jobPayload: AiQuestionGenerationJobPayload = {
      generationId: savedGeneration.id,
      quizId: quiz.id,
      targetVersionId: version.id,
      creatorId: user.userId,
      organizationId: quiz.organizationId,
      promptParams: savedGeneration.promptParams as any,
    };

    try {
      await this.aiQueue.add('generate-questions', jobPayload, {
        jobId: deterministicJobId,
      });
    } catch (queueError) {
      // Clean up file if enqueueing fails
      await this.aiPdfStorageService.deletePdfFile(savedPdfPath);

      savedGeneration.status = GenerationStatus.FAILED;
      savedGeneration.errorMessage = 'Failed to enqueue generation job to queue';
      savedGeneration.completedAt = new Date();
      await this.generationRepository.save(savedGeneration);

      this.logger.error(`Failed to enqueue PDF job for generation [${savedGeneration.id}]`, queueError);
      throw new InternalServerErrorException(
        'Failed to enqueue question generation job. Please try again later.',
      );
    }

    const estimatedProcessingTimeSeconds = Math.max(15, (dto.targetQuestionCount ?? 10) * 3);

    return {
      generationId: savedGeneration.id,
      jobId: deterministicJobId,
      status: savedGeneration.status,
      createdAt: savedGeneration.createdAt,
      estimatedProcessingTimeSeconds,
    };
  }

  async getGenerationStatus(
    quizId: string,
    generationId: string,
    user: AuthenticatedUser,
  ): Promise<GenerationStatusResponseDto> {
    await this.verifyQuizAccess(quizId, user);

    const generation = await this.generationRepository.findOne({
      where: {
        id: generationId,
        quizId,
      },
    });

    if (!generation) {
      throw new NotFoundException('Generation record not found for this quiz');
    }

    return {
      generationId: generation.id,
      jobId: generation.jobId,
      quizId: generation.quizId,
      targetVersionId: generation.targetVersionId,
      status: generation.status,
      promptParams: this.sanitizePromptParams(generation.promptParams),
      generatedQuestions: generation.generatedQuestions,
      errorMessage: this.sanitizeErrorMessage(generation.errorMessage),
      tokensUsed: generation.tokensUsed,
      createdAt: generation.createdAt,
      completedAt: generation.completedAt,
    };
  }

  async listGenerations(
    quizId: string,
    user: AuthenticatedUser,
  ): Promise<GenerationStatusResponseDto[]> {
    await this.verifyQuizAccess(quizId, user);

    const generations = await this.generationRepository.find({
      where: { quizId },
      order: { createdAt: 'DESC' },
    });

    return generations.map((generation) => ({
      generationId: generation.id,
      jobId: generation.jobId,
      quizId: generation.quizId,
      targetVersionId: generation.targetVersionId,
      status: generation.status,
      promptParams: this.sanitizePromptParams(generation.promptParams),
      generatedQuestions: generation.generatedQuestions,
      errorMessage: this.sanitizeErrorMessage(generation.errorMessage),
      tokensUsed: generation.tokensUsed,
      createdAt: generation.createdAt,
      completedAt: generation.completedAt,
    }));
  }

  async updateGenerationState(
    generationId: string,
    status: GenerationStatus,
    payload?: {
      questions?: Record<string, any>[];
      errorMessage?: string;
      tokensUsed?: Record<string, any>;
    },
  ): Promise<QuizQuestionGeneration> {
    const generation = await this.generationRepository.findOne({
      where: { id: generationId },
    });

    if (!generation) {
      throw new NotFoundException('Generation record not found');
    }

    // Protection against late-arriving or out-of-order queue events
    if (
      generation.status === GenerationStatus.COMPLETED ||
      generation.status === GenerationStatus.CANCELLED
    ) {
      return generation;
    }

    generation.status = status;

    if (payload?.questions !== undefined) {
      generation.generatedQuestions = payload.questions;
    }

    if (payload?.errorMessage !== undefined) {
      generation.errorMessage = payload.errorMessage;
    }

    if (payload?.tokensUsed !== undefined) {
      generation.tokensUsed = payload.tokensUsed;
    }

    if (status === GenerationStatus.COMPLETED || status === GenerationStatus.FAILED || status === GenerationStatus.CANCELLED) {
      generation.completedAt = new Date();
    }

    return this.generationRepository.save(generation);
  }

  /**
   * Persists validated questions and options into PostgreSQL transactionally.
   * Ensures that:
   * 1. The target QuizVersion is still in DRAFT status.
   * 2. The generation record is marked COMPLETED in the exact same transaction.
   * 3. Database-backed idempotency is strictly preserved (duplicate deliveries return early without re-inserting).
   * 4. Sequential ordering is maintained after any pre-existing questions.
   */
  async persistGeneratedQuestionsTransactionally(
    generationId: string,
    quizId: string,
    targetVersionId: string,
    formattedQuestions: FormattedQuestionToPersist[],
    tokensUsed?: Record<string, any> | null,
  ): Promise<QuizQuestionGeneration> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Lock generation record for update to guarantee single-worker execution
      const generation = await manager.findOne(QuizQuestionGeneration, {
        where: { id: generationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!generation) {
        throw new NotFoundException(`Generation record ${generationId} not found`);
      }

      // Idempotency check: if this job was already completed, return without re-inserting
      if (generation.status === GenerationStatus.COMPLETED) {
        this.logger.warn(
          `Generation [${generationId}] is already COMPLETED. Exiting transaction idempotently.`,
        );
        return generation;
      }

      if (generation.status === GenerationStatus.CANCELLED) {
        this.logger.warn(`Generation [${generationId}] was CANCELLED. Aborting persistence.`);
        return generation;
      }

      // 2. Lock and verify QuizVersion is still mutable draft
      const version = await manager.findOne(QuizVersion, {
        where: { id: targetVersionId, quizId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!version) {
        throw new UnrecoverableError(
          `Quiz version ${targetVersionId} not found for quiz ${quizId}`,
        );
      }

      if (version.status !== QuizVersionStatus.DRAFT) {
        throw new UnrecoverableError(
          `Target quiz version ${targetVersionId} is no longer in DRAFT status (current: ${version.status}). Cannot add generated questions.`,
        );
      }

      // 3. Determine starting order based on existing questions count
      const existingCount = await manager.count(Question, {
        where: { quizVersionId: version.id },
      });

      // 4. Insert questions and their options
      for (let i = 0; i < formattedQuestions.length; i++) {
        const qData = formattedQuestions[i];
        const normalizedOrder = existingCount + i + 1;

        const question = manager.create(Question, {
          quizVersionId: version.id,
          text: qData.text,
          questionType: qData.questionType,
          order: normalizedOrder,
          marks: qData.marks ?? 1,
        });

        const savedQuestion = await manager.save(Question, question);

        const optionEntities = qData.options.map((opt, optIndex) =>
          manager.create(Option, {
            questionId: savedQuestion.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: opt.order ?? optIndex + 1,
          }),
        );

        await manager.save(Option, optionEntities);
      }

      // 5. Update generation record to COMPLETED in the same transaction
      generation.status = GenerationStatus.COMPLETED;
      generation.generatedQuestions = formattedQuestions as any;
      generation.tokensUsed = tokensUsed ?? null;
      generation.errorMessage = null;
      generation.completedAt = new Date();

      const completedGeneration = await manager.save(QuizQuestionGeneration, generation);
      this.logger.log(
        `Successfully persisted ${formattedQuestions.length} questions for generation [${generationId}]. Version: ${version.id}`,
      );

      return completedGeneration;
    });
  }
}
