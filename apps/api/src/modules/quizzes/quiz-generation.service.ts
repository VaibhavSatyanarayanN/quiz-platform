import {
  BadRequestException,
  ConflictException,
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
  GenerationReviewStatus,
  GenerationStatus,
} from './enums/generation-status.enum.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { GenerateQuestionsDto } from './dto/generate-questions.dto.js';
import { GenerateQuestionsFromPdfDto } from './dto/generate-questions-from-pdf.dto.js';
import { GenerateQuestionsResponseDto } from './dto/generate-questions-response.dto.js';
import { GenerationStatusResponseDto } from './dto/generation-status-response.dto.js';
import {
  ApplyGeneratedQuestionsDto,
  ApplyGeneratedQuestionsResponseDto,
  GenerationReviewResponseDto,
  ReviewOptionResponseDto,
  ReviewQuestionInputDto,
  ReviewQuestionResponseDto,
  UpdateGenerationReviewDto,
} from './dto/generation-review.dto.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { AiPdfStorageService } from './services/ai-pdf-storage.service.js';
import { Question } from './entities/question.entity.js';
import { Option } from './entities/option.entity.js';
import { QuestionType } from './enums/question-type.enum.js';
import { DifficultyLevel } from './enums/difficulty-level.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { AiQuestionGenerationJobPayload } from './interfaces/ai-job-payload.interface.js';

export interface FormattedQuestionToPersist {
  id?: string;
  text: string;
  questionType: QuestionType | string;
  marks: number;
  order?: number;
  explanation?: string | null;
  difficulty?: string | null;
  cognitiveLevel?: string | null;
  learningObjectiveId?: string | null;
  correctAnswer?: string | null;
  validationFeedback?: Record<string, any> | null;
  pedagogyFeedback?: Record<string, any> | null;
  options: Array<{
    id?: string;
    text: string;
    isCorrect: boolean;
    order?: number;
  }>;
}

