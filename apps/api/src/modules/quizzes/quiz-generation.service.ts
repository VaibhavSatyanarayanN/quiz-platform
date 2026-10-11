import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { Quiz } from './entities/quiz.entity.js';
import { QuizVersion } from './entities/quiz-version.entity.js';
import { QuizVersionStatus } from './enums/quiz-version-status.enum.js';
import { QuizQuestionGeneration } from './entities/quiz-question-generation.entity.js';
import { GenerationStatus } from './enums/generation-status.enum.js';
import { GenerateQuestionsDto } from './dto/generate-questions.dto.js';
import { GenerateQuestionsResponseDto } from './dto/generate-questions-response.dto.js';
import { GenerationStatusResponseDto } from './dto/generation-status-response.dto.js';
import { OrganizationService } from '../organizations/organization.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { AiQuestionGenerationJobPayload } from './interfaces/ai-job-payload.interface.js';

@Injectable()
export class QuizGenerationService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,

    @InjectRepository(QuizVersion)
    private readonly quizVersionRepository: Repository<QuizVersion>,

    @InjectRepository(QuizQuestionGeneration)
    private readonly generationRepository: Repository<QuizQuestionGeneration>,

    private readonly organizationService: OrganizationService,
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
      promptParams: generation.promptParams,
      generatedQuestions: generation.generatedQuestions,
      errorMessage: generation.errorMessage,
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
      promptParams: generation.promptParams,
      generatedQuestions: generation.generatedQuestions,
      errorMessage: generation.errorMessage,
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
}
