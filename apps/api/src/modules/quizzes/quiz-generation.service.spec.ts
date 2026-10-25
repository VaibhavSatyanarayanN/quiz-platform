import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Queue, UnrecoverableError } from 'bullmq';

import { QuizGenerationService } from './quiz-generation.service.js';
import { Quiz } from './entities/quiz.entity.js';
import { QuizVersion } from './entities/quiz-version.entity.js';
import { QuizVersionStatus } from './enums/quiz-version-status.enum.js';
import { QuizQuestionGeneration } from './entities/quiz-question-generation.entity.js';
import {
  GenerationLifecycleStage,
  GenerationStatus,
} from './enums/generation-status.enum.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { AiPdfStorageService } from './services/ai-pdf-storage.service.js';
import { QuestionType } from './enums/question-type.enum.js';
import { DifficultyLevel } from './enums/difficulty-level.enum.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

describe('QuizGenerationService', () => {
  let service: QuizGenerationService;

  let mockQuizRepo: Partial<Repository<Quiz>>;
  let mockQuizVersionRepo: Partial<Repository<QuizVersion>>;
  let mockGenerationRepo: Partial<Repository<QuizQuestionGeneration>>;
  let mockOrgService: Partial<OrganizationService>;
  let mockPdfStorage: Partial<AiPdfStorageService>;
  let mockAiQueue: Partial<Queue>;
  let mockDataSource: Partial<DataSource>;

  const mockUser: AuthenticatedUser = {
    userId: 'creator-1',
    email: 'creator@example.com',
    role: UserRole.CREATOR,
  };

  const sampleQuiz = {
    id: 'quiz-1',
    creatorId: 'creator-1',
    organizationId: null,
  } as Quiz;

  const sampleDraftVersion = {
    id: 'ver-1',
    quizId: 'quiz-1',
    status: QuizVersionStatus.DRAFT,
  } as QuizVersion;

  beforeEach(() => {
    mockQuizRepo = {
      findOne: vi.fn().mockResolvedValue(sampleQuiz),
    };

    mockQuizVersionRepo = {
      findOne: vi.fn().mockResolvedValue(sampleDraftVersion),
    };

    mockGenerationRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((entity) => ({ ...entity, id: 'gen-uuid-123' }) as any),
      save: vi.fn(async (entity) => ({ ...entity, id: entity.id || 'gen-uuid-123' }) as any),
      update: vi.fn().mockResolvedValue({ affected: 1 } as any),
    };

    mockOrgService = {
      getPrimaryMembership: vi.fn().mockResolvedValue(null),
    };

    mockPdfStorage = {
      saveUploadedPdf: vi.fn().mockResolvedValue('/storage/gen-uuid-123.pdf'),
      deletePdfFile: vi.fn().mockResolvedValue(undefined),
    };

    mockAiQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job_gen-uuid-123' } as any),
    };

    mockDataSource = {
      transaction: vi.fn(async (callback) => {
        const mockManager = {
          findOne: vi.fn(),
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn((_entity, val) => ({ ...val, id: 'saved-id' })),
          save: vi.fn(async (_entity, val) => val),
        };
        return callback(mockManager as any);
      }),
    };

    service = new QuizGenerationService(
      mockQuizRepo as Repository<Quiz>,
      mockQuizVersionRepo as Repository<QuizVersion>,
      mockGenerationRepo as Repository<QuizQuestionGeneration>,
      mockOrgService as OrganizationService,
      mockPdfStorage as AiPdfStorageService,
      mockDataSource as DataSource,
      mockAiQueue as Queue,
    );
  });

  describe('createGeneration (Producer)', () => {
    it('should successfully create a generation record and enqueue a job', async () => {
      const dto = {
        topic: 'Python Asyncio',
        targetQuestionCount: 5,
        questionTypes: [QuestionType.SINGLE_CHOICE],
        difficulty: DifficultyLevel.MEDIUM,
      };

      const result = await service.createGeneration('quiz-1', 'ver-1', dto, mockUser);

      expect(result.generationId).toBe('gen-uuid-123');
      expect(result.jobId).toBe('job_gen-uuid-123');
      expect(result.status).toBe(GenerationStatus.PENDING);

      expect(mockGenerationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorId: 'creator-1',
          quizId: 'quiz-1',
          targetVersionId: 'ver-1',
          status: GenerationStatus.PENDING,
        }),
      );

      expect(mockAiQueue.add).toHaveBeenCalledWith(
        'generate-questions',
        expect.objectContaining({
          generationId: 'gen-uuid-123',
          quizId: 'quiz-1',
          targetVersionId: 'ver-1',
          creatorId: 'creator-1',
        }),
        { jobId: 'job_gen-uuid-123' },
      );
    });

    it('should prevent duplicate active generation on the same draft version', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValueOnce({
        id: 'existing-gen',
        status: GenerationStatus.PROCESSING,
      } as QuizQuestionGeneration);

      const dto = {
        topic: 'Python Asyncio',
        targetQuestionCount: 5,
        questionTypes: [QuestionType.SINGLE_CHOICE],
        difficulty: DifficultyLevel.MEDIUM,
      };

      await expect(
        service.createGeneration('quiz-1', 'ver-1', dto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark generation FAILED and throw 500 if queue enqueue fails', async () => {
      mockAiQueue.add = vi.fn().mockRejectedValueOnce(new Error('Redis connection failed'));

      const dto = {
        topic: 'Python Asyncio',
        targetQuestionCount: 5,
        questionTypes: [QuestionType.SINGLE_CHOICE],
        difficulty: DifficultyLevel.MEDIUM,
      };

      await expect(
        service.createGeneration('quiz-1', 'ver-1', dto, mockUser),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockGenerationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GenerationStatus.FAILED,
          errorMessage: 'Failed to enqueue generation job to queue',
        }),
      );
    });

    it('should reject generation when quiz version is not DRAFT', async () => {
      mockQuizVersionRepo.findOne = vi.fn().mockResolvedValueOnce({
        id: 'ver-1',
        quizId: 'quiz-1',
        status: QuizVersionStatus.PUBLISHED,
      });

      const dto = {
        topic: 'Python',
        targetQuestionCount: 5,
        questionTypes: [QuestionType.SINGLE_CHOICE],
        difficulty: DifficultyLevel.MEDIUM,
      };

      await expect(
        service.createGeneration('quiz-1', 'ver-1', dto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject generation when user is not authorized for quiz', async () => {
      mockQuizRepo.findOne = vi.fn().mockResolvedValueOnce({
        id: 'quiz-1',
        creatorId: 'other-user',
        organizationId: null,
      });

      const dto = {
        topic: 'Python',
        targetQuestionCount: 5,
        questionTypes: [QuestionType.SINGLE_CHOICE],
        difficulty: DifficultyLevel.MEDIUM,
      };

      await expect(
        service.createGeneration('quiz-1', 'ver-1', dto, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createGenerationFromPdf', () => {
    it('should reject upload when file is missing', async () => {
      await expect(
        service.createGenerationFromPdf('quiz-1', 'ver-1', undefined, {}, mockUser),
      ).rejects.toThrow('A PDF file is required.');
    });

    it('should reject upload when magic bytes are invalid', async () => {
      const invalidFile = {
        buffer: Buffer.from('NOTPDF_DATA_HERE'),
        originalname: 'test.pdf',
        size: 16,
      } as Express.Multer.File;

      await expect(
        service.createGenerationFromPdf('quiz-1', 'ver-1', invalidFile, {}, mockUser),
      ).rejects.toThrow(/invalid signature/);
    });

    it('should save PDF to disk and enqueue job without passing PDF buffer to Redis', async () => {
      const validFile = {
        buffer: Buffer.from('%PDF-1.4 test content'),
        originalname: 'study-guide.pdf',
        size: 21,
      } as Express.Multer.File;

      const result = await service.createGenerationFromPdf(
        'quiz-1',
        'ver-1',
        validFile,
        { targetQuestionCount: 10 },
        mockUser,
      );

      expect(result.generationId).toBe('gen-uuid-123');
      expect(mockPdfStorage.saveUploadedPdf).toHaveBeenCalledWith(
        'gen-uuid-123',
        validFile,
      );

      // Verify Redis payload contains filePath and NOT buffer
      expect(mockAiQueue.add).toHaveBeenCalledWith(
        'generate-questions',
        expect.objectContaining({
          promptParams: expect.objectContaining({
            sourcePdfPath: '/storage/gen-uuid-123.pdf',
            originalFilename: 'study-guide.pdf',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('getGenerationStatus', () => {
    it('should return generation status and sanitize internal file paths', async () => {
      const createdAt = new Date('2026-10-25T10:00:00.000Z');
      const updatedAt = new Date('2026-10-25T10:01:00.000Z');
      const completedAt = new Date('2026-10-25T10:01:00.000Z');

      mockGenerationRepo.findOne = vi.fn().mockResolvedValueOnce({
        id: 'gen-uuid-123',
        jobId: 'job_gen-uuid-123',
        quizId: 'quiz-1',
        targetVersionId: 'ver-1',
        status: GenerationStatus.COMPLETED,
        promptParams: {
          topic: 'Calculus',
          targetQuestionCount: 5,
          sourcePdfPath: 'C:\\Users\\admin\\secret\\path.pdf',
          _lifecycleStage: GenerationLifecycleStage.COMPLETED,
        },
        generatedQuestions: [{ text: 'Question 1' }],
        errorMessage: 'Error at /usr/local/app/src/file.ts: failed',
        tokensUsed: { total_tokens: 150 },
        createdAt,
        updatedAt,
        completedAt,
      } as QuizQuestionGeneration);

      const status = await service.getGenerationStatus('quiz-1', 'gen-uuid-123', mockUser);

      expect(status.generationId).toBe('gen-uuid-123');
      expect(status.quizId).toBe('quiz-1');
      expect(status.targetVersionId).toBe('ver-1');
      expect(status.status).toBe(GenerationStatus.COMPLETED);
      expect(status.stage).toBe(GenerationLifecycleStage.COMPLETED);
      expect(status.isTerminal).toBe(true);
      expect(status.canCancel).toBe(false);
      expect(status.createdAt).toEqual(createdAt);
      expect(status.updatedAt).toEqual(updatedAt);
      expect(status.completedAt).toEqual(completedAt);
      expect(status.promptParams.topic).toBe('Calculus');
      // Internal fields should be stripped
      expect(status.promptParams.sourcePdfPath).toBeUndefined();
      expect(status.promptParams._lifecycleStage).toBeUndefined();
      // Internal error path should be sanitized
      expect(status.errorMessage).toContain('[internal path]');
      expect(status.errorMessage).not.toContain('/usr/local/app');
    });

    it('should sanitize secrets, API keys, URLs, and stack traces from errorMessage', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValueOnce({
        id: 'gen-uuid-err',
        jobId: 'job_gen-uuid-err',
        quizId: 'quiz-1',
        targetVersionId: 'ver-1',
        status: GenerationStatus.FAILED,
        promptParams: { topic: 'Security' },
        generatedQuestions: null,
        errorMessage:
          'Upstream call to http://127.0.0.1:8000/generate failed with key sk-proj-1234567890abcdef and api_key=my_secret_123\n    at AiService.generateQuiz (D:\\Self\\quiz-platform\\apps\\api\\src\\ai\\ai.service.ts:45:11)',
        tokensUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      } as QuizQuestionGeneration);

      const status = await service.getGenerationStatus('quiz-1', 'gen-uuid-err', mockUser);

      expect(status.status).toBe(GenerationStatus.FAILED);
      expect(status.stage).toBe(GenerationLifecycleStage.FAILED);
      expect(status.isTerminal).toBe(true);
      expect(status.canCancel).toBe(false);
      expect(status.errorMessage).not.toContain('http://127.0.0.1:8000');
      expect(status.errorMessage).not.toContain('sk-proj-1234567890abcdef');
      expect(status.errorMessage).not.toContain('my_secret_123');
      expect(status.errorMessage).not.toContain('at AiService.generateQuiz');
      expect(status.errorMessage).toContain('[internal-url]');
      expect(status.errorMessage).toContain('[redacted-key]');
      expect(status.errorMessage).toContain('[redacted-secret]');
    });

    it('should expose granular processing stage when status is PROCESSING', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValueOnce({
        id: 'gen-proc',
        jobId: 'job_gen-proc',
        quizId: 'quiz-1',
        targetVersionId: 'ver-1',
        status: GenerationStatus.PROCESSING,
        promptParams: {
          topic: 'Physics',
          _lifecycleStage: GenerationLifecycleStage.CALLING_AI_SERVICE,
        },
        generatedQuestions: null,
        errorMessage: null,
        tokensUsed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      } as unknown as QuizQuestionGeneration);

      const status = await service.getGenerationStatus('quiz-1', 'gen-proc', mockUser);

      expect(status.status).toBe(GenerationStatus.PROCESSING);
      expect(status.stage).toBe(GenerationLifecycleStage.CALLING_AI_SERVICE);
      expect(status.isTerminal).toBe(false);
      expect(status.canCancel).toBe(true);
    });

    it('should throw NotFoundException if generation does not belong to quiz', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValueOnce(null);

      await expect(
        service.getGenerationStatus('quiz-1', 'unknown-id', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own quiz and is not in org', async () => {
      mockQuizRepo.findOne = vi.fn().mockResolvedValueOnce({
        id: 'quiz-1',
        creatorId: 'another-creator',
        organizationId: null,
      } as Quiz);

      await expect(
        service.getGenerationStatus('quiz-1', 'gen-uuid-123', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user has student USER role', async () => {
      const studentUser: AuthenticatedUser = {
        userId: 'creator-1',
        email: 'student@example.com',
        role: UserRole.USER,
      };

      await expect(
        service.getGenerationStatus('quiz-1', 'gen-uuid-123', studentUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancelGeneration', () => {
    it('should cancel a PENDING generation, remove waiting BullMQ job, and clean up PDF', async () => {
      const pendingRecord = {
        id: 'gen-pending-1',
        jobId: 'job_gen-pending-1',
        quizId: 'quiz-1',
        targetVersionId: 'ver-1',
        status: GenerationStatus.PENDING,
        promptParams: {
          topic: 'Biology',
          sourcePdfPath: '/storage/gen-pending-1.pdf',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      } as unknown as QuizQuestionGeneration;

      const mockRemove = vi.fn().mockResolvedValue(undefined);
      mockAiQueue.getJob = vi.fn().mockResolvedValue({
        id: 'job_gen-pending-1',
        getState: vi.fn().mockResolvedValue('waiting'),
        remove: mockRemove,
      } as any);

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce(pendingRecord),
          save: vi.fn(async (_entity, val) => val),
        };
        return cb(manager as any);
      });

      const res = await service.cancelGeneration('quiz-1', 'gen-pending-1', mockUser);

      expect(res.status).toBe(GenerationStatus.CANCELLED);
      expect(res.stage).toBe(GenerationLifecycleStage.CANCELLED);
      expect(res.isTerminal).toBe(true);
      expect(res.canCancel).toBe(false);
      expect(res.completedAt).toBeInstanceOf(Date);
      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(mockPdfStorage.deletePdfFile).toHaveBeenCalledWith('/storage/gen-pending-1.pdf');
    });

    it('should cancel a PROCESSING generation and rely on cooperative cancellation without removing active BullMQ job', async () => {
      const processingRecord = {
        id: 'gen-active-1',
        jobId: 'job_gen-active-1',
        quizId: 'quiz-1',
        targetVersionId: 'ver-1',
        status: GenerationStatus.PROCESSING,
        promptParams: {
          topic: 'Chemistry',
          sourcePdfPath: '/storage/gen-active-1.pdf',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      } as unknown as QuizQuestionGeneration;

      const mockRemove = vi.fn();
      mockAiQueue.getJob = vi.fn().mockResolvedValue({
        id: 'job_gen-active-1',
        getState: vi.fn().mockResolvedValue('active'),
        remove: mockRemove,
      } as any);

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce(processingRecord),
          save: vi.fn(async (_entity, val) => val),
        };
        return cb(manager as any);
      });

      const res = await service.cancelGeneration('quiz-1', 'gen-active-1', mockUser);

      expect(res.status).toBe(GenerationStatus.CANCELLED);
      expect(res.stage).toBe(GenerationLifecycleStage.CANCELLED);
      expect(res.isTerminal).toBe(true);
      expect(mockRemove).not.toHaveBeenCalled();
      // Active worker will clean up the PDF file in its finally block
      expect(mockPdfStorage.deletePdfFile).not.toHaveBeenCalled();
    });

    it('should handle repeated cancellation requests idempotently when already CANCELLED', async () => {
      const cancelledAt = new Date('2026-10-25T11:00:00.000Z');
      const cancelledRecord = {
        id: 'gen-cancelled-1',
        jobId: 'job_gen-cancelled-1',
        quizId: 'quiz-1',
        targetVersionId: 'ver-1',
        status: GenerationStatus.CANCELLED,
        promptParams: { topic: 'History' },
        createdAt: new Date('2026-10-25T10:59:00.000Z'),
        updatedAt: cancelledAt,
        completedAt: cancelledAt,
      } as unknown as QuizQuestionGeneration;

      const mockSave = vi.fn();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce(cancelledRecord),
          save: mockSave,
        };
        return cb(manager as any);
      });

      const res = await service.cancelGeneration('quiz-1', 'gen-cancelled-1', mockUser);

      expect(res.status).toBe(GenerationStatus.CANCELLED);
      expect(res.completedAt).toEqual(cancelledAt);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should reject cancellation with BadRequestException when generation is already COMPLETED', async () => {
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce({
            id: 'gen-completed-1',
            quizId: 'quiz-1',
            status: GenerationStatus.COMPLETED,
          }),
          save: vi.fn(),
        };
        return cb(manager as any);
      });

      await expect(
        service.cancelGeneration('quiz-1', 'gen-completed-1', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cancellation with BadRequestException when generation is already FAILED', async () => {
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce({
            id: 'gen-failed-1',
            quizId: 'quiz-1',
            status: GenerationStatus.FAILED,
          }),
          save: vi.fn(),
        };
        return cb(manager as any);
      });

      await expect(
        service.cancelGeneration('quiz-1', 'gen-failed-1', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unauthorized cancellation with ForbiddenException', async () => {
      mockQuizRepo.findOne = vi.fn().mockResolvedValueOnce({
        id: 'quiz-1',
        creatorId: 'other-owner',
        organizationId: null,
      } as Quiz);

      await expect(
        service.cancelGeneration('quiz-1', 'gen-1', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when cancelling a non-existent generation', async () => {
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce(null),
        };
        return cb(manager as any);
      });

      await expect(
        service.cancelGeneration('quiz-1', 'missing-gen', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('persistGeneratedQuestionsTransactionally', () => {
    it('should exit idempotently if generation is already COMPLETED', async () => {
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce({
            id: 'gen-1',
            status: GenerationStatus.COMPLETED,
          }),
        };
        return cb(manager as any);
      });

      const res = await service.persistGeneratedQuestionsTransactionally(
        'gen-1',
        'quiz-1',
        'ver-1',
        [],
      );

      expect(res.status).toBe(GenerationStatus.COMPLETED);
    });

    it('should abort without saving questions if generation was CANCELLED (cancellation racing with persistence)', async () => {
      const mockSave = vi.fn();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce({
            id: 'gen-race-1',
            status: GenerationStatus.CANCELLED,
          }),
          save: mockSave,
        };
        return cb(manager as any);
      });

      const res = await service.persistGeneratedQuestionsTransactionally(
        'gen-race-1',
        'quiz-1',
        'ver-1',
        [
          {
            text: 'Should not be saved?',
            questionType: QuestionType.SINGLE_CHOICE,
            marks: 1,
            options: [
              { text: 'Yes', isCorrect: true },
              { text: 'No', isCorrect: false },
            ],
          },
        ],
      );

      expect(res.status).toBe(GenerationStatus.CANCELLED);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should throw UnrecoverableError if target version is not DRAFT', async () => {
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce({ id: 'gen-1', status: GenerationStatus.PROCESSING }) // generation
            .mockResolvedValueOnce({ id: 'ver-1', status: QuizVersionStatus.PUBLISHED }), // version
        };
        return cb(manager as any);
      });

      await expect(
        service.persistGeneratedQuestionsTransactionally('gen-1', 'quiz-1', 'ver-1', []),
      ).rejects.toThrow(UnrecoverableError);
    });
  });
});