export interface GenerationReviewMetadata {
  reviewStatus: GenerationReviewStatus;
  editedAt?: string | null;
  editedBy?: string | null;
  appliedAt?: string | null;
  appliedBy?: string | null;
  appliedVersionId?: string | null;
  appliedQuestionIds?: string[];
  appliedQuestionsCount?: number | null;
  applyStrategy?: 'append';
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
      _originalGeneratedQuestions: _originals,
      _reviewMetadata: _reviewMeta,
      ...safeParams
    } = params;
    return safeParams;
  }

  private resolveReviewMetadata(
    generation: QuizQuestionGeneration,
  ): GenerationReviewMetadata {
    const rawMeta = generation.promptParams?._reviewMetadata as
      | Partial<GenerationReviewMetadata>
      | undefined;

    const reviewStatus =
      rawMeta?.reviewStatus &&
      Object.values(GenerationReviewStatus).includes(rawMeta.reviewStatus)
        ? rawMeta.reviewStatus
        : GenerationReviewStatus.PENDING_REVIEW;

    return {
      reviewStatus,
      editedAt: rawMeta?.editedAt ?? null,
      editedBy: rawMeta?.editedBy ?? null,
      appliedAt: rawMeta?.appliedAt ?? null,
      appliedBy: rawMeta?.appliedBy ?? null,
      appliedVersionId: rawMeta?.appliedVersionId ?? null,
      appliedQuestionIds: Array.isArray(rawMeta?.appliedQuestionIds)
        ? rawMeta.appliedQuestionIds
        : [],
      appliedQuestionsCount:
        typeof rawMeta?.appliedQuestionsCount === 'number'
          ? rawMeta.appliedQuestionsCount
          : null,
      applyStrategy: 'append',
    };
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
    const reviewMeta = this.resolveReviewMetadata(generation);

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
      reviewStatus: reviewMeta.reviewStatus,
      isApplied: reviewMeta.reviewStatus === GenerationReviewStatus.APPLIED,
      appliedAt: reviewMeta.appliedAt ?? null,
      appliedQuestionsCount: reviewMeta.appliedQuestionsCount ?? null,
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
   * Retrieves a generation and its generated/edited questions for creator review.
   */
  async getGenerationForReview(
    quizId: string,
    generationId: string,
    user: AuthenticatedUser,
  ): Promise<GenerationReviewResponseDto> {
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

    const version = await this.quizVersionRepository.findOne({
      where: {
        id: generation.targetVersionId,
        quizId,
      },
    });

    let existingQuestionCount = 0;
    if (version && typeof this.dataSource?.manager?.count === 'function') {
      try {
        existingQuestionCount = await this.dataSource.manager.count(Question, {
          where: { quizVersionId: version.id },
        });
      } catch {
        existingQuestionCount = 0;
      }
    }

    return this.toGenerationReviewResponseDto(
      generation,
      version?.status ?? null,
      existingQuestionCount,
    );
  }

  /**
   * Deep-clones question arrays/objects so in-memory edits can never mutate
   * the immutable `_originalGeneratedQuestions` snapshot.
   */
  private deepCloneQuestions<T>(questions: T): T {
    if (questions === undefined || questions === null) {
      return ([] as unknown) as T;
    }
    return JSON.parse(JSON.stringify(questions)) as T;
  }

  /**
   * Saves creator edits, reordering, or question removals to the generation review draft
   * while preserving the original AI-generated questions snapshot.
   */
  async saveReviewDraft(
    quizId: string,
    generationId: string,
    dto: UpdateGenerationReviewDto,
    user: AuthenticatedUser,
  ): Promise<GenerationReviewResponseDto> {
    await this.verifyQuizAccess(quizId, user);

    if (!dto || !Array.isArray(dto.questions)) {
      throw new BadRequestException('A questions array is required.');
    }

    const { updatedGeneration, versionStatus, existingQuestionCount } =
      await this.dataSource.transaction(async (manager) => {
        // 1. Lock generation record first (consistent lock order: Generation -> QuizVersion)
        const generation = await manager.findOne(QuizQuestionGeneration, {
          where: { id: generationId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!generation) {
          throw new NotFoundException('Generation record not found for this quiz');
        }

        if (generation.quizId !== quizId) {
          throw new BadRequestException('Generation does not belong to the requested quiz');
        }

        // 2. Recheck generation and review status after acquiring lock
        if (generation.status !== GenerationStatus.COMPLETED) {
          throw new BadRequestException(
            `Cannot edit review draft because generation status is ${generation.status}. Only COMPLETED generations can be reviewed.`,
          );
        }

        const reviewMeta = this.resolveReviewMetadata(generation);
        if (reviewMeta.reviewStatus === GenerationReviewStatus.APPLIED) {
          throw new ConflictException(
            'Cannot edit review draft because this generation has already been applied to the draft quiz version.',
          );
        }

        // 3. Lock and verify target QuizVersion is still DRAFT
        const version = await manager.findOne(QuizVersion, {
          where: { id: generation.targetVersionId, quizId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!version) {
          throw new NotFoundException('Target quiz version not found for this quiz');
        }

        if (version.quizId && version.quizId !== quizId) {
          throw new BadRequestException('Target quiz version does not belong to this quiz');
        }

        if (version.status !== QuizVersionStatus.DRAFT) {
          throw new BadRequestException(
            `Cannot edit review draft because target quiz version is ${version.status}. Only DRAFT versions can be modified.`,
          );
        }

        // 4. Snapshot original generated questions BEFORE normalizing or mutating
        const originalSnapshot = this.deepCloneQuestions(
          generation.promptParams?._originalGeneratedQuestions ??
            generation.generatedQuestions ??
            [],
        );

        const normalizedQuestions = this.validateAndNormalizeReviewQuestions(
          dto.questions,
          generation.generatedQuestions ?? [],
          true,
        );

        const now = new Date();
        const nextReviewMeta: GenerationReviewMetadata = {
          ...reviewMeta,
          reviewStatus: GenerationReviewStatus.REVIEWED,
          editedAt: now.toISOString(),
          editedBy: user.userId,
        };

        generation.generatedQuestions = this.deepCloneQuestions(normalizedQuestions) as any;
        generation.promptParams = {
          ...(generation.promptParams ?? {}),
          _originalGeneratedQuestions: originalSnapshot,
          _reviewMetadata: nextReviewMeta,
        };
        generation.updatedAt = now;

        const saved = await manager.save(QuizQuestionGeneration, generation);
        let currentQuestionCount = 0;
        if (typeof manager.count === 'function') {
          try {
            currentQuestionCount = await manager.count(Question, {
              where: { quizVersionId: version.id },
            });
          } catch {
            currentQuestionCount = 0;
          }
        }

        return {
          updatedGeneration: saved,
          versionStatus: version.status,
          existingQuestionCount: currentQuestionCount,
        };
      });

    return this.toGenerationReviewResponseDto(
      updatedGeneration,
      versionStatus,
      existingQuestionCount,
    );
  }

  /**
   * Resets the review draft back to the original AI-generated question set.
   */
  async resetReviewDraftToOriginal(
    quizId: string,
    generationId: string,
    user: AuthenticatedUser,
  ): Promise<GenerationReviewResponseDto> {
    await this.verifyQuizAccess(quizId, user);

    const { updatedGeneration, versionStatus, existingQuestionCount } =
      await this.dataSource.transaction(async (manager) => {
        // 1. Lock generation record first (consistent lock order: Generation -> QuizVersion)
        const generation = await manager.findOne(QuizQuestionGeneration, {
          where: { id: generationId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!generation) {
          throw new NotFoundException('Generation record not found for this quiz');
        }

        if (generation.quizId !== quizId) {
          throw new BadRequestException('Generation does not belong to the requested quiz');
        }

        // 2. Recheck generation and review status after acquiring lock
        if (generation.status !== GenerationStatus.COMPLETED) {
          throw new BadRequestException(
            `Cannot reset review draft when generation status is ${generation.status}.`,
          );
        }

        const reviewMeta = this.resolveReviewMetadata(generation);
        if (reviewMeta.reviewStatus === GenerationReviewStatus.APPLIED) {
          throw new ConflictException(
            'Cannot reset review draft because this generation has already been applied.',
          );
        }

        // 3. Lock and verify target QuizVersion is still DRAFT
        const version = await manager.findOne(QuizVersion, {
          where: { id: generation.targetVersionId, quizId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!version) {
          throw new NotFoundException('Target quiz version not found for this quiz');
        }

        if (version.quizId && version.quizId !== quizId) {
          throw new BadRequestException('Target quiz version does not belong to this quiz');
        }

        if (version.status !== QuizVersionStatus.DRAFT) {
          throw new BadRequestException(
            `Cannot reset review draft because target quiz version is ${version.status}. Only DRAFT versions can be modified.`,
          );
        }

        const originals = this.deepCloneQuestions(
          generation.promptParams?._originalGeneratedQuestions ??
            generation.generatedQuestions ??
            [],
        );

        const now = new Date();
        generation.generatedQuestions = this.deepCloneQuestions(
          this.normalizeStoredQuestionsForReview(originals),
        ) as any;
        generation.promptParams = {
          ...(generation.promptParams ?? {}),
          _originalGeneratedQuestions: this.deepCloneQuestions(originals),
          _reviewMetadata: {
            ...reviewMeta,
            reviewStatus: GenerationReviewStatus.PENDING_REVIEW,
            editedAt: null,
            editedBy: null,
          },
        };
        generation.updatedAt = now;

        const saved = await manager.save(QuizQuestionGeneration, generation);
        let currentQuestionCount = 0;
        if (typeof manager.count === 'function') {
          try {
            currentQuestionCount = await manager.count(Question, {
              where: { quizVersionId: version.id },
            });
          } catch {
            currentQuestionCount = 0;
          }
        }

        return {
          updatedGeneration: saved,
          versionStatus: version.status,
          existingQuestionCount: currentQuestionCount,
        };
      });

    return this.toGenerationReviewResponseDto(
      updatedGeneration,
      versionStatus,
      existingQuestionCount,
    );
  }

  /**
   * Explicitly applies the approved/reviewed questions from a completed generation
   * to its target DRAFT QuizVersion inside a single PostgreSQL transaction.
   *
   * Strategy: Appends approved questions after any pre-existing questions on the draft version
   * so existing draft questions are never silently overwritten.
   */
  async applyGeneratedQuestions(
    quizId: string,
    generationId: string,
    dto: ApplyGeneratedQuestionsDto | undefined,
    user: AuthenticatedUser,
  ): Promise<ApplyGeneratedQuestionsResponseDto> {
    await this.verifyQuizAccess(quizId, user);

    return this.dataSource.transaction(async (manager) => {
      // 1. Lock generation record first (consistent lock order: Generation -> QuizVersion)
      const generation = await manager.findOne(QuizQuestionGeneration, {
        where: { id: generationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!generation) {
        throw new NotFoundException('Generation record not found for this quiz');
      }

      if (generation.quizId && generation.quizId !== quizId) {
        throw new BadRequestException('Generation does not belong to the specified quiz');
      }

      if (dto?.targetVersionId && dto.targetVersionId !== generation.targetVersionId) {
        throw new BadRequestException(
          'Target quiz version ID does not match the generation record.',
        );
      }

      // 2. Check duplicate application before doing any work
      const reviewMeta = this.resolveReviewMetadata(generation);
      if (reviewMeta.reviewStatus === GenerationReviewStatus.APPLIED) {
        throw new ConflictException(
          'These generated questions have already been applied to the draft quiz version.',
        );
      }

      // 3. Verify generation status is COMPLETED
      if (generation.status !== GenerationStatus.COMPLETED) {
        throw new BadRequestException(
          `Cannot apply questions from a generation with status ${generation.status}. Only COMPLETED generations can be applied.`,
        );
      }

      // 4. Lock and verify target QuizVersion is still DRAFT and belongs to quiz
      const version = await manager.findOne(QuizVersion, {
        where: { id: generation.targetVersionId, quizId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!version) {
        throw new NotFoundException('Target quiz version not found for this quiz');
      }

      if (version.quizId && version.quizId !== quizId) {
        throw new BadRequestException('Target quiz version does not belong to this quiz');
      }

      if (version.status !== QuizVersionStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot apply questions because target quiz version is ${version.status}. Only DRAFT versions can be modified.`,
        );
      }

      // 5. Resolve and validate the reviewed question set (requires >= 1 question to apply)
      const originalSnapshot = this.deepCloneQuestions(
        generation.promptParams?._originalGeneratedQuestions ??
          generation.generatedQuestions ??
          [],
      );

      const rawQuestionsToApply =
        dto?.questions !== undefined
          ? dto.questions
          : ((generation.generatedQuestions ?? []) as unknown as ReviewQuestionInputDto[]);

      const validatedQuestions = this.validateAndNormalizeReviewQuestions(
        rawQuestionsToApply,
        generation.generatedQuestions ?? [],
        false,
      );

      // 6. Determine starting order based on existing questions count (safe append strategy)
      const existingCount = await manager.count(Question, {
        where: { quizVersionId: version.id },
      });

      const appliedQuestionIds: string[] = [];

      // 7. Persist approved Question and Option entities in creator's exact order
      for (let i = 0; i < validatedQuestions.length; i++) {
        const qData = validatedQuestions[i];
        const normalizedOrder = existingCount + i + 1;

        const question = manager.create(Question, {
          quizVersionId: version.id,
          text: qData.text,
          questionType: qData.questionType,
          order: normalizedOrder,
          marks: qData.marks ?? 1,
        });

        const savedQuestion = await manager.save(Question, question);
        if (savedQuestion?.id) {
          appliedQuestionIds.push(savedQuestion.id);
        }

        if (Array.isArray(qData.options) && qData.options.length > 0) {
          const optionEntities = qData.options.map((opt, optIndex) =>
            manager.create(Option, {
              questionId: savedQuestion.id,
              text: opt.text,
              isCorrect: opt.isCorrect,
              order: optIndex + 1,
            }),
          );

          await manager.save(Option, optionEntities);
        }
      }

      // 8. Mark generation review state as APPLIED in the same transaction
      const now = new Date();
      const appliedAtIso = now.toISOString();

      const updatedReviewMeta: GenerationReviewMetadata = {
        ...reviewMeta,
        reviewStatus: GenerationReviewStatus.APPLIED,
        appliedAt: appliedAtIso,
        appliedBy: user.userId,
        appliedVersionId: version.id,
        appliedQuestionIds,
        appliedQuestionsCount: validatedQuestions.length,
        applyStrategy: 'append',
      };

      generation.generatedQuestions = this.deepCloneQuestions(validatedQuestions) as any;
      generation.promptParams = {
        ...(generation.promptParams ?? {}),
        _originalGeneratedQuestions: originalSnapshot.length > 0
          ? originalSnapshot
          : this.deepCloneQuestions(validatedQuestions),
        _reviewMetadata: updatedReviewMeta,
      };
      generation.updatedAt = now;

      await manager.save(QuizQuestionGeneration, generation);

      this.logger.log(
        `Applied ${validatedQuestions.length} reviewed AI questions from generation [${generationId}] to draft version [${version.id}].`,
      );

      return {
        generationId: generation.id,
        quizId: generation.quizId,
        targetVersionId: version.id,
        reviewStatus: GenerationReviewStatus.APPLIED,
        isApplied: true,
        appliedAt: appliedAtIso,
        appliedQuestionsCount: validatedQuestions.length,
        appliedQuestionIds,
        applyStrategy: 'append',
        questions: validatedQuestions,
      };
    });
  }

  /**
   * Validates every submitted review question according to its questionType,
   * option integrity, correct-answer consistency, and domain constraints.
   */
  public validateAndNormalizeReviewQuestions(
    rawQuestions: ReviewQuestionInputDto[],
    existingQuestions: Record<string, any>[] = [],
    allowEmptyList = false,
  ): ReviewQuestionResponseDto[] {
    if (!Array.isArray(rawQuestions)) {
      throw new BadRequestException('Questions must be provided as an array.');
    }

    if (!allowEmptyList && rawQuestions.length === 0) {
      throw new BadRequestException(
        'At least one question is required to apply to the draft quiz version.',
      );
    }

    if (rawQuestions.length > 100) {
      throw new BadRequestException('Cannot exceed 100 questions in a single generation review.');
    }

    const existingMap = new Map<string, Record<string, any>>();
    for (const eq of existingQuestions) {
      if (eq && typeof eq.id === 'string') {
        existingMap.set(eq.id, eq);
      }
    }

    const normalizedList: ReviewQuestionResponseDto[] = [];
    const seenQuestionIds = new Set<string>();

    for (let idx = 0; idx < rawQuestions.length; idx++) {
      const q = rawQuestions[idx];
      if (!q || typeof q !== 'object') {
        throw new BadRequestException(`Question at position ${idx + 1} is malformed.`);
      }

      const text = typeof q.text === 'string' ? q.text.trim() : '';
      if (text.length < 3 || text.length > 5000) {
        throw new BadRequestException(
          `Question ${idx + 1} text must be between 3 and 5000 characters.`,
        );
      }

      const rawType = typeof q.questionType === 'string' ? q.questionType.trim().toLowerCase() : '';
      let canonicalType: QuestionType;
      if (rawType === QuestionType.SINGLE_CHOICE || rawType === 'mcq') {
        canonicalType = QuestionType.SINGLE_CHOICE;
      } else if (rawType === QuestionType.MULTIPLE_CHOICE) {
        canonicalType = QuestionType.MULTIPLE_CHOICE;
      } else if (rawType === QuestionType.TRUE_FALSE) {
        canonicalType = QuestionType.TRUE_FALSE;
      } else if (rawType === 'open_ended') {
        throw new BadRequestException(
          `Question ${idx + 1} has unsupported questionType "open_ended". Quiz versions only support single_choice, multiple_choice, and true_false questions with selectable options.`,
        );
      } else {
        throw new BadRequestException(
          `Question ${idx + 1} has unsupported questionType "${q.questionType}". Allowed: single_choice, multiple_choice, true_false.`,
        );
      }

      const marks = q.marks !== undefined && q.marks !== null ? Number(q.marks) : 1;
      if (!Number.isInteger(marks) || marks < 1 || marks > 100) {
        throw new BadRequestException(
          `Question ${idx + 1} marks must be an integer between 1 and 100.`,
        );
      }

      const difficulty =
        q.difficulty !== undefined && q.difficulty !== null && String(q.difficulty).trim() !== ''
          ? String(q.difficulty).trim().toLowerCase()
          : null;
      if (
        difficulty !== null &&
        difficulty !== DifficultyLevel.EASY &&
        difficulty !== DifficultyLevel.MEDIUM &&
        difficulty !== DifficultyLevel.HARD
      ) {
        throw new BadRequestException(
          `Question ${idx + 1} has unsupported difficulty "${q.difficulty}". Allowed: easy, medium, hard.`,
        );
      }

      const explanation =
        typeof q.explanation === 'string' && q.explanation.trim().length > 0
          ? q.explanation.trim().slice(0, 3000)
          : null;

      let questionId =
        typeof q.id === 'string' && q.id.trim().length > 0
          ? q.id.trim()
          : `gen_q_${idx + 1}`;
      if (seenQuestionIds.has(questionId)) {
        questionId = `${questionId}_${idx + 1}`;
      }
      seenQuestionIds.add(questionId);

      const priorQuestion = existingMap.get(questionId);

      // Validate options and answer constraints per question type
      const normalizedOptions: ReviewOptionResponseDto[] = [];
      let resolvedCorrectAnswer: string | null = null;

      if (canonicalType === QuestionType.TRUE_FALSE) {
        const rawCorrectAns =
          typeof q.correctAnswer === 'string' && q.correctAnswer.trim() !== ''
            ? q.correctAnswer.trim().toLowerCase()
            : null;

        if (rawCorrectAns !== null && rawCorrectAns !== 'true' && rawCorrectAns !== 'false') {
          throw new BadRequestException(
            `Question ${idx + 1} (true_false) correctAnswer must be "true" or "false".`,
          );
        }

        let isTrueCorrect: boolean | null =
          rawCorrectAns !== null ? rawCorrectAns === 'true' : null;

        if (Array.isArray(q.options) && q.options.length > 0) {
          if (q.options.length !== 2) {
            throw new BadRequestException(
              `Question ${idx + 1} (true_false) must have exactly 2 options (True and False).`,
            );
          }

          const trueOpt = q.options.find(
            (o) => typeof o?.text === 'string' && o.text.trim().toLowerCase() === 'true',
          );
          const falseOpt = q.options.find(
            (o) => typeof o?.text === 'string' && o.text.trim().toLowerCase() === 'false',
          );

          if (!trueOpt || !falseOpt) {
            throw new BadRequestException(
              `Question ${idx + 1} (true_false) options must be "True" and "False".`,
            );
          }

          const correctCount = q.options.filter((o) => o.isCorrect === true).length;
          if (correctCount !== 1) {
            throw new BadRequestException(
              `Question ${idx + 1} (true_false) must have exactly 1 option marked correct.`,
            );
          }

          const optionSaysTrue = Boolean(trueOpt.isCorrect);
          if (isTrueCorrect !== null && isTrueCorrect !== optionSaysTrue) {
            throw new BadRequestException(
              `Question ${idx + 1} (true_false) has conflicting correctAnswer ("${rawCorrectAns}") and option isCorrect flags.`,
            );
          }

          isTrueCorrect = optionSaysTrue;
        }

        if (isTrueCorrect === null) {
          throw new BadRequestException(
            `Question ${idx + 1} (true_false) must specify a valid True/False correct answer.`,
          );
        }

        resolvedCorrectAnswer = isTrueCorrect ? 'true' : 'false';
        normalizedOptions.push(
          { id: 'True', text: 'True', isCorrect: isTrueCorrect, order: 1 },
          { id: 'False', text: 'False', isCorrect: !isTrueCorrect, order: 2 },
        );
      } else {
        // SINGLE_CHOICE or MULTIPLE_CHOICE
        if (!Array.isArray(q.options) || q.options.length < 2) {
          throw new BadRequestException(
            `Question ${idx + 1} (${canonicalType}) must have at least 2 options.`,
          );
        }

        if (q.options.length > 10) {
          throw new BadRequestException(
            `Question ${idx + 1} (${canonicalType}) cannot have more than 10 options.`,
          );
        }

        const seenOptionIds = new Set<string>();
        const seenOptionTexts = new Set<string>();

        for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
          const opt = q.options[optIdx];
          if (!opt || typeof opt !== 'object') {
            throw new BadRequestException(
              `Question ${idx + 1}, Option ${optIdx + 1} is malformed.`,
            );
          }

          const optText = typeof opt.text === 'string' ? opt.text.trim() : '';
          if (!optText || optText.length > 1000) {
            throw new BadRequestException(
              `Question ${idx + 1}, Option ${optIdx + 1} text must be between 1 and 1000 characters.`,
            );
          }

          const lowerText = optText.toLowerCase();
          if (seenOptionTexts.has(lowerText)) {
            throw new BadRequestException(
              `Question ${idx + 1} contains duplicate option text "${optText}".`,
            );
          }
          seenOptionTexts.add(lowerText);

          const optId =
            typeof opt.id === 'string' && opt.id.trim().length > 0
              ? opt.id.trim()
              : String.fromCharCode(65 + optIdx);

          if (seenOptionIds.has(optId)) {
            throw new BadRequestException(
              `Question ${idx + 1} contains duplicate option ID "${optId}".`,
            );
          }
          seenOptionIds.add(optId);

          normalizedOptions.push({
            id: optId,
            text: optText,
            isCorrect: Boolean(opt.isCorrect),
            order: optIdx + 1,
          });
        }

        // Reconcile explicit correctAnswer option reference if provided
        if (
          typeof q.correctAnswer === 'string' &&
          q.correctAnswer.trim().length > 0 &&
          canonicalType === QuestionType.SINGLE_CHOICE
        ) {
          const ref = q.correctAnswer.trim();
          const matchedById = normalizedOptions.find((o) => o.id === ref);
          const matchedByText = normalizedOptions.find(
            (o) => o.text.toLowerCase() === ref.toLowerCase(),
          );
          const matched = matchedById || matchedByText;

          if (!matched) {
            throw new BadRequestException(
              `Question ${idx + 1} correctAnswer "${ref}" does not match any option ID or text.`,
            );
          }

          const markedCorrect = normalizedOptions.filter((o) => o.isCorrect);
          if (markedCorrect.length === 0) {
            matched.isCorrect = true;
          } else if (
            markedCorrect.length !== 1 ||
            markedCorrect[0].id !== matched.id
          ) {
            throw new BadRequestException(
              `Question ${idx + 1} correctAnswer "${ref}" conflicts with option isCorrect flags.`,
            );
          }
        }

        const correctOptions = normalizedOptions.filter((o) => o.isCorrect);
        if (canonicalType === QuestionType.SINGLE_CHOICE) {
          if (correctOptions.length !== 1) {
            throw new BadRequestException(
              `Question ${idx + 1} (single_choice) must have exactly 1 correct option. Found: ${correctOptions.length}.`,
            );
          }
          resolvedCorrectAnswer = correctOptions[0].id;
        } else {
          if (correctOptions.length < 1) {
            throw new BadRequestException(
              `Question ${idx + 1} (multiple_choice) must have at least 1 correct option.`,
            );
          }
          resolvedCorrectAnswer = correctOptions.map((o) => o.id).join(',');
        }
      }

      normalizedList.push({
        id: questionId,
        text,
        questionType: canonicalType,
        marks,
        order: idx + 1,
        explanation,
        difficulty: difficulty ?? (priorQuestion?.difficulty || null),
        cognitiveLevel:
          q.cognitiveLevel !== undefined
            ? q.cognitiveLevel || null
            : (priorQuestion?.cognitiveLevel ?? null),
        learningObjectiveId:
          q.learningObjectiveId !== undefined
            ? q.learningObjectiveId || null
            : (priorQuestion?.learningObjectiveId ?? null),
        correctAnswer: resolvedCorrectAnswer,
        validationFeedback: priorQuestion?.validationFeedback ?? null,
        pedagogyFeedback: priorQuestion?.pedagogyFeedback ?? null,
        options: normalizedOptions,
      });
    }

    return normalizedList;
  }

  private normalizeStoredQuestionsForReview(
    rawQuestions: Record<string, any>[] | null | undefined,
  ): ReviewQuestionResponseDto[] {
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return [];
    }

    return rawQuestions.map((q, idx) => {
      const options: ReviewOptionResponseDto[] = Array.isArray(q.options)
        ? q.options.map((opt: any, optIdx: number) => ({
            id:
              typeof opt?.id === 'string' && opt.id.trim().length > 0
                ? opt.id.trim()
                : String.fromCharCode(65 + optIdx),
            text: String(opt?.text ?? `Option ${optIdx + 1}`),
            isCorrect: Boolean(opt?.isCorrect),
            order: typeof opt?.order === 'number' ? opt.order : optIdx + 1,
          }))
        : [];

      const correctOpt = options.find((o) => o.isCorrect);
      const fallbackCorrectAnswer =
        q.questionType === QuestionType.TRUE_FALSE
          ? correctOpt?.text?.toLowerCase() === 'true'
            ? 'true'
            : 'false'
          : (correctOpt?.id ?? null);

      return {
        id:
          typeof q.id === 'string' && q.id.trim().length > 0
            ? q.id.trim()
            : `gen_q_${idx + 1}`,
        text: String(q.text ?? ''),
        questionType: (q.questionType as QuestionType) || QuestionType.SINGLE_CHOICE,
        marks: typeof q.marks === 'number' && q.marks >= 1 ? q.marks : 1,
        order: idx + 1,
        explanation: q.explanation ?? null,
        difficulty: q.difficulty ?? null,
        cognitiveLevel: q.cognitiveLevel ?? null,
        learningObjectiveId: q.learningObjectiveId ?? null,
        correctAnswer: q.correctAnswer ?? fallbackCorrectAnswer,
        validationFeedback: q.validationFeedback ?? null,
        pedagogyFeedback: q.pedagogyFeedback ?? null,
        options,
      };
    });
  }

  private toGenerationReviewResponseDto(
    generation: QuizQuestionGeneration,
    targetVersionStatus: QuizVersionStatus | null,
    targetVersionExistingQuestionCount: number,
  ): GenerationReviewResponseDto {
    const stage = this.resolveLifecycleStage(generation);
    const reviewMeta = this.resolveReviewMetadata(generation);
    const questions = this.normalizeStoredQuestionsForReview(
      generation.generatedQuestions,
    );
    const isApplied = reviewMeta.reviewStatus === GenerationReviewStatus.APPLIED;

    return {
      generationId: generation.id,
      jobId: generation.jobId,
      quizId: generation.quizId,
      targetVersionId: generation.targetVersionId,
      targetVersionStatus,
      targetVersionExistingQuestionCount,
      status: generation.status,
      stage,
      stageDescription: this.getStageDescription(stage),
      reviewStatus: reviewMeta.reviewStatus,
      isReadyForReview:
        generation.status === GenerationStatus.COMPLETED && !isApplied,
      isApplied,
      hasCreatorEdits: Boolean(reviewMeta.editedAt),
      editedAt: reviewMeta.editedAt ?? null,
      appliedAt: reviewMeta.appliedAt ?? null,
      appliedQuestionsCount: reviewMeta.appliedQuestionsCount ?? null,
      appliedQuestionIds: reviewMeta.appliedQuestionIds ?? [],
      promptParams: this.sanitizePromptParams(generation.promptParams),
      questions,
      errorMessage: this.sanitizeErrorMessage(generation.errorMessage),
      tokensUsed: generation.tokensUsed ?? null,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt ?? generation.createdAt,
      completedAt: generation.completedAt ?? null,
    };
  }

  /**
   * Stores validated AI-generated questions into the QuizQuestionGeneration record
   * and marks the generation COMPLETED inside a single PostgreSQL transaction.
   *
   * Note (Phase 5): Completing an AI generation job stages the questions for creator review
   * in `generated_questions` with `reviewStatus: 'pending_review'`. It does NOT automatically
   * insert Question/Option entities into the draft QuizVersion until the creator explicitly
   * calls `applyGeneratedQuestions`.
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

      // Idempotency check: if this job was already completed, return without overwriting
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
          `Target quiz version ${targetVersionId} is no longer in DRAFT status (current: ${version.status}). Cannot stage generated questions.`,
        );
      }

      // 3. Normalize generated questions for review storage
      const stagedQuestions = this.normalizeStoredQuestionsForReview(
        formattedQuestions as Record<string, any>[],
      );

      // 4. Update generation record to COMPLETED with pending_review metadata
      const now = new Date();
      const reviewMetadata: GenerationReviewMetadata = {
        reviewStatus: GenerationReviewStatus.PENDING_REVIEW,
        editedAt: null,
        editedBy: null,
        appliedAt: null,
        appliedBy: null,
        appliedVersionId: null,
        appliedQuestionIds: [],
        appliedQuestionsCount: null,
        applyStrategy: 'append',
      };

      generation.status = GenerationStatus.COMPLETED;
      generation.promptParams = {
        ...(generation.promptParams ?? {}),
        _lifecycleStage: GenerationLifecycleStage.COMPLETED,
        _originalGeneratedQuestions: this.deepCloneQuestions(stagedQuestions),
        _reviewMetadata: reviewMetadata,
      };
      generation.generatedQuestions = this.deepCloneQuestions(stagedQuestions) as any;
      generation.tokensUsed = tokensUsed ?? null;
      generation.errorMessage = null;
      generation.updatedAt = now;
      generation.completedAt = now;

      const completedGeneration = await manager.save(QuizQuestionGeneration, generation);
      this.logger.log(
        `Staged ${stagedQuestions.length} AI-generated questions for creator review on generation [${generationId}]. Target version: ${version.id}`,
      );

      return completedGeneration;
    });
  }
}
