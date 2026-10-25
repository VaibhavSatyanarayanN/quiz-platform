import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, UnrecoverableError } from 'bullmq';

import { QuizQuestionGeneration } from '../entities/quiz-question-generation.entity.js';
import { GenerationStatus } from '../enums/generation-status.enum.js';
import { Quiz } from '../entities/quiz.entity.js';
import { QuizVersion } from '../entities/quiz-version.entity.js';
import { QuizVersionStatus } from '../enums/quiz-version-status.enum.js';
import { QuestionType } from '../enums/question-type.enum.js';
import {
  FormattedQuestionToPersist,
  QuizGenerationService,
} from '../quiz-generation.service.js';
import { AiService } from '../../../ai/ai.service.js';
import { AiPdfStorageService } from '../services/ai-pdf-storage.service.js';
import {
  GenerateFromPdfDto,
  GenerateQuizDto,
  SupportedQuestionType,
} from '../../../ai/dto/generate-quiz.dto.js';
import type { AiQuestionGenerationJobPayload } from '../interfaces/ai-job-payload.interface.js';

@Processor('ai-question-generation')
export class AiQuestionGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiQuestionGenerationProcessor.name);

  constructor(
    @InjectRepository(QuizQuestionGeneration)
    private readonly generationRepository: Repository<QuizQuestionGeneration>,

    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,

    @InjectRepository(QuizVersion)
    private readonly quizVersionRepository: Repository<QuizVersion>,

    private readonly quizGenerationService: QuizGenerationService,
    private readonly aiService: AiService,
    private readonly aiPdfStorageService: AiPdfStorageService,
  ) {
    super();
  }

  async process(job: Job<AiQuestionGenerationJobPayload>): Promise<void> {
    const { generationId, quizId, targetVersionId } = job.data;
    this.logger.log(
      `Processing AI question generation job [${job.id}] for generation [${generationId}]. Attempt: ${job.attemptsMade + 1}/${job.opts.attempts ?? 3}`,
    );

    // 1. Load generation record from PostgreSQL
    const generation = await this.generationRepository.findOne({
      where: { id: generationId },
    });

    if (!generation) {
      this.logger.warn(`Generation record [${generationId}] not found in database. Aborting job safely.`);
      return;
    }

    if (generation.status === GenerationStatus.CANCELLED) {
      this.logger.log(`Generation [${generationId}] was cancelled by creator. Aborting.`);
      return;
    }

    // Idempotency: handle duplicate delivery
    if (generation.status === GenerationStatus.COMPLETED) {
      this.logger.log(`Generation [${generationId}] is already completed. Skipping duplicate processing.`);
      return;
    }

    // 2. Validate that target quiz and version still exist and are eligible
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      await this.markPermanentFailure(
        generation,
        `Target quiz [${quizId}] no longer exists.`,
      );
      throw new UnrecoverableError(`Target quiz [${quizId}] no longer exists.`);
    }

    const version = await this.quizVersionRepository.findOne({
      where: { id: targetVersionId, quizId: quiz.id },
    });

    if (!version) {
      await this.markPermanentFailure(
        generation,
        `Target quiz version [${targetVersionId}] not found.`,
      );
      throw new UnrecoverableError(`Target quiz version [${targetVersionId}] not found.`);
    }

    if (version.status !== QuizVersionStatus.DRAFT) {
      await this.markPermanentFailure(
        generation,
        `Target quiz version [${targetVersionId}] is in status ${version.status}. Only DRAFT versions can receive AI questions.`,
      );
      throw new UnrecoverableError(
        `Target quiz version is no longer a mutable draft (status: ${version.status}).`,
      );
    }

    // 3. Transition PENDING -> PROCESSING using a safe atomic update
    await this.generationRepository.update(
      { id: generation.id, status: GenerationStatus.PENDING },
      { status: GenerationStatus.PROCESSING, updatedAt: new Date() },
    );

    const sourcePdfPath = generation.promptParams?.sourcePdfPath;

    try {
      // 4. Call AiService
      let aiResult: unknown;

      if (sourcePdfPath) {
        aiResult = await this.executePdfGeneration(generation, sourcePdfPath, job.id);
      } else {
        aiResult = await this.executeTextGeneration(generation, job.id);
      }

      // 5. Validate AI response schema
      const formattedQuestions = this.validateAndTransformAiResponse(aiResult);

      // 6. Persist questions transactionally into PostgreSQL
      const tokensUsed = (aiResult as { tokens_used?: Record<string, any> })?.tokens_used ?? null;
      await this.quizGenerationService.persistGeneratedQuestionsTransactionally(
        generation.id,
        quiz.id,
        version.id,
        formattedQuestions,
        tokensUsed,
      );

      this.logger.log(
        `AI question generation completed successfully for generation [${generationId}]. Saved ${formattedQuestions.length} questions.`,
      );
    } catch (error: unknown) {
      // Clean up source PDF on error if applicable
      if (sourcePdfPath) {
        await this.aiPdfStorageService.deletePdfFile(sourcePdfPath);
      }

      // Check if error is unrecoverable (permanent)
      if (error instanceof UnrecoverableError) {
        await this.markPermanentFailure(generation, error.message);
        throw error;
      }

      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 3);
      const sanitizedMessage = this.sanitizeErrorMessage(
        error instanceof Error ? error.message : String(error),
      );

      if (isLastAttempt) {
        // Retries exhausted -> mark as FAILED in database
        this.logger.error(
          `AI generation job [${job.id}] exhausted all retries. Marking FAILED: ${sanitizedMessage}`,
        );
        generation.status = GenerationStatus.FAILED;
        generation.errorMessage = sanitizedMessage;
        generation.completedAt = new Date();
        await this.generationRepository.save(generation);
      } else {
        // Retryable error: record note and allow BullMQ exponential backoff
        this.logger.warn(
          `AI generation job [${job.id}] encountered transient error (attempt ${job.attemptsMade + 1}): ${sanitizedMessage}. Will retry.`,
        );
        generation.errorMessage = `Transient failure on attempt ${job.attemptsMade + 1}: ${sanitizedMessage}`;
        await this.generationRepository.save(generation);
      }

      // Re-throw so BullMQ handles retry / backoff
      throw error;
    } finally {
      // Ensure source PDF is cleaned up after successful execution
      if (sourcePdfPath) {
        await this.aiPdfStorageService.deletePdfFile(sourcePdfPath);
      }
    }
  }

  private async executePdfGeneration(
    generation: QuizQuestionGeneration,
    sourcePdfPath: string,
    jobId?: string,
  ): Promise<unknown> {
    const exists = await this.aiPdfStorageService.exists(sourcePdfPath);
    if (!exists) {
      throw new UnrecoverableError(
        `Source PDF file not found at ${sourcePdfPath}. Note: Clustered workers require shared storage.`,
      );
    }

    const buffer = await this.aiPdfStorageService.readPdfFile(sourcePdfPath);
    const mockFile = {
      buffer,
      originalname: generation.promptParams.originalFilename || 'source.pdf',
      size: buffer.length,
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    const count = generation.promptParams.targetQuestionCount ?? 10;
    const options: GenerateFromPdfDto = {
      question_count: count,
      question_types: this.mapQuestionTypesToAiTypes(generation.promptParams.questionTypes),
      difficulty_distribution: this.calculateDifficultyDistribution(
        generation.promptParams.difficulty,
        count,
      ),
      language: generation.promptParams.language ?? 'English',
      target_audience: 'Learners',
      max_revision_attempts: 1,
    };

    return this.aiService.generateQuizFromPdf(
      mockFile,
      options,
      { userId: generation.creatorId } as any,
      jobId,
    );
  }

  private async executeTextGeneration(
    generation: QuizQuestionGeneration,
    jobId?: string,
  ): Promise<unknown> {
    const count = generation.promptParams.targetQuestionCount ?? 10;
    const request: GenerateQuizDto = {
      topic: generation.promptParams.topic,
      question_count: count,
      question_types: this.mapQuestionTypesToAiTypes(generation.promptParams.questionTypes),
      difficulty_distribution: this.calculateDifficultyDistribution(
        generation.promptParams.difficulty,
        count,
      ),
      language: generation.promptParams.language ?? 'English',
      target_audience: 'Learners',
      max_revision_attempts: 1,
    };

    return this.aiService.generateQuiz(
      request,
      { userId: generation.creatorId } as any,
      jobId,
    );
  }

  /**
   * Validates the raw response from FastAPI against the domain expectations,
   * checking question formats, required fields, and correct-answer rules.
   */
  private validateAndTransformAiResponse(aiResult: unknown): FormattedQuestionToPersist[] {
    if (!aiResult || typeof aiResult !== 'object') {
      throw new UnrecoverableError('AI service returned a non-object response payload.');
    }

    const res = aiResult as {
      status?: string;
      question_set?: { questions?: unknown[] };
    };

    const rawQuestions = res.question_set?.questions;

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      throw new UnrecoverableError('AI service returned an empty or invalid question_set.');
    }

    const formatted: FormattedQuestionToPersist[] = [];

    for (let index = 0; index < rawQuestions.length; index++) {
      const q = rawQuestions[index] as {
        question_id?: string;
        question_type?: string;
        question_text?: string;
        options?: Array<{ option_id?: string; text?: string }>;
        correct_answer?: string;
      };

      if (!q.question_text || typeof q.question_text !== 'string' || q.question_text.trim().length < 3) {
        throw new UnrecoverableError(
          `Question at index ${index} has an empty or invalid question_text.`,
        );
      }

      const qType = q.question_type?.toLowerCase();

      if (qType === 'true_false') {
        const rawAns = (q.correct_answer || '').toLowerCase();
        if (rawAns !== 'true' && rawAns !== 'false') {
          throw new UnrecoverableError(
            `True/false question at index ${index} has invalid correct_answer: "${q.correct_answer}"`,
          );
        }

        formatted.push({
          text: q.question_text.trim(),
          questionType: QuestionType.TRUE_FALSE,
          marks: 1,
          options: [
            { text: 'True', isCorrect: rawAns === 'true', order: 1 },
            { text: 'False', isCorrect: rawAns === 'false', order: 2 },
          ],
        });
      } else {
        // Standard choice (mcq) -> SINGLE_CHOICE
        if (!Array.isArray(q.options) || q.options.length < 2) {
          throw new UnrecoverableError(
            `MCQ question at index ${index} must have at least 2 options. Found: ${q.options?.length ?? 0}`,
          );
        }

        if (!q.correct_answer) {
          throw new UnrecoverableError(
            `MCQ question at index ${index} is missing correct_answer reference.`,
          );
        }

        const correctAnswerId = q.correct_answer;
        const matchingOption = q.options.find((opt) => opt.option_id === correctAnswerId);

        if (!matchingOption) {
          throw new UnrecoverableError(
            `MCQ question at index ${index} correct_answer "${correctAnswerId}" does not match any option ID.`,
          );
        }

        formatted.push({
          text: q.question_text.trim(),
          questionType: QuestionType.SINGLE_CHOICE,
          marks: 1,
          options: q.options.map((opt, optIdx) => ({
            text: opt.text || `Option ${optIdx + 1}`,
            isCorrect: opt.option_id === correctAnswerId,
            order: optIdx + 1,
          })),
        });
      }
    }

    return formatted;
  }

  private mapQuestionTypesToAiTypes(questionTypes?: string[]): SupportedQuestionType[] {
    if (!questionTypes || questionTypes.length === 0) {
      return [SupportedQuestionType.MCQ];
    }

    const result: SupportedQuestionType[] = [];
    for (const type of questionTypes) {
      if (type === QuestionType.TRUE_FALSE || type === 'true_false') {
        if (!result.includes(SupportedQuestionType.TRUE_FALSE)) {
          result.push(SupportedQuestionType.TRUE_FALSE);
        }
      } else {
        if (!result.includes(SupportedQuestionType.MCQ)) {
          result.push(SupportedQuestionType.MCQ);
        }
      }
    }

    return result.length > 0 ? result : [SupportedQuestionType.MCQ];
  }

  private calculateDifficultyDistribution(
    difficulty: string | undefined,
    count: number,
  ): Record<'easy' | 'medium' | 'hard', number> {
    const total = Math.max(1, count);
    const diff = (difficulty || 'medium').toLowerCase();

    if (diff === 'easy') {
      const easyCount = Math.ceil(total * 0.7);
      const mediumCount = total - easyCount;
      return { easy: easyCount, medium: mediumCount, hard: 0 };
    }

    if (diff === 'hard') {
      const hardCount = Math.ceil(total * 0.7);
      const mediumCount = total - hardCount;
      return { easy: 0, medium: mediumCount, hard: hardCount };
    }

    // Default medium
    const easyCount = Math.floor(total * 0.25);
    const hardCount = Math.floor(total * 0.25);
    const mediumCount = total - easyCount - hardCount;
    return { easy: easyCount, medium: mediumCount, hard: hardCount };
  }

  private async markPermanentFailure(
    generation: QuizQuestionGeneration,
    reason: string,
  ): Promise<void> {
    generation.status = GenerationStatus.FAILED;
    generation.errorMessage = this.sanitizeErrorMessage(reason);
    generation.completedAt = new Date();
    await this.generationRepository.save(generation);
    this.logger.error(`Generation [${generation.id}] failed permanently: ${reason}`);
  }

  private sanitizeErrorMessage(msg: string | null): string {
    if (!msg) return 'An error occurred during AI question generation.';
    return msg
      .replace(/[a-zA-Z]:\\[^ \n\r\t]+|\/[a-zA-Z0-9_\-./]+/g, '[internal path]')
      .slice(0, 500);
  }
}
