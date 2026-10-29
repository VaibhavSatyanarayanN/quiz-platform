import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
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
  GenerationReviewStatus,
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

    it('should stage generated questions for review without inserting into QuizVersion until explicit creator apply', async () => {
      const mockCreate = vi.fn();
      const mockSave = vi.fn(async (_entity, val) => val);
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce({
              id: 'gen-stage-1',
              status: GenerationStatus.PROCESSING,
              promptParams: { topic: 'Biology' },
            })
            .mockResolvedValueOnce({
              id: 'ver-1',
              quizId: 'quiz-1',
              status: QuizVersionStatus.DRAFT,
            }),
          create: mockCreate,
          save: mockSave,
        };
        return cb(manager as any);
      });

      const res = await service.persistGeneratedQuestionsTransactionally(
        'gen-stage-1',
        'quiz-1',
        'ver-1',
        [
          {
            id: 'q1',
            text: 'What is photosynthesis?',
            questionType: QuestionType.SINGLE_CHOICE,
            marks: 2,
            explanation: 'Plants convert light energy.',
            difficulty: 'easy',
            options: [
              { id: 'A', text: 'Light to energy', isCorrect: true },
              { id: 'B', text: 'Respiration', isCorrect: false },
            ],
          },
        ],
        { total_tokens: 200 },
      );

      expect(res.status).toBe(GenerationStatus.COMPLETED);
      // Question / Option entities must NOT be created in QuizVersion during worker completion
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(res.generatedQuestions).toHaveLength(1);
      expect(res.generatedQuestions![0].text).toBe('What is photosynthesis?');
      expect((res.promptParams as any)._reviewMetadata.reviewStatus).toBe(
        GenerationReviewStatus.PENDING_REVIEW,
      );
      expect((res.promptParams as any)._originalGeneratedQuestions).toHaveLength(1);
    });
  });

  describe('Phase 5: Review, Edit, Reset, and Apply AI-Generated Questions', () => {
    const sampleGeneratedQuestions = [
      {
        id: 'q_1',
        order: 1,
        text: 'Which protocol operates at Layer 4?',
        questionType: QuestionType.SINGLE_CHOICE,
        marks: 2,
        explanation: 'TCP is a transport layer protocol.',
        difficulty: 'medium',
        cognitiveLevel: 'understand',
        correctAnswer: 'A',
        options: [
          { id: 'A', text: 'TCP', isCorrect: true },
          { id: 'B', text: 'IP', isCorrect: false },
        ],
      },
      {
        id: 'q_2',
        order: 2,
        text: 'UDP is connectionless.',
        questionType: QuestionType.TRUE_FALSE,
        marks: 1,
        explanation: 'UDP does not establish a handshake.',
        difficulty: 'easy',
        correctAnswer: 'true',
        options: [
          { id: 'True', text: 'True', isCorrect: true },
          { id: 'False', text: 'False', isCorrect: false },
        ],
      },
    ];

    const buildCompletedGeneration = (
      overrides: Partial<QuizQuestionGeneration> = {},
    ): QuizQuestionGeneration =>
      ({
        id: 'gen-review-1',
        jobId: 'job_gen-review-1',
        creatorId: 'creator-1',
        quizId: 'quiz-1',
        targetVersionId: 'ver-1',
        status: GenerationStatus.COMPLETED,
        promptParams: {
          topic: 'Computer Networking',
          targetQuestionCount: 2,
          _lifecycleStage: GenerationLifecycleStage.COMPLETED,
          _originalGeneratedQuestions: sampleGeneratedQuestions,
          _reviewMetadata: {
            reviewStatus: GenerationReviewStatus.PENDING_REVIEW,
            editedAt: null,
            editedBy: null,
            appliedAt: null,
            appliedBy: null,
            appliedVersionId: null,
            appliedQuestionIds: [],
            appliedQuestionsCount: 0,
            applyStrategy: null,
          },
        },
        generatedQuestions: sampleGeneratedQuestions,
        errorMessage: null,
        tokensUsed: { total_tokens: 320 },
        createdAt: new Date('2026-10-25T12:00:00.000Z'),
        updatedAt: new Date('2026-10-25T12:01:00.000Z'),
        completedAt: new Date('2026-10-25T12:01:00.000Z'),
        ...overrides,
      }) as unknown as QuizQuestionGeneration;

    it('1. Creator can retrieve a completed generation questions for review', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValueOnce(buildCompletedGeneration());

      const review = await service.getGenerationForReview('quiz-1', 'gen-review-1', mockUser);

      expect(review.generationId).toBe('gen-review-1');
      expect(review.quizId).toBe('quiz-1');
      expect(review.targetVersionId).toBe('ver-1');
      expect(review.targetVersionStatus).toBe(QuizVersionStatus.DRAFT);
      expect(review.status).toBe(GenerationStatus.COMPLETED);
      expect(review.reviewStatus).toBe(GenerationReviewStatus.PENDING_REVIEW);
      expect(review.isReadyForReview).toBe(true);
      expect(review.isApplied).toBe(false);
      expect(review.hasCreatorEdits).toBe(false);
      expect(review.questions).toHaveLength(2);
      expect(review.questions[0].text).toBe('Which protocol operates at Layer 4?');
      expect(review.promptParams._originalGeneratedQuestions).toBeUndefined();
      expect(review.promptParams._reviewMetadata).toBeUndefined();
    });

    it('2. Unauthorized user or another creator cannot access the generation for review', async () => {
      mockQuizRepo.findOne = vi.fn().mockResolvedValueOnce({
        id: 'quiz-1',
        creatorId: 'other-creator',
        organizationId: null,
      } as Quiz);

      await expect(
        service.getGenerationForReview('quiz-1', 'gen-review-1', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('3. Generation belonging to another quiz is rejected with NotFoundException', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValueOnce(null);

      await expect(
        service.getGenerationForReview('quiz-1', 'gen-belongs-to-quiz-2', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('4. Questions can be edited and reordered while preserving original AI output', async () => {
      const existingGen = buildCompletedGeneration();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          count: vi.fn().mockResolvedValueOnce(0),
          save: vi.fn(async (_entity, val) => val),
        };
        return cb(manager as any);
      });

      const updated = await service.saveReviewDraft(
        'quiz-1',
        'gen-review-1',
        {
          questions: [
            {
              id: 'q_2',
              order: 1,
              text: 'UDP is a connectionless transport protocol.',
              questionType: QuestionType.TRUE_FALSE,
              marks: 2,
              explanation: 'Edited explanation for UDP.',
              difficulty: 'medium',
              options: [
                { id: 'True', text: 'True', isCorrect: true },
                { id: 'False', text: 'False', isCorrect: false },
              ],
            },
            {
              id: 'q_1',
              order: 2,
              text: 'Which protocol operates at the Transport Layer (L4)?',
              questionType: QuestionType.SINGLE_CHOICE,
              marks: 3,
              explanation: 'Edited explanation for TCP.',
              difficulty: 'hard',
              options: [
                { id: 'A', text: 'TCP', isCorrect: true },
                { id: 'B', text: 'IP', isCorrect: false },
                { id: 'C', text: 'ARP', isCorrect: false },
              ],
            },
          ],
        },
        mockUser,
      );

      expect(updated.reviewStatus).toBe(GenerationReviewStatus.REVIEWED);
      expect(updated.hasCreatorEdits).toBe(true);
      expect(updated.editedAt).toBeTruthy();
      expect(updated.questions).toHaveLength(2);
      expect(updated.questions[0].id).toBe('q_2');
      expect(updated.questions[0].order).toBe(1);
      expect(updated.questions[0].marks).toBe(2);
      expect(updated.questions[1].id).toBe('q_1');
      expect(updated.questions[1].order).toBe(2);
      expect(updated.questions[1].options).toHaveLength(3);
      // Original snapshot remains intact in promptParams
      expect((existingGen.promptParams as any)._originalGeneratedQuestions).toHaveLength(2);
      expect((existingGen.promptParams as any)._originalGeneratedQuestions[0].id).toBe('q_1');
    });

    it('5. Removing a question removes it from the reviewed set and reset restores original questions', async () => {
      const existingGen = buildCompletedGeneration();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          count: vi.fn().mockResolvedValueOnce(0),
          save: vi.fn(async (_entity, val) => val),
        };
        return cb(manager as any);
      });

      // Remove q_2 by saving only q_1
      const afterRemove = await service.saveReviewDraft(
        'quiz-1',
        'gen-review-1',
        {
          questions: [
            {
              id: 'q_1',
              text: 'Which protocol operates at Layer 4?',
              questionType: QuestionType.SINGLE_CHOICE,
              marks: 2,
              options: [
                { id: 'A', text: 'TCP', isCorrect: true },
                { id: 'B', text: 'IP', isCorrect: false },
              ],
            },
          ],
        },
        mockUser,
      );

      expect(afterRemove.questions).toHaveLength(1);
      expect(afterRemove.questions[0].id).toBe('q_1');

      // Now reset to original AI output
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          count: vi.fn().mockResolvedValueOnce(0),
          save: vi.fn(async (_entity, val) => val),
        };
        return cb(manager as any);
      });

      const afterReset = await service.resetReviewDraftToOriginal(
        'quiz-1',
        'gen-review-1',
        mockUser,
      );

      expect(afterReset.reviewStatus).toBe(GenerationReviewStatus.PENDING_REVIEW);
      expect(afterReset.hasCreatorEdits).toBe(false);
      expect(afterReset.questions).toHaveLength(2);
    });

    it('6. Invalid MCQ options (fewer than 2 options, duplicate option texts, or conflicting correctAnswer) are rejected', async () => {
      const existingGen = buildCompletedGeneration();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          save: vi.fn(),
        };
        return cb(manager as any);
      });

      // Case A: Fewer than 2 options
      await expect(
        service.saveReviewDraft(
          'quiz-1',
          'gen-review-1',
          {
            questions: [
              {
                text: 'Invalid MCQ with 1 option',
                questionType: QuestionType.SINGLE_CHOICE,
                marks: 1,
                options: [{ id: 'A', text: 'Only option', isCorrect: true }],
              },
            ],
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);

      // Case B: Duplicate option text
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          save: vi.fn(),
        };
        return cb(manager as any);
      });

      await expect(
        service.saveReviewDraft(
          'quiz-1',
          'gen-review-1',
          {
            questions: [
              {
                text: 'Duplicate options MCQ',
                questionType: QuestionType.SINGLE_CHOICE,
                marks: 1,
                options: [
                  { id: 'A', text: 'Same text', isCorrect: true },
                  { id: 'B', text: 'same text', isCorrect: false },
                ],
              },
            ],
          },
          mockUser,
        ),
      ).rejects.toThrow(/duplicate option text/i);

      // Case C: Zero correct options
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          save: vi.fn(),
        };
        return cb(manager as any);
      });

      await expect(
        service.saveReviewDraft(
          'quiz-1',
          'gen-review-1',
          {
            questions: [
              {
                text: 'No correct option MCQ',
                questionType: QuestionType.SINGLE_CHOICE,
                marks: 1,
                options: [
                  { id: 'A', text: 'Opt 1', isCorrect: false },
                  { id: 'B', text: 'Opt 2', isCorrect: false },
                ],
              },
            ],
          },
          mockUser,
        ),
      ).rejects.toThrow(/exactly 1 correct option/i);
    });

    it('7. True/false questions respect domain rules and open-ended questions are rejected at the QuizVersion boundary', async () => {
      const existingGen = buildCompletedGeneration();

      // Case A: True/False with conflicting correctAnswer vs isCorrect flag
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          save: vi.fn(),
        };
        return cb(manager as any);
      });

      await expect(
        service.saveReviewDraft(
          'quiz-1',
          'gen-review-1',
          {
            questions: [
              {
                text: 'Conflicting True/False',
                questionType: QuestionType.TRUE_FALSE,
                marks: 1,
                correctAnswer: 'false',
                options: [
                  { id: 'A', text: 'True', isCorrect: true },
                  { id: 'B', text: 'False', isCorrect: false },
                ],
              },
            ],
          },
          mockUser,
        ),
      ).rejects.toThrow(/conflicting correctAnswer/i);

      // Case B: Open-ended question is rejected during review draft save
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          save: vi.fn(),
        };
        return cb(manager as any);
      });

      await expect(
        service.saveReviewDraft(
          'quiz-1',
          'gen-review-1',
          {
            questions: [
              {
                text: 'Explain TCP congestion control.',
                questionType: 'open_ended' as any,
                marks: 5,
                correctAnswer: 'Slow start and congestion avoidance.',
                options: [],
              },
            ],
          },
          mockUser,
        ),
      ).rejects.toThrow(/unsupported questionType "open_ended"/i);

      // Case C: Open-ended question is rejected during applyGeneratedQuestions without creating dummy Option rows
      const mockCreate = vi.fn();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          create: mockCreate,
          save: vi.fn(),
        };
        return cb(manager as any);
      });

      await expect(
        service.applyGeneratedQuestions(
          'quiz-1',
          'gen-review-1',
          {
            questions: [
              {
                text: 'Explain TCP congestion control.',
                questionType: 'open_ended' as any,
                marks: 5,
                correctAnswer: 'Uses AIMD, slow start, congestion avoidance, and fast recovery.',
                options: [],
              },
            ],
          },
          mockUser,
        ),
      ).rejects.toThrow(/unsupported questionType "open_ended"/i);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('8. Applying a valid reviewed set persists expected Question and Option records and marks generation APPLIED', async () => {
      const existingGen = buildCompletedGeneration();
      let questionCounter = 0;
      const savedEntities: Array<{ entity: any; val: any }> = [];

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          count: vi.fn().mockResolvedValueOnce(0),
          create: vi.fn((entity, val) => {
            questionCounter += 1;
            return { ...val, id: `persisted-${questionCounter}`, _entityName: entity.name };
          }),
          save: vi.fn(async (entity, val) => {
            savedEntities.push({ entity, val });
            return val;
          }),
        };
        return cb(manager as any);
      });

      const applyResult = await service.applyGeneratedQuestions(
        'quiz-1',
        'gen-review-1',
        { targetVersionId: 'ver-1' },
        mockUser,
      );

      expect(applyResult.generationId).toBe('gen-review-1');
      expect(applyResult.quizId).toBe('quiz-1');
      expect(applyResult.targetVersionId).toBe('ver-1');
      expect(applyResult.reviewStatus).toBe(GenerationReviewStatus.APPLIED);
      expect(applyResult.isApplied).toBe(true);
      expect(applyResult.applyStrategy).toBe('append');
      expect(applyResult.appliedQuestionsCount).toBe(2);
      expect(applyResult.appliedQuestionIds).toHaveLength(2);
      expect(applyResult.appliedAt).toBeTruthy();
      expect((existingGen.promptParams as any)._reviewMetadata.reviewStatus).toBe(
        GenerationReviewStatus.APPLIED,
      );
    });

    it('9. Applying to a non-draft version (PUBLISHED or ARCHIVED) is rejected', async () => {
      const existingGen = buildCompletedGeneration();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce({
              id: 'ver-1',
              quizId: 'quiz-1',
              status: QuizVersionStatus.PUBLISHED,
            }),
        };
        return cb(manager as any);
      });

      await expect(
        service.applyGeneratedQuestions('quiz-1', 'gen-review-1', {}, mockUser),
      ).rejects.toThrow(/Only DRAFT versions can be modified/i);
    });

    it('10. Applying a FAILED, CANCELLED, PENDING, or PROCESSING generation is rejected', async () => {
      for (const nonCompletedStatus of [
        GenerationStatus.FAILED,
        GenerationStatus.CANCELLED,
        GenerationStatus.PENDING,
        GenerationStatus.PROCESSING,
      ]) {
        const nonCompletedGen = buildCompletedGeneration({ status: nonCompletedStatus });
        mockDataSource.transaction = vi.fn(async (cb) => {
          const manager = {
            findOne: vi.fn().mockResolvedValueOnce(nonCompletedGen),
          };
          return cb(manager as any);
        });

        await expect(
          service.applyGeneratedQuestions('quiz-1', 'gen-review-1', {}, mockUser),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('11. Generation from a different quiz or mismatched targetVersionId cannot be applied', async () => {
      const existingGen = buildCompletedGeneration();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce(existingGen),
        };
        return cb(manager as any);
      });

      await expect(
        service.applyGeneratedQuestions(
          'quiz-1',
          'gen-review-1',
          { targetVersionId: 'different-version-id' },
          mockUser,
        ),
      ).rejects.toThrow(/does not match the generation record/i);
    });

    it('12. Duplicate apply request is rejected cleanly with ConflictException without creating duplicate questions', async () => {
      const alreadyAppliedGen = buildCompletedGeneration({
        promptParams: {
          topic: 'Computer Networking',
          _originalGeneratedQuestions: sampleGeneratedQuestions,
          _reviewMetadata: {
            reviewStatus: GenerationReviewStatus.APPLIED,
            appliedAt: '2026-10-25T12:10:00.000Z',
            appliedBy: 'creator-1',
            appliedVersionId: 'ver-1',
            appliedQuestionIds: ['q-db-1', 'q-db-2'],
            appliedQuestionsCount: 2,
            applyStrategy: 'append',
          },
        } as any,
      });

      const mockCreate = vi.fn();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce(alreadyAppliedGen),
          create: mockCreate,
        };
        return cb(manager as any);
      });

      await expect(
        service.applyGeneratedQuestions('quiz-1', 'gen-review-1', {}, mockUser),
      ).rejects.toThrow(ConflictException);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('13. Persistence failure inside transaction rolls back the entire operation', async () => {
      const existingGen = buildCompletedGeneration();

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          count: vi.fn().mockResolvedValueOnce(0),
          create: vi.fn((_entity, val) => ({ ...val, id: 'temp-id' })),
          save: vi
            .fn()
            .mockResolvedValueOnce({ id: 'q-1' }) // first question save succeeds
            .mockRejectedValueOnce(new Error('Database constraint violation during option save')),
        };
        return cb(manager as any);
      });

      await expect(
        service.applyGeneratedQuestions('quiz-1', 'gen-review-1', {}, mockUser),
      ).rejects.toThrow('Database constraint violation during option save');

      // Generation record must NOT be marked applied because transaction aborted before metadata save
      expect((existingGen.promptParams as any)._reviewMetadata.reviewStatus).toBe(
        GenerationReviewStatus.PENDING_REVIEW,
      );
    });

    it('14. Concurrent apply attempts serialized by pessimistic_write cannot both apply the same generation', async () => {
      const sharedGen = buildCompletedGeneration();

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(sharedGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          count: vi.fn().mockResolvedValueOnce(0),
          create: vi.fn((_entity, val) => ({ ...val, id: 'persisted-q' })),
          save: vi.fn(async (_entity, val) => val),
        };
        return cb(manager as any);
      });

      // First request acquires lock and applies
      const firstApply = await service.applyGeneratedQuestions(
        'quiz-1',
        'gen-review-1',
        {},
        mockUser,
      );
      expect(firstApply.reviewStatus).toBe(GenerationReviewStatus.APPLIED);

      // Second concurrent request acquires lock after first commits and sees APPLIED state
      await expect(
        service.applyGeneratedQuestions('quiz-1', 'gen-review-1', {}, mockUser),
      ).rejects.toThrow(ConflictException);
    });

    it('15. Existing draft questions are not overwritten (append strategy assigns orders after existingCount)', async () => {
      const existingGen = buildCompletedGeneration();
      const createdQuestions: any[] = [];

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(existingGen)
            .mockResolvedValueOnce(sampleDraftVersion),
          // Simulate 4 existing questions already in the draft version
          count: vi.fn().mockResolvedValueOnce(4),
          create: vi.fn((entity, val) => {
            if (entity.name === 'Question') {
              createdQuestions.push(val);
            }
            return { ...val, id: `q-${createdQuestions.length}` };
          }),
          save: vi.fn(async (_entity, val) => val),
        };
        return cb(manager as any);
      });

      const result = await service.applyGeneratedQuestions(
        'quiz-1',
        'gen-review-1',
        {},
        mockUser,
      );

      expect(createdQuestions).toHaveLength(2);
      expect(createdQuestions[0].order).toBe(5);
      expect(createdQuestions[1].order).toBe(6);
      expect(result.appliedQuestionsCount).toBe(2);
      expect(result.applyStrategy).toBe('append');
    });

    it('16. Unauthorized users cannot edit or apply questions', async () => {
      mockQuizRepo.findOne = vi.fn().mockResolvedValue({
        id: 'quiz-1',
        creatorId: 'different-creator',
        organizationId: null,
      } as Quiz);

      await expect(
        service.saveReviewDraft(
          'quiz-1',
          'gen-review-1',
          {
            questions: [
              {
                text: 'Unauthorized edit',
                questionType: QuestionType.SINGLE_CHOICE,
                marks: 1,
                options: [
                  { id: 'A', text: 'Yes', isCorrect: true },
                  { id: 'B', text: 'No', isCorrect: false },
                ],
              },
            ],
          },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.applyGeneratedQuestions('quiz-1', 'gen-review-1', {}, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('17. Rejects saveReviewDraft and resetReviewDraftToOriginal after generation is APPLIED or when target version is PUBLISHED', async () => {
      const appliedGen = buildCompletedGeneration({
        promptParams: {
          topic: 'Computer Networking',
          _originalGeneratedQuestions: sampleGeneratedQuestions,
          _reviewMetadata: {
            reviewStatus: GenerationReviewStatus.APPLIED,
            appliedAt: '2026-10-25T12:15:00.000Z',
            appliedBy: 'creator-1',
            appliedVersionId: 'ver-1',
            appliedQuestionIds: ['q-db-1'],
            appliedQuestionsCount: 1,
            applyStrategy: 'append',
          },
        } as any,
      });

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce(appliedGen),
        };
        return cb(manager as any);
      });

      await expect(
        service.saveReviewDraft(
          'quiz-1',
          'gen-review-1',
          { questions: sampleGeneratedQuestions as any },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi.fn().mockResolvedValueOnce(appliedGen),
        };
        return cb(manager as any);
      });

      await expect(
        service.resetReviewDraftToOriginal('quiz-1', 'gen-review-1', mockUser),
      ).rejects.toThrow(ConflictException);

      // Also verify that saveReviewDraft and resetReviewDraftToOriginal reject under lock when target version is PUBLISHED
      const unappliedGen = buildCompletedGeneration();
      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(unappliedGen)
            .mockResolvedValueOnce({
              id: 'ver-1',
              quizId: 'quiz-1',
              status: QuizVersionStatus.PUBLISHED,
            }),
        };
        return cb(manager as any);
      });

      await expect(
        service.saveReviewDraft(
          'quiz-1',
          'gen-review-1',
          { questions: sampleGeneratedQuestions as any },
          mockUser,
        ),
      ).rejects.toThrow(/Only DRAFT versions can be modified/i);

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(unappliedGen)
            .mockResolvedValueOnce({
              id: 'ver-1',
              quizId: 'quiz-1',
              status: QuizVersionStatus.PUBLISHED,
            }),
        };
        return cb(manager as any);
      });

      await expect(
        service.resetReviewDraftToOriginal('quiz-1', 'gen-review-1', mockUser),
      ).rejects.toThrow(/Only DRAFT versions can be modified/i);
    });

    it('18. Deep-clones _originalGeneratedQuestions so in-memory mutations of generatedQuestions cannot corrupt the original snapshot', async () => {
      const genWithoutExplicitOriginal = buildCompletedGeneration({
        promptParams: {
          topic: 'Computer Networking',
          _lifecycleStage: GenerationLifecycleStage.COMPLETED,
          _reviewMetadata: {
            reviewStatus: GenerationReviewStatus.PENDING_REVIEW,
            editedAt: null,
            editedBy: null,
            appliedAt: null,
            appliedBy: null,
            appliedVersionId: null,
            appliedQuestionIds: [],
            appliedQuestionsCount: 0,
            applyStrategy: null,
          },
        } as any,
      });

      mockDataSource.transaction = vi.fn(async (cb) => {
        const manager = {
          findOne: vi
            .fn()
            .mockResolvedValueOnce(genWithoutExplicitOriginal)
            .mockResolvedValueOnce(sampleDraftVersion),
          count: vi.fn().mockResolvedValueOnce(2),
          save: vi.fn(async (_entity, val) => val),
        };
        return cb(manager as any);
      });

      await service.saveReviewDraft(
        'quiz-1',
        'gen-review-1',
        {
          questions: [
            {
              id: 'q_1',
              text: 'Mutated question text',
              questionType: QuestionType.SINGLE_CHOICE,
              marks: 5,
              options: [
                { id: 'A', text: 'Mutated Option A', isCorrect: true },
                { id: 'B', text: 'Mutated Option B', isCorrect: false },
              ],
            },
          ],
        },
        mockUser,
      );

      // Mutate the active generatedQuestions in memory and verify _originalGeneratedQuestions is unaffected
      (genWithoutExplicitOriginal.generatedQuestions as any)[0].text = 'In-place corruption attempt';
      const storedOriginal = (genWithoutExplicitOriginal.promptParams as any)
        ._originalGeneratedQuestions;
      expect(storedOriginal).toHaveLength(2);
      expect(storedOriginal[0].text).toBe('Which protocol operates at Layer 4?');
      expect(storedOriginal[0].options[0].text).toBe('TCP');
    });
  });
});
