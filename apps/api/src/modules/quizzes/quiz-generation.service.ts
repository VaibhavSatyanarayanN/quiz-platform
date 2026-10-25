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
import {
  GenerationLifecycleStage,
  GenerationStatus,
} from './enums/generation-status.enum.js';
import { UserRole } from '../users/enums/user-role.enum.js';
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
    if (user.role !== UserRole.CREATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to access this quiz');
    }

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
    const {
      sourcePdfPath: _sourcePdfPath,
      _lifecycleStage: _stage,
      ...safeParams
    } = params;
    return safeParams;
  }

  private sanitizeErrorMessage(msg: string | null): string | null {
    if (!msg) return null;
    // Strip stack traces, credentials/secrets, internal URLs, and local filesystem paths
    return msg
      .replace(/\r?\n\s*at\s+[\s\S]*/g, '')
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted]')
      .replace(/\bsk-[A-Za-z0-9\-_]{8,}\b/g, '[redacted-key]')
      .replace(
        /(?:api[_-]?key|x-internal-api-key|secret|password|token)\s*[:=]\s*[^\s,;'"}\]]+/gi,
        '[redacted-secret]',
      )
      .replace(/(?:postgres(?:ql)?|redis|https?):\/\/[^\s'")\]]+/gi, '[internal-url]')
      .replace(/[a-zA-Z]:\\[^ \n\r\t'":]+|\/[a-zA-Z0-9_\-./]+/g, '[internal path]')
      .trim()
      .slice(0, 500);
  }

  private resolveLifecycleStage(generation: QuizQuestionGeneration): GenerationLifecycleStage {
    switch (generation.status) {
      case GenerationStatus.PENDING:
        return GenerationLifecycleStage.QUEUED;
      case GenerationStatus.COMPLETED:
        return GenerationLifecycleStage.COMPLETED;
      case GenerationStatus.FAILED:
        return GenerationLifecycleStage.FAILED;
      case GenerationStatus.CANCELLED:
        return GenerationLifecycleStage.CANCELLED;
      case GenerationStatus.PROCESSING: {
        const rawStage = generation.promptParams?._lifecycleStage;
        const validProcessingStages: GenerationLifecycleStage[] = [
          GenerationLifecycleStage.PROCESSING,
          GenerationLifecycleStage.CALLING_AI_SERVICE,
          GenerationLifecycleStage.VALIDATING_QUESTIONS,
          GenerationLifecycleStage.SAVING_QUESTIONS,
        ];
        if (validProcessingStages.includes(rawStage)) {
          return rawStage;
        }
        return GenerationLifecycleStage.PROCESSING;
      }
      default:
        return GenerationLifecycleStage.PROCESSING;
    }
  }

  private getStageDescription(stage: GenerationLifecycleStage): string {
    switch (stage) {
      case GenerationLifecycleStage.QUEUED:
        return 'Generation request is queued and waiting for a worker.';
      case GenerationLifecycleStage.PROCESSING:
        return 'Preparing question generation request.';
      case GenerationLifecycleStage.CALLING_AI_SERVICE:
        return 'Generating questions with the AI service.';
      case GenerationLifecycleStage.VALIDATING_QUESTIONS:
        return 'Validating generated questions and answer options.';
      case GenerationLifecycleStage.SAVING_QUESTIONS:
        return 'Saving validated questions to the draft quiz version.';
      case GenerationLifecycleStage.COMPLETED:
        return 'Question generation completed successfully.';
      case GenerationLifecycleStage.FAILED:
        return 'Question generation failed.';
      case GenerationLifecycleStage.CANCELLED:
        return 'Question generation was cancelled.';
    }
  }

  private isTerminalStatus(status: GenerationStatus): boolean {
    return (
      status === GenerationStatus.COMPLETED ||
      status === GenerationStatus.FAILED ||
      status === GenerationStatus.CANCELLED
    );
  }

  private toGenerationStatusResponseDto(
    generation: QuizQuestionGeneration,
  ): GenerationStatusResponseDto {
    const stage = this.resolveLifecycleStage(generation);
    const isTerminal = this.isTerminalStatus(generation.status);

    return {
      generationId: generation.id,
      jobId: generation.jobId,
      quizId: generation.quizId,
      targetVersionId: generation.targetVersionId,
      status: generation.status,
      stage,
      stageDescription: this.getStageDescription(stage),
      isTerminal,
      canCancel: !isTerminal,
      promptParams: this.sanitizePromptParams(generation.promptParams),
      generatedQuestions: generation.generatedQuestions ?? null,
      errorMessage: this.sanitizeErrorMessage(generation.errorMessage),
      tokensUsed: generation.tokensUsed ?? null,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt ?? generation.createdAt,
      completedAt: generation.completedAt ?? null,
    };
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

    return this.toGenerationStatusResponseDto(generation);
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

    return generations.map((generation) =>
      this.toGenerationStatusResponseDto(generation),
    );
  }

  /**
   * Cancels an active (PENDING or PROCESSING) generation request.
   * - Enforces quiz ownership/organization authorization.
   * - Acquires a pessimistic write lock in a DB transaction so cancellation cannot race with persistence.
   * - Handles repeated cancellation requests idempotently (returns 200 with CANCELLED status).
   * - Rejects cancellation if the generation is already in COMPLETED or FAILED terminal status.
   * - Safely removes queued (waiting/delayed) BullMQ jobs and relies on cooperative worker cancellation for active jobs.
   */
  async cancelGeneration(
    quizId: string,
    generationId: string,
    user: AuthenticatedUser,
  ): Promise<GenerationStatusResponseDto> {
    await this.verifyQuizAccess(quizId, user);

    const { generation, wasTransitioned, previousStatus } =
      await this.dataSource.transaction(async (manager) => {
        const record = await manager.findOne(QuizQuestionGeneration, {
          where: { id: generationId, quizId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!record) {
          throw new NotFoundException('Generation record not found for this quiz');
        }

        // Idempotent handling: already CANCELLED returns cleanly without error
        if (record.status === GenerationStatus.CANCELLED) {
          return {
            generation: record,
            wasTransitioned: false,
            previousStatus: GenerationStatus.CANCELLED,
          };
        }

        // Terminal states COMPLETED and FAILED cannot be transitioned to CANCELLED
        if (
          record.status === GenerationStatus.COMPLETED ||
          record.status === GenerationStatus.FAILED
        ) {
          throw new BadRequestException(
            `Cannot cancel a generation that is already ${record.status.toLowerCase()}.`,
          );
        }

        const prevStatus = record.status;
        const now = new Date();
        record.status = GenerationStatus.CANCELLED;
        record.promptParams = {
          ...(record.promptParams ?? {}),
          _lifecycleStage: GenerationLifecycleStage.CANCELLED,
        };
        record.errorMessage = null;
        record.updatedAt = now;
        record.completedAt = now;

        const saved = await manager.save(QuizQuestionGeneration, record);
        return {
          generation: saved,
          wasTransitioned: true,
          previousStatus: prevStatus,
        };
      });

    if (wasTransitioned) {
      let removedFromQueue = false;

      if (generation.jobId && typeof this.aiQueue.getJob === 'function') {
        try {
          const job = await this.aiQueue.getJob(generation.jobId);
          if (job) {
            const jobState = await job.getState();
            if (
              jobState === 'waiting' ||
              jobState === 'delayed' ||
              jobState === 'prioritized' ||
              jobState === 'waiting-children'
            ) {
              await job.remove();
              removedFromQueue = true;
              this.logger.log(
                `Removed queued BullMQ job [${generation.jobId}] (state: ${jobState}) for cancelled generation [${generation.id}].`,
              );
            } else {
              this.logger.log(
                `BullMQ job [${generation.jobId}] is in state [${jobState}]. Relying on cooperative worker cancellation for generation [${generation.id}].`,
              );
            }
          }
        } catch (queueError) {
          this.logger.warn(
            `Unable to remove BullMQ job [${generation.jobId}] during cancellation (worker will abort cooperatively): ${
              queueError instanceof Error ? queueError.message : String(queueError)
            }`,
          );
        }
      }

      const sourcePdfPath = generation.promptParams?.sourcePdfPath;
      if (
        sourcePdfPath &&
        (removedFromQueue || previousStatus === GenerationStatus.PENDING)
      ) {
        await this.aiPdfStorageService.deletePdfFile(sourcePdfPath);
      }
    }

    return this.toGenerationStatusResponseDto(generation);
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

    // Protection against late-arriving or out-of-order queue events overwriting terminal states
    if (this.isTerminalStatus(generation.status)) {
      return generation;
    }

    generation.status = status;

    if (payload?.questions !== undefined) {
      generation.generatedQuestions = payload.questions;
    }

    if (payload?.errorMessage !== undefined) {
      generation.errorMessage = this.sanitizeErrorMessage(payload.errorMessage);
    }

    if (payload?.tokensUsed !== undefined) {
      generation.tokensUsed = payload.tokensUsed;
    }

    if (this.isTerminalStatus(status)) {
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

      if (generation.status === GenerationStatus.FAILED) {
        this.logger.warn(`Generation [${generationId}] is already FAILED. Aborting persistence.`);
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
      const now = new Date();
      generation.status = GenerationStatus.COMPLETED;
      generation.promptParams = {
        ...(generation.promptParams ?? {}),
        _lifecycleStage: GenerationLifecycleStage.COMPLETED,
      };
      generation.generatedQuestions = formattedQuestions as any;
      generation.tokensUsed = tokensUsed ?? null;
      generation.errorMessage = null;
      generation.updatedAt = now;
      generation.completedAt = now;

      const completedGeneration = await manager.save(QuizQuestionGeneration, generation);
      this.logger.log(
        `Successfully persisted ${formattedQuestions.length} questions for generation [${generationId}]. Version: ${version.id}`,
      );

      return completedGeneration;
    });
  }
}
