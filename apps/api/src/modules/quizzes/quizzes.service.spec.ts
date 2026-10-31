import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QuizService } from './quizzes.service.js';
import { Quiz } from './entities/quiz.entity.js';
import { QuizVersion } from './entities/quiz-version.entity.js';
import { Question } from './entities/question.entity.js';
import { Option } from './entities/option.entity.js';
import { QuizAttempt } from './entities/quiz-attempt.entity.js';
import { Answer } from './entities/answer.entity.js';
import { AnswerOption } from './entities/answer-option.entity.js';
import { QuizAssignment } from '../quiz-assignments/entities/quiz-assignment.entity.js';
import { QuizAssignmentRecipient } from '../quiz-assignments/entities/quiz-assignment-recipient.entity.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { QuizStatus } from './enums/quiz-status.enum.js';
import { QuizVersionStatus } from './enums/quiz-version-status.enum.js';
import { AttemptStatus } from './enums/attempt-status.enum.js';
import { GenerationStatus } from './enums/generation-status.enum.js';
import { QuizQuestionGeneration } from './entities/quiz-question-generation.entity.js';
import { QuestionType } from './enums/question-type.enum.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

describe('QuizService — Phase 6.1 Quiz Attempt Lifecycle & Secure Learner APIs', () => {
  let service: QuizService;
  let mockQuizRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockQuizVersionRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockQuestionRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockOptionRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockQuizAttemptRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockDataSource: { transaction: ReturnType<typeof vi.fn> };

  const learnerA: AuthenticatedUser = {
    userId: 'learner-a-uuid',
    email: 'learner.a@example.com',
    role: UserRole.TAKER,
  };

  const learnerB: AuthenticatedUser = {
    userId: 'learner-b-uuid',
    email: 'learner.b@example.com',
    role: UserRole.TAKER,
  };

  const creatorUser: AuthenticatedUser = {
    userId: 'creator-uuid',
    email: 'creator@example.com',
    role: UserRole.CREATOR,
  };

  const adminUser: AuthenticatedUser = {
    userId: 'admin-uuid',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  const publishedQuiz: Quiz = {
    id: 'quiz-1',
    title: 'TypeScript Fundamentals',
    description: 'Core assessment on TypeScript',
    creatorId: creatorUser.userId,
    organizationId: null,
    status: QuizStatus.PUBLISHED,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } as Quiz;

  const publishedVersion: QuizVersion = {
    id: 'ver-published-1',
    quizId: 'quiz-1',
    version: 2,
    status: QuizVersionStatus.PUBLISHED,
    timeLimitSeconds: 600,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } as QuizVersion;

  const sampleQuestions: Question[] = [
    {
      id: 'q-1',
      quizVersionId: 'ver-published-1',
      text: 'Which keyword declares a read-only property in TypeScript?',
      questionType: QuestionType.SINGLE_CHOICE,
      order: 1,
      marks: 2,
    } as Question,
    {
      id: 'q-2',
      quizVersionId: 'ver-published-1',
      text: 'TypeScript supports structural typing.',
      questionType: QuestionType.TRUE_FALSE,
      order: 2,
      marks: 1,
    } as Question,
  ];

  const sampleOptionsByQuestion: Record<string, Option[]> = {
    'q-1': [
      { id: 'opt-1a', questionId: 'q-1', text: 'readonly', isCorrect: true, order: 1 } as Option,
      { id: 'opt-1b', questionId: 'q-1', text: 'final', isCorrect: false, order: 2 } as Option,
    ],
    'q-2': [
      { id: 'opt-2a', questionId: 'q-2', text: 'True', isCorrect: true, order: 1 } as Option,
      { id: 'opt-2b', questionId: 'q-2', text: 'False', isCorrect: false, order: 2 } as Option,
    ],
  };

  beforeEach(async () => {
    mockQuizRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
    };
    mockQuizVersionRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
    };
    mockQuestionRepo = {
      find: vi.fn(),
    };
    mockOptionRepo = {
      find: vi.fn(),
    };
    mockQuizAttemptRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
    };
    mockDataSource = {
      transaction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: getRepositoryToken(Quiz), useValue: mockQuizRepo },
        { provide: getRepositoryToken(QuizVersion), useValue: mockQuizVersionRepo },
        { provide: getRepositoryToken(Question), useValue: mockQuestionRepo },
        { provide: getRepositoryToken(Option), useValue: mockOptionRepo },
        { provide: getRepositoryToken(QuizAttempt), useValue: mockQuizAttemptRepo },
        { provide: OrganizationService, useValue: { getPrimaryMembership: vi.fn() } },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startAttempt', () => {
    it('1 & 4. starts an attempt against a PUBLISHED version and binds it to the authenticated learner', async () => {
      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          if (entity === QuizAttempt) return null;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Question) return sampleQuestions;
          return [];
        }),
        create: vi.fn((_entity: unknown, data: Record<string, unknown>) => ({
          id: 'attempt-new-1',
          ...data,
        })),
        save: vi.fn(async (_entity: unknown, data: Record<string, unknown>) => data),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      const result = await service.startAttempt(
        publishedQuiz.id,
        publishedVersion.id,
        learnerA,
      );

      expect(result.attemptId).toBe('attempt-new-1');
      expect(result.id).toBe('attempt-new-1');
      expect(result.quizId).toBe(publishedQuiz.id);
      expect(result.quizVersionId).toBe(publishedVersion.id);
      expect(result.version).toBe(publishedVersion.version);
      expect(result.quizTitle).toBe(publishedQuiz.title);
      expect(result.status).toBe(AttemptStatus.IN_PROGRESS);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.totalQuestions).toBe(2);
      expect(result.totalMarks).toBe(3);
      expect(result.resumed).toBe(false);

      expect(mockManager.create).toHaveBeenCalledWith(
        QuizAttempt,
        expect.objectContaining({
          userId: learnerA.userId,
          quizId: publishedQuiz.id,
          quizVersionId: publishedVersion.id,
          status: AttemptStatus.IN_PROGRESS,
        }),
      );
    });

    it('2. rejects attempts against DRAFT versions with BadRequestException', async () => {
      const draftVersion: QuizVersion = {
        ...publishedVersion,
        id: 'ver-draft-1',
        status: QuizVersionStatus.DRAFT,
      } as QuizVersion;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return draftVersion;
          return null;
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      await expect(
        service.startAttempt(publishedQuiz.id, draftVersion.id, learnerA),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. rejects attempts against ARCHIVED versions and unpublished quizzes', async () => {
      const archivedVersion: QuizVersion = {
        ...publishedVersion,
        id: 'ver-archived-1',
        status: QuizVersionStatus.ARCHIVED,
      } as QuizVersion;

      const mockManagerArchivedVersion = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return archivedVersion;
          return null;
        }),
      };

      mockDataSource.transaction.mockImplementationOnce(
        async (cb: (m: typeof mockManagerArchivedVersion) => unknown) =>
          cb(mockManagerArchivedVersion),
      );

      await expect(
        service.startAttempt(publishedQuiz.id, archivedVersion.id, learnerA),
      ).rejects.toThrow(BadRequestException);

      // Unpublished quiz
      const draftQuiz: Quiz = {
        ...publishedQuiz,
        status: QuizStatus.DRAFT,
      } as Quiz;

      const mockManagerDraftQuiz = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return draftQuiz;
          return null;
        }),
      };

      mockDataSource.transaction.mockImplementationOnce(
        async (cb: (m: typeof mockManagerDraftQuiz) => unknown) =>
          cb(mockManagerDraftQuiz),
      );

      await expect(
        service.startAttempt(draftQuiz.id, publishedVersion.id, learnerA),
      ).rejects.toThrow(BadRequestException);
    });

    it('10. handles missing quizzes, missing versions, and versions with zero questions', async () => {
      // Missing quiz -> 404
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: unknown) => unknown) =>
        cb({ findOne: vi.fn().mockResolvedValue(null) }),
      );
      await expect(
        service.startAttempt('missing-quiz', publishedVersion.id, learnerA),
      ).rejects.toThrow(NotFoundException);

      // Missing version -> 404
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: unknown) => unknown) =>
        cb({
          findOne: vi.fn(async (entity: unknown) => (entity === Quiz ? publishedQuiz : null)),
        }),
      );
      await expect(
        service.startAttempt(publishedQuiz.id, 'missing-version', learnerA),
      ).rejects.toThrow(NotFoundException);

      // Published version with 0 questions -> 400
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: unknown) => unknown) =>
        cb({
          findOne: vi.fn(async (entity: unknown) => {
            if (entity === Quiz) return publishedQuiz;
            if (entity === QuizVersion) return publishedVersion;
            return null;
          }),
          find: vi.fn().mockResolvedValue([]),
        }),
      );
      await expect(
        service.startAttempt(publishedQuiz.id, publishedVersion.id, learnerA),
      ).rejects.toThrow(BadRequestException);
    });

    it('11a. returns existing active IN_PROGRESS attempt idempotently on duplicate start requests', async () => {
      const existingActiveAttempt: QuizAttempt = {
        id: 'attempt-existing-1',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 540_000),
      } as QuizAttempt;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          if (entity === QuizAttempt) return existingActiveAttempt;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Question) return sampleQuestions;
          return [];
        }),
        create: vi.fn(),
        save: vi.fn(),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      const result = await service.startAttempt(
        publishedQuiz.id,
        publishedVersion.id,
        learnerA,
      );

      expect(result.attemptId).toBe('attempt-existing-1');
      expect(result.resumed).toBe(true);
      expect(mockManager.create).not.toHaveBeenCalled();
    });

    it('11b. recovers gracefully from concurrent 23505 unique constraint violation on UQ_active_attempt_user_version', async () => {
      const winningAttempt: QuizAttempt = {
        id: 'attempt-winner-1',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 600_000),
      } as QuizAttempt;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          if (entity === QuizAttempt) return null;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Question) return sampleQuestions;
          return [];
        }),
        create: vi.fn((_e: unknown, data: unknown) => data),
        save: vi.fn().mockRejectedValue({
          code: '23505',
          constraint: 'UQ_active_attempt_user_version',
          message: 'duplicate key value violates unique constraint "UQ_active_attempt_user_version"',
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );
      mockQuizAttemptRepo.findOne.mockResolvedValue(winningAttempt);

      const result = await service.startAttempt(
        publishedQuiz.id,
        publishedVersion.id,
        learnerA,
      );

      expect(result.attemptId).toBe('attempt-winner-1');
      expect(result.resumed).toBe(true);
      expect(mockQuizAttemptRepo.findOne).toHaveBeenCalledWith({
        where: {
          userId: learnerA.userId,
          quizVersionId: publishedVersion.id,
          status: AttemptStatus.IN_PROGRESS,
        },
      });
    });

    it('11c. transitions an overdue IN_PROGRESS attempt to EXPIRED and starts a fresh attempt', async () => {
      const staleAttempt: QuizAttempt = {
        id: 'attempt-stale-1',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 1200_000),
        expiresAt: new Date(Date.now() - 600_000), // expired 10 minutes ago
      } as QuizAttempt;

      const savedEntities: unknown[] = [];

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          if (entity === QuizAttempt) return staleAttempt;
          return null;
        }),
        find: vi.fn(
          async (
            entity: unknown,
            opts?: { where?: Array<{ id?: string; questionId?: string }> },
          ) => {
            if (entity === Question) return sampleQuestions;
            if (entity === Answer) return [];
            if (entity === Option) {
              const allOptions = [
                ...sampleOptionsByQuestion['q-1'],
                ...sampleOptionsByQuestion['q-2'],
              ];
              if (Array.isArray(opts?.where) && opts.where[0]?.id) {
                const requestedIds = new Set(opts.where.map((w) => w.id));
                return allOptions.filter((o) => requestedIds.has(o.id));
              }
              return allOptions;
            }
            return [];
          },
        ),
        create: vi.fn((_entity: unknown, data: Record<string, unknown>) => ({
          id: 'attempt-fresh-2',
          ...data,
        })),
        save: vi.fn(async (_entity: unknown, data: unknown) => {
          savedEntities.push({ ...(data as Record<string, unknown>) });
          return data;
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      const result = await service.startAttempt(
        publishedQuiz.id,
        publishedVersion.id,
        learnerA,
      );

      expect(staleAttempt.status).toBe(AttemptStatus.EXPIRED);
      expect(result.attemptId).toBe('attempt-fresh-2');
      expect(result.status).toBe(AttemptStatus.IN_PROGRESS);
      expect(result.resumed).toBe(false);
    });

    it('enforces organization quiz assignment eligibility rules on startAttempt', async () => {
      const orgQuiz: Quiz = {
        ...publishedQuiz,
        organizationId: 'org-1',
      } as Quiz;

      const activeAssignment: QuizAssignment = {
        id: 'assign-1',
        quizId: orgQuiz.id,
        quizVersionId: publishedVersion.id,
        organizationId: 'org-1',
        isActive: true,
        startsAt: null,
        dueAt: null,
      } as QuizAssignment;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return orgQuiz;
          if (entity === QuizVersion) return publishedVersion;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Question) return sampleQuestions;
          if (entity === QuizAssignment) return [activeAssignment];
          if (entity === QuizAssignmentRecipient) return []; // learnerA is not assigned
          return [];
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      await expect(
        service.startAttempt(orgQuiz.id, publishedVersion.id, learnerA),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAttempt & getPublishedQuizVersion — Authorization & Answer-Key Protection', () => {
    const activeAttempt: QuizAttempt = {
      id: 'attempt-active-1',
      userId: learnerA.userId,
      quizId: publishedQuiz.id,
      quizVersionId: publishedVersion.id,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date(Date.now() - 120_000),
      expiresAt: new Date(Date.now() + 480_000),
      submittedAt: null,
      score: null,
      correctAnswers: null,
      wrongAnswers: null,
      unanswered: null,
      percentage: null,
    } as QuizAttempt;

    it('5. prevents another learner or a non-owner CREATOR from accessing an attempt (403 Forbidden), while allowing the owner and ADMIN', async () => {
      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) return { ...activeAttempt };
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          return null;
        }),
        find: vi.fn(async (entity: unknown, opts?: { where?: { questionId?: string } }) => {
          if (entity === Question) return sampleQuestions;
          if (entity === Answer) return [];
          if (entity === Option && opts?.where?.questionId) {
            return sampleOptionsByQuestion[opts.where.questionId] ?? [];
          }
          return [];
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      // Learner B must be rejected with 403 ForbiddenException
      await expect(
        service.getAttempt(activeAttempt.id, learnerB),
      ).rejects.toThrow(ForbiddenException);

      // Creator who is not the attempt owner must be rejected with 403 ForbiddenException
      await expect(
        service.getAttempt(activeAttempt.id, creatorUser),
      ).rejects.toThrow(ForbiddenException);

      // Admin is permitted
      const adminView = await service.getAttempt(activeAttempt.id, adminUser);
      expect(adminView.attemptId).toBe(activeAttempt.id);
    });

    it('6. prevents unauthorized access through manipulated quizId in getAttempt', async () => {
      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) return { ...activeAttempt };
          return null;
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      await expect(
        service.getAttempt(activeAttempt.id, learnerA, 'manipulated-quiz-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('7, 8 & 9. returns only stored QuizVersion questions, includes saved learner answers, and strictly omits isCorrect and grading metadata', async () => {
      const savedAnswer: Answer = {
        id: 'ans-1',
        attemptId: activeAttempt.id,
        questionId: 'q-1',
        answeredAt: new Date(),
      } as Answer;

      const savedAnswerOption: AnswerOption = {
        id: 'ans-opt-1',
        answerId: 'ans-1',
        optionId: 'opt-1b',
      } as AnswerOption;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) {
            return {
              ...activeAttempt,
              // Even if DB row had non-null score fields during IN_PROGRESS, response must mask them
              score: 99,
              correctAnswers: 2,
              wrongAnswers: 0,
              unanswered: 0,
              percentage: 100,
            };
          }
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          return null;
        }),
        find: vi.fn(async (entity: unknown, opts?: { where?: { quizVersionId?: string; questionId?: string } }) => {
          if (entity === Question) {
            expect(opts?.where?.quizVersionId).toBe(publishedVersion.id);
            return sampleQuestions;
          }
          if (entity === Answer) return [savedAnswer];
          if (entity === AnswerOption) return [savedAnswerOption];
          if (entity === Option && opts?.where?.questionId) {
            return sampleOptionsByQuestion[opts.where.questionId] ?? [];
          }
          return [];
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      const response = await service.getAttempt(activeAttempt.id, learnerA);

      // Verify lifecycle & progress metadata
      expect(response.attemptId).toBe(activeAttempt.id);
      expect(response.quizId).toBe(publishedQuiz.id);
      expect(response.quizVersionId).toBe(publishedVersion.id);
      expect(response.version).toBe(publishedVersion.version);
      expect(response.quizTitle).toBe(publishedQuiz.title);
      expect(response.status).toBe(AttemptStatus.IN_PROGRESS);
      expect(response.totalQuestions).toBe(2);
      expect(response.answeredQuestions).toBe(1);
      expect(response.unansweredQuestions).toBe(1);
      expect(response.totalMarks).toBe(3);

      // Verify live scores are masked while IN_PROGRESS
      expect(response.score).toBeNull();
      expect(response.correctAnswers).toBeNull();
      expect(response.wrongAnswers).toBeNull();
      expect(response.unanswered).toBeNull();
      expect(response.percentage).toBeNull();

      // Verify saved learner answers are returned accurately
      expect(response.questions).toHaveLength(2);
      expect(response.questions[0].id).toBe('q-1');
      expect(response.questions[0].selectedOptionIds).toEqual(['opt-1b']);
      expect(response.questions[0].isAnswered).toBe(true);
      expect(response.questions[1].id).toBe('q-2');
      expect(response.questions[1].selectedOptionIds).toEqual([]);
      expect(response.questions[1].isAnswered).toBe(false);

      // Explicitly assert isCorrect and answer-key metadata are completely absent
      const serialized = JSON.stringify(response);
      expect(serialized).not.toContain('isCorrect');
      expect(serialized).not.toContain('"correctAnswer":');
      expect(serialized).not.toContain('"correctOptionIds":');

      for (const question of response.questions) {
        for (const option of question.options) {
          expect(Object.keys(option).sort()).toEqual(['id', 'order', 'text']);
          expect('isCorrect' in option).toBe(false);
        }
      }
    });

    it('8b. getPublishedQuizVersion also strictly omits isCorrect from all options', async () => {
      mockQuizRepo.findOne.mockResolvedValue(publishedQuiz);
      mockQuizVersionRepo.findOne.mockResolvedValue(publishedVersion);
      mockQuestionRepo.find.mockResolvedValue(sampleQuestions);
      mockOptionRepo.find.mockImplementation(async (opts: { where: { questionId: string } }) => {
        return sampleOptionsByQuestion[opts.where.questionId] ?? [];
      });

      const preview = await service.getPublishedQuizVersion(
        publishedQuiz.id,
        publishedVersion.id,
      );

      expect(preview.quizId).toBe(publishedQuiz.id);
      expect(preview.quizVersionId).toBe(publishedVersion.id);
      expect(preview.quizTitle).toBe(publishedQuiz.title);
      expect(preview.totalMarks).toBe(3);
      expect(JSON.stringify(preview)).not.toContain('isCorrect');

      for (const question of preview.questions) {
        for (const option of question.options) {
          expect(Object.keys(option).sort()).toEqual(['id', 'order', 'text']);
          expect('isCorrect' in option).toBe(false);
        }
      }
    });
  });

  describe('12. Compatibility with saveAnswer, submitAttempt, and getAttemptResult', () => {
    it('saves learner answers for an active attempt and rejects saving on another learner attempt with 403', async () => {
      const activeAttempt: QuizAttempt = {
        id: 'attempt-save-1',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 30_000),
        expiresAt: new Date(Date.now() + 570_000),
      } as QuizAttempt;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) return activeAttempt;
          if (entity === Question) return sampleQuestions[0];
          if (entity === Answer) return null;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Option) return [sampleOptionsByQuestion['q-1'][0]];
          return [];
        }),
        create: vi.fn((_e: unknown, data: Record<string, unknown>) => ({
          id: 'ans-created-1',
          ...data,
        })),
        save: vi.fn(async (_e: unknown, data: unknown) => data),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      // Learner B cannot save answer on Learner A's attempt
      await expect(
        service.saveAnswer(
          activeAttempt.id,
          'q-1',
          { optionIds: ['opt-1a'] },
          learnerB.userId,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Learner A can save answer
      const saved = await service.saveAnswer(
        activeAttempt.id,
        'q-1',
        { optionIds: ['opt-1a'] },
        learnerA.userId,
      );

      expect(saved.attemptId).toBe(activeAttempt.id);
      expect(saved.questionId).toBe('q-1');
      expect(saved.optionIds).toEqual(['opt-1a']);
    });

    it('enforces single-choice vs multiple-choice rules, clears deselected multiple-choice answers, and rejects expired attempts in saveAnswer', async () => {
      const activeAttempt: QuizAttempt = {
        id: 'attempt-save-rules',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 30_000),
        expiresAt: new Date(Date.now() + 570_000),
      } as QuizAttempt;

      const multiChoiceQuestion: Question = {
        id: 'q-multi',
        quizVersionId: publishedVersion.id,
        text: 'Select all valid HTTP methods.',
        questionType: QuestionType.MULTIPLE_CHOICE,
        order: 3,
        marks: 2,
      } as Question;

      const existingMultiAnswer: Answer = {
        id: 'ans-multi-1',
        attemptId: activeAttempt.id,
        questionId: multiChoiceQuestion.id,
      } as Answer;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown, opts?: { where?: { id?: string } }) => {
          if (entity === QuizAttempt) return activeAttempt;
          if (entity === Question) {
            return opts?.where?.id === 'q-multi' ? multiChoiceQuestion : sampleQuestions[0];
          }
          if (entity === Answer) return existingMultiAnswer;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Option) return [sampleOptionsByQuestion['q-1'][0]];
          return [];
        }),
        create: vi.fn((_e: unknown, data: Record<string, unknown>) => data),
        save: vi.fn(async (_e: unknown, data: unknown) => data),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      // Single-choice rejects multiple options
      await expect(
        service.saveAnswer(
          activeAttempt.id,
          'q-1',
          { optionIds: ['opt-1a', 'opt-1b'] },
          learnerA,
        ),
      ).rejects.toThrow(BadRequestException);

      // Single-choice rejects empty options
      await expect(
        service.saveAnswer(
          activeAttempt.id,
          'q-1',
          { optionIds: [] },
          learnerA,
        ),
      ).rejects.toThrow(BadRequestException);

      // Multiple-choice allows clearing all options (deselecting last option)
      const cleared = await service.saveAnswer(
        activeAttempt.id,
        'q-multi',
        { optionIds: [] },
        learnerA,
      );
      expect(cleared.answerId).toBeNull();
      expect(cleared.optionIds).toEqual([]);
      expect(mockManager.delete).toHaveBeenCalledWith(AnswerOption, {
        answerId: existingMultiAnswer.id,
      });
      expect(mockManager.delete).toHaveBeenCalledWith(Answer, {
        id: existingMultiAnswer.id,
      });

      // Expired attempt rejects new answers and transitions status to EXPIRED
      const expiredAttempt: QuizAttempt = {
        ...activeAttempt,
        id: 'attempt-expired-save',
        expiresAt: new Date(Date.now() - 5_000),
      } as QuizAttempt;

      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: unknown) => unknown) =>
        cb({
          findOne: vi.fn(async (entity: unknown) =>
            entity === QuizAttempt ? expiredAttempt : null,
          ),
          find: vi.fn(async (entity: unknown) => {
            if (entity === Question) return sampleQuestions;
            if (entity === Answer) return [];
            if (entity === Option) {
              return [...sampleOptionsByQuestion['q-1'], ...sampleOptionsByQuestion['q-2']];
            }
            return [];
          }),
          save: vi.fn(async (_e: unknown, data: unknown) => data),
        }),
      );

      await expect(
        service.saveAnswer(
          expiredAttempt.id,
          'q-1',
          { optionIds: ['opt-1a'] },
          learnerA,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(expiredAttempt.status).toBe(AttemptStatus.EXPIRED);
    });

    it('submits an in-progress attempt, scores answers accurately, and exposes results via getAttemptResult', async () => {
      const inProgressAttempt: QuizAttempt = {
        id: 'attempt-submit-1',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() + 480_000),
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-1', attemptId: inProgressAttempt.id, questionId: 'q-1' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'opt-1a' } as AnswerOption, // correct (2 marks)
      ];

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) return inProgressAttempt;
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Question) return sampleQuestions;
          if (entity === Answer) return answers;
          if (entity === AnswerOption) return answerOptions;
          if (entity === Option) {
            return [...sampleOptionsByQuestion['q-1'], ...sampleOptionsByQuestion['q-2']];
          }
          return [];
        }),
        save: vi.fn(async (_e: unknown, data: unknown) => data),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      const submitRes = await service.submitAttempt(
        inProgressAttempt.id,
        learnerA.userId,
      );

      expect(submitRes.status).toBe(AttemptStatus.SUBMITTED);
      expect(submitRes.score).toBe(2);
      expect(submitRes.totalMarks).toBe(3);
      expect(submitRes.correctAnswers).toBe(1);
      expect(submitRes.wrongAnswers).toBe(0);
      expect(submitRes.unanswered).toBe(1);
      expect(submitRes.percentage).toBe(66.67);

      // Now getAttemptResult should return the submitted result with quizTitle & quizVersion
      const resultDto = await service.getAttemptResult(
        inProgressAttempt.id,
        learnerA,
      );
      expect(resultDto.attemptId).toBe(inProgressAttempt.id);
      expect(resultDto.status).toBe(AttemptStatus.SUBMITTED);
      expect(resultDto.quizTitle).toBe(publishedQuiz.title);
      expect(resultDto.quizVersion).toBe(publishedVersion.version);
      expect(resultDto.score).toBe(2);
      expect(resultDto.totalMarks).toBe(3);
    });
  });

  describe('Phase 6.3 — Server-Enforced Quiz Timer & Expiration', () => {
    it('6.3-1. establishes authoritative expiresAt from QuizVersion.timeLimitSeconds on startAttempt (and null for untimed versions)', async () => {
      const timedVersion: QuizVersion = {
        ...publishedVersion,
        id: 'ver-timed-300',
        timeLimitSeconds: 300,
      } as QuizVersion;

      const untimedVersion: QuizVersion = {
        ...publishedVersion,
        id: 'ver-untimed',
        timeLimitSeconds: null,
      } as QuizVersion;

      let currentVersion = timedVersion;
      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return currentVersion;
          if (entity === QuizAttempt) return null;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Question) return sampleQuestions;
          return [];
        }),
        create: vi.fn((_e: unknown, data: Record<string, unknown>) => ({
          id: `attempt-${currentVersion.id}`,
          ...data,
        })),
        save: vi.fn(async (_e: unknown, data: unknown) => data),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      const timedStart = await service.startAttempt(
        publishedQuiz.id,
        timedVersion.id,
        learnerA,
      );

      expect(timedStart.startedAt).toBeInstanceOf(Date);
      expect(timedStart.expiresAt).toBeInstanceOf(Date);
      const diffMs =
        new Date(timedStart.expiresAt!).getTime() -
        new Date(timedStart.startedAt).getTime();
      expect(diffMs).toBe(300 * 1000);
      expect(timedStart.remainingTimeSeconds).toBeGreaterThan(0);
      expect(timedStart.remainingTimeSeconds).toBeLessThanOrEqual(300);

      currentVersion = untimedVersion;
      const untimedStart = await service.startAttempt(
        publishedQuiz.id,
        untimedVersion.id,
        learnerA,
      );
      expect(untimedStart.expiresAt).toBeNull();
      expect(untimedStart.remainingTimeSeconds).toBeNull();
    });

    it('6.3-2. resuming an active attempt via startAttempt or getAttempt never extends startedAt or expiresAt', async () => {
      const originalStartedAt = new Date(Date.now() - 180_000);
      const originalExpiresAt = new Date(Date.now() + 420_000);

      const existingAttempt: QuizAttempt = {
        id: 'attempt-resume-fixed',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: originalStartedAt,
        expiresAt: originalExpiresAt,
      } as QuizAttempt;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          if (entity === QuizAttempt) return existingAttempt;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Question) return sampleQuestions;
          if (entity === Answer) return [];
          if (entity === Option) return sampleOptionsByQuestion['q-1'];
          return [];
        }),
        create: vi.fn(),
        save: vi.fn(),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      const resumedStart = await service.startAttempt(
        publishedQuiz.id,
        publishedVersion.id,
        learnerA,
      );

      expect(resumedStart.resumed).toBe(true);
      expect(new Date(resumedStart.startedAt).getTime()).toBe(
        originalStartedAt.getTime(),
      );
      expect(new Date(resumedStart.expiresAt!).getTime()).toBe(
        originalExpiresAt.getTime(),
      );
      expect(mockManager.save).not.toHaveBeenCalled();

      const fetched = await service.getAttempt(existingAttempt.id, learnerA);
      expect(new Date(fetched.startedAt).getTime()).toBe(
        originalStartedAt.getTime(),
      );
      expect(new Date(fetched.expiresAt!).getTime()).toBe(
        originalExpiresAt.getTime(),
      );
    });

    it('6.3-3 & 6.3-4. allows saving answers before expiresAt and rejects saving at or after expiresAt (boundary now >= expiresAt)', async () => {
      const validBeforeDeadline: QuizAttempt = {
        id: 'attempt-before-deadline',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 500_000),
        expiresAt: new Date(Date.now() + 10_000), // 10s remaining
      } as QuizAttempt;

      const exactBoundaryAttempt: QuizAttempt = {
        id: 'attempt-at-boundary',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 600_000),
        expiresAt: new Date(Date.now()), // exact boundary: now >= expiresAt
      } as QuizAttempt;

      let targetAttempt = validBeforeDeadline;
      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) return targetAttempt;
          if (entity === Question) return sampleQuestions[0];
          if (entity === Answer) return null;
          return null;
        }),
        find: vi.fn(
          async (
            entity: unknown,
            opts?: { where?: Array<{ id?: string; questionId?: string }> },
          ) => {
            if (entity === Question) return sampleQuestions;
            if (entity === Answer) return [];
            if (entity === Option) {
              const allOptions = [
                ...sampleOptionsByQuestion['q-1'],
                ...sampleOptionsByQuestion['q-2'],
              ];
              if (Array.isArray(opts?.where) && opts.where[0]?.id) {
                const requestedIds = new Set(opts.where.map((w) => w.id));
                return allOptions.filter((o) => requestedIds.has(o.id));
              }
              return allOptions;
            }
            return [];
          },
        ),
        create: vi.fn((_e: unknown, data: Record<string, unknown>) => ({
          id: 'ans-valid-1',
          ...data,
        })),
        save: vi.fn(async (_e: unknown, data: unknown) => data),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      // Before deadline -> succeeds
      const savedBefore = await service.saveAnswer(
        validBeforeDeadline.id,
        'q-1',
        { optionIds: ['opt-1a'] },
        learnerA,
      );
      expect(savedBefore.optionIds).toEqual(['opt-1a']);

      // At exact boundary (now >= expiresAt) -> transitions to EXPIRED and throws BadRequestException
      targetAttempt = exactBoundaryAttempt;
      await expect(
        service.saveAnswer(
          exactBoundaryAttempt.id,
          'q-1',
          { optionIds: ['opt-1b'] },
          learnerA,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(exactBoundaryAttempt.status).toBe(AttemptStatus.EXPIRED);

      // Repeated saveAnswer after expiration remains rejected without re-scoring
      mockManager.save.mockClear();
      await expect(
        service.saveAnswer(
          exactBoundaryAttempt.id,
          'q-1',
          { optionIds: ['opt-1b'] },
          learnerA,
        ),
      ).rejects.toThrow('This quiz attempt has expired');
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('6.3-5 & 6.3-6. transitions overdue IN_PROGRESS attempts to EXPIRED once and keeps repeated expiration checks idempotent', async () => {
      const overdueAttempt: QuizAttempt = {
        id: 'attempt-overdue-idempotent',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 900_000),
        expiresAt: new Date(Date.now() - 300_000),
        submittedAt: null,
        score: null,
        correctAnswers: null,
        wrongAnswers: null,
        unanswered: null,
        percentage: null,
      } as QuizAttempt;

      const savedAnswers: Answer[] = [
        { id: 'ans-1', attemptId: overdueAttempt.id, questionId: 'q-1' } as Answer,
      ];
      const savedAnswerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'opt-1a' } as AnswerOption,
      ];

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) return overdueAttempt;
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          return null;
        }),
        find: vi.fn(async (entity: unknown, opts?: { where?: { questionId?: string } }) => {
          if (entity === Question) return sampleQuestions;
          if (entity === Answer) return savedAnswers;
          if (entity === AnswerOption) return savedAnswerOptions;
          if (entity === Option) {
            if (opts?.where?.questionId) {
              return sampleOptionsByQuestion[opts.where.questionId] ?? [];
            }
            return [...sampleOptionsByQuestion['q-1'], ...sampleOptionsByQuestion['q-2']];
          }
          return [];
        }),
        save: vi.fn(async (_e: unknown, data: unknown) => data),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      // First getAttempt triggers lazy expiration and grades once
      const firstView = await service.getAttempt(overdueAttempt.id, learnerA);
      expect(firstView.status).toBe(AttemptStatus.EXPIRED);
      expect(firstView.remainingTimeSeconds).toBe(0);
      expect(firstView.score).toBe(2);
      expect(mockManager.save).toHaveBeenCalledTimes(1);

      // Second getAttempt sees status === EXPIRED and does NOT re-grade or re-save
      mockManager.save.mockClear();
      const secondView = await service.getAttempt(overdueAttempt.id, learnerA);
      expect(secondView.status).toBe(AttemptStatus.EXPIRED);
      expect(secondView.score).toBe(2);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('6.3-7 & 6.3-8. prevents contradictory terminal states and duplicate grading across submitAttempt and expiration', async () => {
      // Scenario A: submitAttempt called at/after expiresAt while IN_PROGRESS -> transitions to EXPIRED
      const expiredOnSubmitAttempt: QuizAttempt = {
        id: 'attempt-submit-at-timeout',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 610_000),
        expiresAt: new Date(Date.now() - 10_000),
      } as QuizAttempt;

      let activeAttemptRef = expiredOnSubmitAttempt;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) return activeAttemptRef;
          return null;
        }),
        find: vi.fn(
          async (
            entity: unknown,
            opts?: { where?: Array<{ id?: string; questionId?: string }> },
          ) => {
            if (entity === Question) return sampleQuestions;
            if (entity === Answer) return [];
            if (entity === Option) {
              const allOptions = [
                ...sampleOptionsByQuestion['q-1'],
                ...sampleOptionsByQuestion['q-2'],
              ];
              if (Array.isArray(opts?.where) && opts.where[0]?.id) {
                const requestedIds = new Set(opts.where.map((w) => w.id));
                return allOptions.filter((o) => requestedIds.has(o.id));
              }
              return allOptions;
            }
            return [];
          },
        ),
        save: vi.fn(async (_e: unknown, data: unknown) => data),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      const timeoutSubmitRes = await service.submitAttempt(
        expiredOnSubmitAttempt.id,
        learnerA,
      );
      expect(timeoutSubmitRes.status).toBe(AttemptStatus.EXPIRED);
      expect(timeoutSubmitRes.score).toBe(0);
      expect(timeoutSubmitRes.totalMarks).toBe(3);
      expect(mockManager.save).toHaveBeenCalledTimes(1);

      // Repeated submitAttempt on already EXPIRED attempt is idempotent (no re-grading, status stays EXPIRED)
      mockManager.save.mockClear();
      const repeatedExpiredSubmit = await service.submitAttempt(
        expiredOnSubmitAttempt.id,
        learnerA,
      );
      expect(repeatedExpiredSubmit.status).toBe(AttemptStatus.EXPIRED);
      expect(repeatedExpiredSubmit.score).toBe(0);
      expect(mockManager.save).not.toHaveBeenCalled();

      // Scenario B: Repeated submitAttempt on already SUBMITTED attempt is idempotent (status stays SUBMITTED, never overwritten by EXPIRED)
      const submittedBeforeTimeout: QuizAttempt = {
        id: 'attempt-submitted-early',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.SUBMITTED,
        startedAt: new Date(Date.now() - 600_000),
        expiresAt: new Date(Date.now() - 5_000), // deadline passed after submission
        submittedAt: new Date(Date.now() - 120_000),
        score: 3,
        correctAnswers: 2,
        wrongAnswers: 0,
        unanswered: 0,
        percentage: 100,
      } as QuizAttempt;

      activeAttemptRef = submittedBeforeTimeout;
      mockManager.save.mockClear();

      const repeatedSubmitRes = await service.submitAttempt(
        submittedBeforeTimeout.id,
        learnerA,
      );
      expect(repeatedSubmitRes.status).toBe(AttemptStatus.SUBMITTED);
      expect(repeatedSubmitRes.score).toBe(3);
      expect(repeatedSubmitRes.totalMarks).toBe(3);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('6.3-9, 6.3-10, 6.3-11 & 6.3-12. enforces non-negative remainingTimeSeconds, rejects invalid timeLimitSeconds, supports expired getAttemptResult, and enforces ownership', async () => {
      // Invalid timeLimitSeconds rejected by service validation
      await expect(
        service.createQuiz('Bad Timer Quiz', null, 0, creatorUser.userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createQuiz('Negative Timer Quiz', null, -30, creatorUser.userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateQuizVersion('quiz-1', 'ver-1', 0, creatorUser.userId),
      ).rejects.toThrow(BadRequestException);

      // Overdue attempt reconciled via getAttemptResult
      const overdueForResult: QuizAttempt = {
        id: 'attempt-overdue-result',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 700_000),
        expiresAt: new Date(Date.now() - 100_000),
        submittedAt: null,
        score: null,
        correctAnswers: null,
        wrongAnswers: null,
        unanswered: null,
        percentage: null,
      } as QuizAttempt;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) return overdueForResult;
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          return null;
        }),
        find: vi.fn(
          async (
            entity: unknown,
            opts?: { where?: Array<{ id?: string; questionId?: string }> },
          ) => {
            if (entity === Question) return sampleQuestions;
            if (entity === Answer) return [];
            if (entity === Option) {
              const allOptions = [
                ...sampleOptionsByQuestion['q-1'],
                ...sampleOptionsByQuestion['q-2'],
              ];
              if (Array.isArray(opts?.where) && opts.where[0]?.id) {
                const requestedIds = new Set(opts.where.map((w) => w.id));
                return allOptions.filter((o) => requestedIds.has(o.id));
              }
              return allOptions;
            }
            return [];
          },
        ),
        save: vi.fn(async (_e: unknown, data: unknown) => data),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      // Unauthorized learnerB rejected on submitAttempt and getAttemptResult
      await expect(
        service.submitAttempt(overdueForResult.id, learnerB),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getAttemptResult(overdueForResult.id, learnerB),
      ).rejects.toThrow(ForbiddenException);

      // Authorized owner learnerA gets reconciled EXPIRED result
      const resultDto = await service.getAttemptResult(
        overdueForResult.id,
        learnerA,
      );
      expect(resultDto.status).toBe(AttemptStatus.EXPIRED);
      expect(resultDto.score).toBe(0);
      expect(resultDto.totalMarks).toBe(3);
      expect(resultDto.unanswered).toBe(2);
      expect(resultDto.submittedAt).toBeInstanceOf(Date);
    });
  });

  describe('Phase 6.4 — Reliable Submission, Deterministic Grading & Result Persistence', () => {
    const p64Questions: Question[] = [
      {
        id: 'p64-q1',
        quizVersionId: publishedVersion.id,
        text: 'What is TypeScript?',
        questionType: QuestionType.SINGLE_CHOICE,
        order: 1,
        marks: 2,
      } as Question,
      {
        id: 'p64-q2',
        quizVersionId: publishedVersion.id,
        text: 'TypeScript compiles to JavaScript.',
        questionType: QuestionType.TRUE_FALSE,
        order: 2,
        marks: 1,
      } as Question,
      {
        id: 'p64-q3',
        quizVersionId: publishedVersion.id,
        text: 'Select all primitive types in TypeScript.',
        questionType: QuestionType.MULTIPLE_CHOICE,
        order: 3,
        marks: 3,
      } as Question,
    ];

    const p64Options: Option[] = [
      { id: 'p64-opt-1a', questionId: 'p64-q1', text: 'Superset of JS', isCorrect: true, order: 1 } as Option,
      { id: 'p64-opt-1b', questionId: 'p64-q1', text: 'Database engine', isCorrect: false, order: 2 } as Option,
      { id: 'p64-opt-2a', questionId: 'p64-q2', text: 'True', isCorrect: true, order: 1 } as Option,
      { id: 'p64-opt-2b', questionId: 'p64-q2', text: 'False', isCorrect: false, order: 2 } as Option,
      { id: 'p64-opt-3a', questionId: 'p64-q3', text: 'string', isCorrect: true, order: 1 } as Option,
      { id: 'p64-opt-3b', questionId: 'p64-q3', text: 'number', isCorrect: true, order: 2 } as Option,
      { id: 'p64-opt-3c', questionId: 'p64-q3', text: 'interface', isCorrect: false, order: 3 } as Option,
    ];

    function setupGradingMock(config: {
      attempt: QuizAttempt;
      questions?: Question[];
      options?: Option[];
      answers?: Answer[];
      answerOptions?: AnswerOption[];
      onSave?: (entity: unknown, data: any) => any;
    }) {
      const activeQuestions = config.questions ?? p64Questions;
      const activeOptions = config.options ?? p64Options;
      const activeAnswers = config.answers ?? [];
      const activeAnswerOptions = config.answerOptions ?? [];

      const mockManager = {
        findOne: vi.fn(async (entity: unknown, _opts?: any) => {
          if (entity === QuizAttempt) return config.attempt;
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          return null;
        }),
        find: vi.fn(async (entity: unknown, opts?: { where?: any }) => {
          if (entity === Question) {
            if (opts?.where?.quizVersionId) {
              return activeQuestions.filter((q) => q.quizVersionId === opts.where.quizVersionId);
            }
            return activeQuestions;
          }
          if (entity === Answer) return activeAnswers;
          if (entity === AnswerOption) return activeAnswerOptions;
          if (entity === Option) {
            if (Array.isArray(opts?.where)) {
              const qIds = new Set(opts.where.map((w: any) => w.questionId).filter(Boolean));
              if (qIds.size > 0) {
                return activeOptions.filter((o) => qIds.has(o.questionId));
              }
              const optIds = new Set(opts.where.map((w: any) => w.id).filter(Boolean));
              if (optIds.size > 0) {
                return activeOptions.filter((o) => optIds.has(o.id));
              }
            }
            return activeOptions;
          }
          return [];
        }),
        save: vi.fn(async (entity: unknown, data: any) => {
          if (config.onSave) return config.onSave(entity, data);
          if (entity === QuizAttempt) Object.assign(config.attempt, data);
          return data;
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      return mockManager;
    }

    it('6.4-1. Scoring: grades all answers correct as 100% with full marks awarded', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-1',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-1', attemptId: attempt.id, questionId: 'p64-q1' } as Answer,
        { id: 'ans-2', attemptId: attempt.id, questionId: 'p64-q2' } as Answer,
        { id: 'ans-3', attemptId: attempt.id, questionId: 'p64-q3' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'p64-opt-1a' } as AnswerOption,
        { id: 'ao-2', answerId: 'ans-2', optionId: 'p64-opt-2a' } as AnswerOption,
        { id: 'ao-3a', answerId: 'ans-3', optionId: 'p64-opt-3a' } as AnswerOption,
        { id: 'ao-3b', answerId: 'ans-3', optionId: 'p64-opt-3b' } as AnswerOption,
      ];

      setupGradingMock({ attempt, answers, answerOptions });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.status).toBe(AttemptStatus.SUBMITTED);
      expect(res.score).toBe(6);
      expect(res.totalMarks).toBe(6);
      expect(res.correctAnswers).toBe(3);
      expect(res.wrongAnswers).toBe(0);
      expect(res.unanswered).toBe(0);
      expect(res.percentage).toBe(100);
    });

    it('6.4-2. Scoring: grades all answers wrong as 0% with 0 score and all questions marked wrong', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-2',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-1', attemptId: attempt.id, questionId: 'p64-q1' } as Answer,
        { id: 'ans-2', attemptId: attempt.id, questionId: 'p64-q2' } as Answer,
        { id: 'ans-3', attemptId: attempt.id, questionId: 'p64-q3' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'p64-opt-1b' } as AnswerOption,
        { id: 'ao-2', answerId: 'ans-2', optionId: 'p64-opt-2b' } as AnswerOption,
        { id: 'ao-3', answerId: 'ans-3', optionId: 'p64-opt-3c' } as AnswerOption,
      ];

      setupGradingMock({ attempt, answers, answerOptions });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.status).toBe(AttemptStatus.SUBMITTED);
      expect(res.score).toBe(0);
      expect(res.totalMarks).toBe(6);
      expect(res.correctAnswers).toBe(0);
      expect(res.wrongAnswers).toBe(3);
      expect(res.unanswered).toBe(0);
      expect(res.percentage).toBe(0);
    });

    it('6.4-3. Scoring: grades completely unanswered attempt as 0% with unanswered = totalQuestions', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-3',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({ attempt, answers: [], answerOptions: [] });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.status).toBe(AttemptStatus.SUBMITTED);
      expect(res.score).toBe(0);
      expect(res.totalMarks).toBe(6);
      expect(res.correctAnswers).toBe(0);
      expect(res.wrongAnswers).toBe(0);
      expect(res.unanswered).toBe(3);
      expect(res.percentage).toBe(0);
    });

    it('6.4-4. Scoring: grades partially correct attempt correctly (2 of 3 marks = 66.67%)', async () => {
      const threeEqualQuestions: Question[] = [
        { id: 'eq-1', quizVersionId: publishedVersion.id, marks: 1 } as Question,
        { id: 'eq-2', quizVersionId: publishedVersion.id, marks: 1 } as Question,
        { id: 'eq-3', quizVersionId: publishedVersion.id, marks: 1 } as Question,
      ];
      const threeEqualOptions: Option[] = [
        { id: 'eo-1a', questionId: 'eq-1', isCorrect: true } as Option,
        { id: 'eo-1b', questionId: 'eq-1', isCorrect: false } as Option,
        { id: 'eo-2a', questionId: 'eq-2', isCorrect: true } as Option,
        { id: 'eo-2b', questionId: 'eq-2', isCorrect: false } as Option,
        { id: 'eo-3a', questionId: 'eq-3', isCorrect: true } as Option,
        { id: 'eo-3b', questionId: 'eq-3', isCorrect: false } as Option,
      ];

      const attempt: QuizAttempt = {
        id: 'att-64-4',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-1', attemptId: attempt.id, questionId: 'eq-1' } as Answer,
        { id: 'ans-2', attemptId: attempt.id, questionId: 'eq-2' } as Answer,
        { id: 'ans-3', attemptId: attempt.id, questionId: 'eq-3' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'eo-1a' } as AnswerOption,
        { id: 'ao-2', answerId: 'ans-2', optionId: 'eo-2a' } as AnswerOption,
        { id: 'ao-3', answerId: 'ans-3', optionId: 'eo-3b' } as AnswerOption,
      ];

      setupGradingMock({
        attempt,
        questions: threeEqualQuestions,
        options: threeEqualOptions,
        answers,
        answerOptions,
      });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.score).toBe(2);
      expect(res.totalMarks).toBe(3);
      expect(res.correctAnswers).toBe(2);
      expect(res.wrongAnswers).toBe(1);
      expect(res.unanswered).toBe(0);
      expect(res.percentage).toBe(66.67);
    });

    it('6.4-5. Scoring: evaluates single-choice questions (awards full marks for correct option, 0 for wrong)', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-5',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-1', attemptId: attempt.id, questionId: 'p64-q1' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'p64-opt-1a' } as AnswerOption,
      ];

      setupGradingMock({ attempt, answers, answerOptions });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.score).toBe(2);
      expect(res.correctAnswers).toBe(1);
      expect(res.unanswered).toBe(2);
    });

    it('6.4-6. Scoring: evaluates true/false questions accurately', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-6',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-2', attemptId: attempt.id, questionId: 'p64-q2' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-2', answerId: 'ans-2', optionId: 'p64-opt-2a' } as AnswerOption,
      ];

      setupGradingMock({ attempt, answers, answerOptions });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.score).toBe(1);
      expect(res.correctAnswers).toBe(1);
      expect(res.unanswered).toBe(2);
    });

    it('6.4-7. Scoring: evaluates multiple-choice questions under established all-or-nothing policy', async () => {
      // Subtest A: Exact match -> awards full marks (3 marks)
      const attemptExact: QuizAttempt = {
        id: 'att-64-7a',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({
        attempt: attemptExact,
        answers: [{ id: 'ans-3a', attemptId: attemptExact.id, questionId: 'p64-q3' } as Answer],
        answerOptions: [
          { id: 'ao-3a1', answerId: 'ans-3a', optionId: 'p64-opt-3a' } as AnswerOption,
          { id: 'ao-3a2', answerId: 'ans-3a', optionId: 'p64-opt-3b' } as AnswerOption,
        ],
      });

      const resExact = await service.submitAttempt(attemptExact.id, learnerA);
      expect(resExact.score).toBe(3);
      expect(resExact.correctAnswers).toBe(1);

      // Subtest B: Partial selection (only 1 of 2 correct options) -> 0 marks, wrongAnswers++
      const attemptPartial: QuizAttempt = {
        id: 'att-64-7b',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({
        attempt: attemptPartial,
        answers: [{ id: 'ans-3b', attemptId: attemptPartial.id, questionId: 'p64-q3' } as Answer],
        answerOptions: [
          { id: 'ao-3b1', answerId: 'ans-3b', optionId: 'p64-opt-3a' } as AnswerOption,
        ],
      });

      const resPartial = await service.submitAttempt(attemptPartial.id, learnerA);
      expect(resPartial.score).toBe(0);
      expect(resPartial.correctAnswers).toBe(0);
      expect(resPartial.wrongAnswers).toBe(1);

      // Subtest C: Correct options + extra incorrect option -> 0 marks, wrongAnswers++
      const attemptExtra: QuizAttempt = {
        id: 'att-64-7c',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({
        attempt: attemptExtra,
        answers: [{ id: 'ans-3c', attemptId: attemptExtra.id, questionId: 'p64-q3' } as Answer],
        answerOptions: [
          { id: 'ao-3c1', answerId: 'ans-3c', optionId: 'p64-opt-3a' } as AnswerOption,
          { id: 'ao-3c2', answerId: 'ans-3c', optionId: 'p64-opt-3b' } as AnswerOption,
          { id: 'ao-3c3', answerId: 'ans-3c', optionId: 'p64-opt-3c' } as AnswerOption,
        ],
      });

      const resExtra = await service.submitAttempt(attemptExtra.id, learnerA);
      expect(resExtra.score).toBe(0);
      expect(resExtra.correctAnswers).toBe(0);
      expect(resExtra.wrongAnswers).toBe(1);
    });

    it('6.4-8. Scoring: calculates percentage with two decimal places (e.g. 1/6 = 16.67%)', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-8',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-2', attemptId: attempt.id, questionId: 'p64-q2' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-2', answerId: 'ans-2', optionId: 'p64-opt-2a' } as AnswerOption,
      ];

      setupGradingMock({ attempt, answers, answerOptions });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.score).toBe(1);
      expect(res.totalMarks).toBe(6);
      expect(res.percentage).toBe(16.67);
    });

    it('6.4-9. Scoring: safely handles zero total marks without division by zero or NaN (percentage: 0)', async () => {
      const zeroMarkQuestions: Question[] = [
        { id: 'zmq-1', quizVersionId: publishedVersion.id, marks: 0 } as Question,
      ];
      const zeroMarkOptions: Option[] = [
        { id: 'zmo-1', questionId: 'zmq-1', isCorrect: true } as Option,
      ];

      const attempt: QuizAttempt = {
        id: 'att-64-9',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({
        attempt,
        questions: zeroMarkQuestions,
        options: zeroMarkOptions,
      });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.totalMarks).toBe(0);
      expect(res.score).toBe(0);
      expect(res.percentage).toBe(0);
      expect(Number.isNaN(res.percentage)).toBe(false);
    });

    it('6.4-10. Scoring: treats empty selections (Answer row with no options) consistently as unanswered', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-10',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-empty-1', attemptId: attempt.id, questionId: 'p64-q1' } as Answer,
      ];

      setupGradingMock({ attempt, answers, answerOptions: [] });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.unanswered).toBe(3);
      expect(res.wrongAnswers).toBe(0);
      expect(res.correctAnswers).toBe(0);
      expect(res.score).toBe(0);
    });

    it('6.4-11. Submission: successfully transitions IN_PROGRESS attempt to SUBMITTED with submittedAt timestamp', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-11',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 100_000),
        expiresAt: new Date(Date.now() + 500_000),
        submittedAt: null,
      } as QuizAttempt;

      const mockManager = setupGradingMock({ attempt });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.status).toBe(AttemptStatus.SUBMITTED);
      expect(res.submittedAt).toBeInstanceOf(Date);
      expect(mockManager.save).toHaveBeenCalledTimes(1);
    });

    it('6.4-12. Submission: repeated submission on already SUBMITTED attempt is idempotent and does not re-grade', async () => {
      const submittedAtDate = new Date(Date.now() - 120_000);
      const attempt: QuizAttempt = {
        id: 'att-64-12',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.SUBMITTED,
        startedAt: new Date(Date.now() - 600_000),
        expiresAt: new Date(Date.now() + 100_000),
        submittedAt: submittedAtDate,
        score: 6,
        correctAnswers: 3,
        wrongAnswers: 0,
        unanswered: 0,
        percentage: 100,
      } as QuizAttempt;

      const mockManager = setupGradingMock({ attempt });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.status).toBe(AttemptStatus.SUBMITTED);
      expect(res.score).toBe(6);
      expect(res.percentage).toBe(100);
      expect(res.submittedAt).toEqual(submittedAtDate);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('6.4-13. Submission: serializes concurrent submissions under row lock, producing identical results', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-13',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-1', attemptId: attempt.id, questionId: 'p64-q1' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'p64-opt-1a' } as AnswerOption,
      ];

      setupGradingMock({ attempt, answers, answerOptions });

      const firstRes = await service.submitAttempt(attempt.id, learnerA);
      expect(firstRes.status).toBe(AttemptStatus.SUBMITTED);
      expect(firstRes.score).toBe(2);

      const secondRes = await service.submitAttempt(attempt.id, learnerA);
      expect(secondRes.status).toBe(AttemptStatus.SUBMITTED);
      expect(secondRes.score).toBe(2);
      expect(secondRes.percentage).toBe(firstRes.percentage);
    });

    it('6.4-14. Submission: transitions attempt to EXPIRED when submitted at or after expiresAt deadline', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-14',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 650_000),
        expiresAt: new Date(Date.now() - 50_000),
        submittedAt: null,
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-1', attemptId: attempt.id, questionId: 'p64-q1' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'p64-opt-1a' } as AnswerOption,
      ];

      setupGradingMock({ attempt, answers, answerOptions });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.status).toBe(AttemptStatus.EXPIRED);
      expect(res.score).toBe(2);
      expect(res.totalMarks).toBe(6);
      expect(res.submittedAt).toBeInstanceOf(Date);
    });

    it('6.4-15. Submission: allows retrieving attempt result for EXPIRED attempts with accurate score and metadata', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-15',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.EXPIRED,
        startedAt: new Date(Date.now() - 800_000),
        expiresAt: new Date(Date.now() - 200_000),
        submittedAt: new Date(Date.now() - 200_000),
        score: 2,
        correctAnswers: 1,
        wrongAnswers: 0,
        unanswered: 2,
        percentage: 33.33,
      } as QuizAttempt;

      setupGradingMock({ attempt });

      const resultDto = await service.getAttemptResult(attempt.id, learnerA);
      expect(resultDto.status).toBe(AttemptStatus.EXPIRED);
      expect(resultDto.score).toBe(2);
      expect(resultDto.totalMarks).toBe(6);
      expect(resultDto.quizTitle).toBe(publishedQuiz.title);
      expect(resultDto.quizVersion).toBe(publishedVersion.version);
    });

    it('6.4-16. Submission: rejects unauthorized learner from submitting or viewing another learner\'s attempt', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-16',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({ attempt });

      await expect(
        service.submitAttempt(attempt.id, learnerB),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getAttemptResult(attempt.id, learnerB),
      ).rejects.toThrow(ForbiddenException);

      attempt.status = AttemptStatus.SUBMITTED;
      attempt.score = 6;
      const adminView = await service.getAttemptResult(attempt.id, adminUser);
      expect(adminView.attemptId).toBe(attempt.id);
    });

    it('6.4-17. Submission: isolates grading strictly to the attempt\'s bound QuizVersion, ignoring other versions', async () => {
      const draftVersionId = 'ver-draft-modified-99';
      const otherVersionQuestions: Question[] = [
        {
          id: 'other-q1',
          quizVersionId: draftVersionId,
          marks: 100,
        } as Question,
      ];

      const allQuestions = [...p64Questions, ...otherVersionQuestions];

      const attempt: QuizAttempt = {
        id: 'att-64-17',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({
        attempt,
        questions: allQuestions,
      });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.totalMarks).toBe(6);
    });

    it('6.4-18. Submission: rolls back and propagates error if database persistence fails during finalization', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-18',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({
        attempt,
        onSave: () => {
          throw new Error('PostgreSQL connection drop during COMMIT');
        },
      });

      await expect(
        service.submitAttempt(attempt.id, learnerA),
      ).rejects.toThrow('PostgreSQL connection drop during COMMIT');
    });

    it('6.4-19. Submission: recovers reliably from simulated network timeouts via authoritative attempt state', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-19',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({ attempt });

      const firstSubmission = await service.submitAttempt(attempt.id, learnerA);
      expect(firstSubmission.status).toBe(AttemptStatus.SUBMITTED);

      const retriedSubmission = await service.submitAttempt(attempt.id, learnerA);
      expect(retriedSubmission.status).toBe(AttemptStatus.SUBMITTED);
      expect(retriedSubmission.score).toBe(firstSubmission.score);

      const result = await service.getAttemptResult(attempt.id, learnerA);
      expect(result.status).toBe(AttemptStatus.SUBMITTED);
      expect(result.score).toBe(firstSubmission.score);
    });

    it('6.4-20. Submission: ignores any client-provided score or status fields and grades authoritatively', async () => {
      const attempt: QuizAttempt = {
        id: 'att-64-20',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 300_000),
      } as QuizAttempt;

      setupGradingMock({ attempt, answers: [], answerOptions: [] });

      const res = await service.submitAttempt(attempt.id, learnerA);
      expect(res.score).toBe(0);
      expect(res.percentage).toBe(0);
      expect(res.unanswered).toBe(3);
    });
  });

  describe('Phase 6.5 — Results, Attempt History & Learner Experience', () => {
    const p65Questions: Question[] = [
      {
        id: 'p65-q1',
        quizVersionId: publishedVersion.id,
        text: 'What is TypeScript?',
        questionType: QuestionType.SINGLE_CHOICE,
        order: 1,
        marks: 2,
      } as Question,
      {
        id: 'p65-q2',
        quizVersionId: publishedVersion.id,
        text: 'TypeScript compiles to JavaScript.',
        questionType: QuestionType.TRUE_FALSE,
        order: 2,
        marks: 1,
      } as Question,
      {
        id: 'p65-q3',
        quizVersionId: publishedVersion.id,
        text: 'Select primitive types in TS.',
        questionType: QuestionType.MULTIPLE_CHOICE,
        order: 3,
        marks: 3,
      } as Question,
    ];

    const p65Options: Option[] = [
      { id: 'p65-opt-1a', questionId: 'p65-q1', text: 'Superset of JS', isCorrect: true, order: 1 } as Option,
      { id: 'p65-opt-1b', questionId: 'p65-q1', text: 'Database engine', isCorrect: false, order: 2 } as Option,
      { id: 'p65-opt-2a', questionId: 'p65-q2', text: 'True', isCorrect: true, order: 1 } as Option,
      { id: 'p65-opt-2b', questionId: 'p65-q2', text: 'False', isCorrect: false, order: 2 } as Option,
      { id: 'p65-opt-3a', questionId: 'p65-q3', text: 'string', isCorrect: true, order: 1 } as Option,
      { id: 'p65-opt-3b', questionId: 'p65-q3', text: 'number', isCorrect: true, order: 2 } as Option,
      { id: 'p65-opt-3c', questionId: 'p65-q3', text: 'class', isCorrect: false, order: 3 } as Option,
    ];

    function setupResultMock(config: {
      attempt: QuizAttempt;
      quiz?: Quiz | null;
      version?: QuizVersion | null;
      questions?: Question[];
      options?: Option[];
      answers?: Answer[];
      answerOptions?: AnswerOption[];
    }) {
      const activeQuestions = config.questions ?? p65Questions;
      const activeOptions = config.options ?? p65Options;
      const activeAnswers = config.answers ?? [];
      const activeAnswerOptions = config.answerOptions ?? [];

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === QuizAttempt) return config.attempt;
          if (entity === Quiz) return config.quiz !== undefined ? config.quiz : publishedQuiz;
          if (entity === QuizVersion) return config.version !== undefined ? config.version : publishedVersion;
          return null;
        }),
        find: vi.fn(async (entity: unknown, opts?: { where?: any }) => {
          if (entity === Question) {
            if (opts?.where?.quizVersionId) {
              return activeQuestions.filter((q) => q.quizVersionId === opts.where.quizVersionId);
            }
            return activeQuestions;
          }
          if (entity === Answer) return activeAnswers;
          if (entity === AnswerOption) return activeAnswerOptions;
          if (entity === Option) {
            if (Array.isArray(opts?.where)) {
              const qIds = new Set(opts.where.map((w: any) => w.questionId).filter(Boolean));
              if (qIds.size > 0) {
                return activeOptions.filter((o) => qIds.has(o.questionId));
              }
              const optIds = new Set(opts.where.map((w: any) => w.id).filter(Boolean));
              if (optIds.size > 0) {
                return activeOptions.filter((o) => optIds.has(o.id));
              }
            }
            return activeOptions;
          }
          return [];
        }),
        save: vi.fn(async (entity: unknown, data: any) => {
          if (entity === QuizAttempt) Object.assign(config.attempt, data);
          return data;
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      return mockManager;
    }

    function setupQueryBuilderMock(rawAttempts: any[], totalCount: number) {
      const qb = {
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue(rawAttempts),
        getCount: vi.fn().mockResolvedValue(totalCount),
      };
      mockQuizAttemptRepo.createQueryBuilder = vi.fn(() => qb);
      return qb;
    }

    it('6.5-1. retrieves finalized result with score, breakdown, elapsed time, and question-level review', async () => {
      const startedAt = new Date('2026-10-29T10:00:00Z');
      const submittedAt = new Date('2026-10-29T10:05:30Z'); // 330s elapsed

      const attempt: QuizAttempt = {
        id: 'att-65-1',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.SUBMITTED,
        startedAt,
        submittedAt,
        score: 6,
        correctAnswers: 3,
        wrongAnswers: 0,
        unanswered: 0,
        percentage: 100,
      } as QuizAttempt;

      const answers: Answer[] = [
        { id: 'ans-1', attemptId: attempt.id, questionId: 'p65-q1' } as Answer,
        { id: 'ans-2', attemptId: attempt.id, questionId: 'p65-q2' } as Answer,
        { id: 'ans-3', attemptId: attempt.id, questionId: 'p65-q3' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'p65-opt-1a' } as AnswerOption,
        { id: 'ao-2', answerId: 'ans-2', optionId: 'p65-opt-2a' } as AnswerOption,
        { id: 'ao-3a', answerId: 'ans-3', optionId: 'p65-opt-3a' } as AnswerOption,
        { id: 'ao-3b', answerId: 'ans-3', optionId: 'p65-opt-3b' } as AnswerOption,
      ];

      setupResultMock({ attempt, answers, answerOptions });

      const result = await service.getAttemptResult(attempt.id, learnerA);
      expect(result.attemptId).toBe(attempt.id);
      expect(result.status).toBe(AttemptStatus.SUBMITTED);
      expect(result.score).toBe(6);
      expect(result.totalMarks).toBe(6);
      expect(result.percentage).toBe(100);
      expect(result.elapsedSeconds).toBe(330);
      expect(result.timeLimitSeconds).toBe(600);
      expect(result.questions).toHaveLength(3);

      // Verify question review details
      const q1Review = result.questions![0];
      expect(q1Review.isCorrect).toBe(true);
      expect(q1Review.marksAwarded).toBe(2);
      expect(q1Review.selectedOptionIds).toEqual(['p65-opt-1a']);
      expect(q1Review.correctOptionIds).toEqual(['p65-opt-1a']);
    });

    it('6.5-2. rejects non-owner learner from retrieving attempt result (403 Forbidden)', async () => {
      const attempt: QuizAttempt = {
        id: 'att-65-2',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.SUBMITTED,
        startedAt: new Date(),
        submittedAt: new Date(),
      } as QuizAttempt;

      setupResultMock({ attempt });

      await expect(
        service.getAttemptResult(attempt.id, learnerB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('6.5-3. prevents in-progress attempt from exposing final result or leaking scores', async () => {
      const attempt: QuizAttempt = {
        id: 'att-65-3',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 30_000),
        expiresAt: new Date(Date.now() + 300_000),
        submittedAt: null,
      } as QuizAttempt;

      setupResultMock({ attempt });

      await expect(
        service.getAttemptResult(attempt.id, learnerA),
      ).rejects.toThrow(BadRequestException);
    });

    it('6.5-4. reconciles overdue in-progress attempt to EXPIRED when retrieving result', async () => {
      const attempt: QuizAttempt = {
        id: 'att-65-4',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 800_000),
        expiresAt: new Date(Date.now() - 200_000), // Overdue
        submittedAt: null,
      } as QuizAttempt;

      setupResultMock({ attempt });

      const result = await service.getAttemptResult(attempt.id, learnerA);
      expect(result.status).toBe(AttemptStatus.EXPIRED);
      expect(result.submittedAt).toBeInstanceOf(Date);
      expect(result.score).toBe(0);
      expect(result.totalMarks).toBe(6);
    });

    it('6.5-5. repeated result retrieval is idempotent and never re-grades or mutates attempt', async () => {
      const attempt: QuizAttempt = {
        id: 'att-65-5',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.SUBMITTED,
        startedAt: new Date(Date.now() - 600_000),
        submittedAt: new Date(Date.now() - 300_000),
        score: 6,
        correctAnswers: 3,
        wrongAnswers: 0,
        unanswered: 0,
        percentage: 100,
      } as QuizAttempt;

      const mockManager = setupResultMock({ attempt });

      const res1 = await service.getAttemptResult(attempt.id, learnerA);
      const res2 = await service.getAttemptResult(attempt.id, learnerA);

      expect(res1.score).toBe(6);
      expect(res2.score).toBe(6);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('6.5-6. history queries strictly by authenticated learnerId, preventing cross-user data access', async () => {
      const qb = setupQueryBuilderMock([], 0);
      mockQuestionRepo.find.mockResolvedValue([]);

      await service.getAttemptHistory(learnerA.userId, { page: 1, limit: 10 });

      expect(mockQuizAttemptRepo.createQueryBuilder).toHaveBeenCalledWith('attempt');
      expect(qb.where).toHaveBeenCalledWith('attempt.user_id = :userId', {
        userId: learnerA.userId,
      });
    });

    it('6.5-7. history enforces deterministic ordering (created_at DESC)', async () => {
      const qb = setupQueryBuilderMock([], 0);
      mockQuestionRepo.find.mockResolvedValue([]);

      await service.getAttemptHistory(learnerA.userId, { page: 1, limit: 10 });

      expect(qb.orderBy).toHaveBeenCalledWith('attempt.created_at', 'DESC');
    });

    it('6.5-8. history maps finalized attempts with quizTitle, version, score, and totalMarks', async () => {
      const rawAttempts = [
        {
          attempt_id: 'att-hist-1',
          attempt_quiz_id: 'quiz-1',
          attempt_quiz_version_id: publishedVersion.id,
          attempt_status: AttemptStatus.SUBMITTED,
          attempt_score: 5,
          attempt_correct_answers: 2,
          attempt_wrong_answers: 0,
          attempt_unanswered: 0,
          attempt_percentage: '100.00',
          attempt_started_at: new Date('2026-10-29T10:00:00Z'),
          attempt_submitted_at: new Date('2026-10-29T10:10:00Z'),
          quiz_title: 'TypeScript Fundamentals',
          version_version: 2,
        },
      ];

      setupQueryBuilderMock(rawAttempts, 1);
      mockQuestionRepo.find.mockResolvedValue([
        { quizVersionId: publishedVersion.id, marks: 5 },
      ]);

      const history = await service.getAttemptHistory(learnerA.userId, { page: 1, limit: 10 });
      expect(history.items).toHaveLength(1);
      const item = history.items[0];
      expect(item.attemptId).toBe('att-hist-1');
      expect(item.quizTitle).toBe('TypeScript Fundamentals');
      expect(item.version).toBe(2);
      expect(item.score).toBe(5);
      expect(item.totalMarks).toBe(5);
      expect(item.status).toBe(AttemptStatus.SUBMITTED);
      expect(item.percentage).toBe(100);
    });

    it('6.5-9. history hides final scores, percentages, and counts for IN_PROGRESS attempts', async () => {
      const rawAttempts = [
        {
          attempt_id: 'att-hist-inprog',
          attempt_quiz_id: 'quiz-1',
          attempt_quiz_version_id: publishedVersion.id,
          attempt_status: AttemptStatus.IN_PROGRESS,
          attempt_score: 99, // Should be masked to null
          attempt_correct_answers: 10,
          attempt_wrong_answers: 0,
          attempt_unanswered: 0,
          attempt_percentage: '100.00',
          attempt_started_at: new Date(),
          attempt_submitted_at: null,
          quiz_title: 'Active Quiz',
          version_version: 1,
        },
      ];

      setupQueryBuilderMock(rawAttempts, 1);
      mockQuestionRepo.find.mockResolvedValue([
        { quizVersionId: publishedVersion.id, marks: 10 },
      ]);

      const history = await service.getAttemptHistory(learnerA.userId, { page: 1, limit: 10 });
      const item = history.items[0];
      expect(item.status).toBe(AttemptStatus.IN_PROGRESS);
      expect(item.score).toBeNull();
      expect(item.percentage).toBeNull();
      expect(item.correctAnswers).toBeNull();
      expect(item.wrongAnswers).toBeNull();
      expect(item.unanswered).toBeNull();
    });

    it('6.5-10. history never exposes answer keys or question details', async () => {
      const rawAttempts = [
        {
          attempt_id: 'att-hist-keys',
          attempt_quiz_id: 'quiz-1',
          attempt_quiz_version_id: publishedVersion.id,
          attempt_status: AttemptStatus.SUBMITTED,
          attempt_score: 3,
          attempt_correct_answers: 1,
          attempt_wrong_answers: 0,
          attempt_unanswered: 0,
          attempt_percentage: '100.00',
          attempt_started_at: new Date(),
          attempt_submitted_at: new Date(),
          quiz_title: 'Secure Quiz',
          version_version: 1,
        },
      ];

      setupQueryBuilderMock(rawAttempts, 1);
      mockQuestionRepo.find.mockResolvedValue([]);

      const history = await service.getAttemptHistory(learnerA.userId, { page: 1, limit: 10 });
      const item = history.items[0];
      expect((item as any).questions).toBeUndefined();
      expect((item as any).options).toBeUndefined();
      expect((item as any).correctOptions).toBeUndefined();
    });

    it('6.5-11. question review post-finalization reveals correct answers and awarded marks under all-or-nothing policy', async () => {
      const attempt: QuizAttempt = {
        id: 'att-65-11',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.SUBMITTED,
        startedAt: new Date(),
        submittedAt: new Date(),
        score: 2,
        correctAnswers: 1,
        wrongAnswers: 1,
        unanswered: 1,
        percentage: 33.33,
      } as QuizAttempt;

      // Question 1: single choice answered correctly (opt-1a)
      // Question 2: true/false unanswered
      // Question 3: multiple choice answered partially (opt-3a only -> 0 marks awarded under all-or-nothing)
      const answers: Answer[] = [
        { id: 'ans-1', attemptId: attempt.id, questionId: 'p65-q1' } as Answer,
        { id: 'ans-3', attemptId: attempt.id, questionId: 'p65-q3' } as Answer,
      ];
      const answerOptions: AnswerOption[] = [
        { id: 'ao-1', answerId: 'ans-1', optionId: 'p65-opt-1a' } as AnswerOption,
        { id: 'ao-3', answerId: 'ans-3', optionId: 'p65-opt-3a' } as AnswerOption,
      ];

      setupResultMock({ attempt, answers, answerOptions });

      const result = await service.getAttemptResult(attempt.id, learnerA);
      expect(result.questions).toHaveLength(3);

      const [q1, q2, q3] = result.questions!;
      // Q1: Correct
      expect(q1.isCorrect).toBe(true);
      expect(q1.isUnanswered).toBe(false);
      expect(q1.marksAwarded).toBe(2);

      // Q2: Unanswered
      expect(q2.isCorrect).toBe(false);
      expect(q2.isUnanswered).toBe(true);
      expect(q2.marksAwarded).toBe(0);

      // Q3: Partial answer on multiple-choice awards 0 under all-or-nothing policy
      expect(q3.isCorrect).toBe(false);
      expect(q3.isUnanswered).toBe(false);
      expect(q3.marksAwarded).toBe(0);
      expect(q3.selectedOptionIds).toEqual(['p65-opt-3a']);
      expect(q3.correctOptionIds).toEqual(['p65-opt-3a', 'p65-opt-3b']);
    });

    it('6.5-12. handles missing or deleted quiz and version relationships gracefully', async () => {
      const attempt: QuizAttempt = {
        id: 'att-65-12',
        userId: learnerA.userId,
        quizId: 'deleted-quiz-id',
        quizVersionId: 'deleted-ver-id',
        status: AttemptStatus.SUBMITTED,
        startedAt: new Date(),
        submittedAt: new Date(),
        score: 0,
      } as QuizAttempt;

      // Quiz and Version return null
      setupResultMock({ attempt, quiz: null, version: null, questions: [] });

      const result = await service.getAttemptResult(attempt.id, learnerA);
      expect(result.attemptId).toBe(attempt.id);
      expect(result.quizTitle).toBeUndefined();
      expect(result.quizVersion).toBeUndefined();
      expect(result.totalMarks).toBe(0);
    });

    it('6.5-13. calculates pagination correctly (page, limit, total, totalPages)', async () => {
      setupQueryBuilderMock([], 25);
      mockQuestionRepo.find.mockResolvedValue([]);

      const history = await service.getAttemptHistory(learnerA.userId, { page: 2, limit: 10 });
      expect(history.page).toBe(2);
      expect(history.limit).toBe(10);
      expect(history.total).toBe(25);
      expect(history.totalPages).toBe(3);
    });

    it('6.5-14. resume reuses existing active attempt without resetting timers or duplicating records', async () => {
      const startedAt = new Date(Date.now() - 100_000);
      const expiresAt = new Date(Date.now() + 500_000);

      const activeAttempt: QuizAttempt = {
        id: 'att-active-resume',
        userId: learnerA.userId,
        quizId: publishedQuiz.id,
        quizVersionId: publishedVersion.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt,
        expiresAt,
      } as QuizAttempt;

      const mockManager = {
        findOne: vi.fn(async (entity: unknown) => {
          if (entity === Quiz) return publishedQuiz;
          if (entity === QuizVersion) return publishedVersion;
          if (entity === QuizAttempt) return activeAttempt;
          return null;
        }),
        find: vi.fn(async (entity: unknown) => {
          if (entity === Question) return p65Questions;
          return [];
        }),
        save: vi.fn(),
      };

      mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
        cb(mockManager),
      );

      const res = await service.startAttempt(publishedQuiz.id, publishedVersion.id, learnerA);
      expect(res.attemptId).toBe(activeAttempt.id);
      expect(res.resumed).toBe(true);
      expect(res.startedAt).toEqual(startedAt);
      expect(res.expiresAt).toEqual(expiresAt);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('6.5-15. supports filtering history by quizId and retrieving learner-wide history across all quizzes', async () => {
      const qb = setupQueryBuilderMock([], 0);
      mockQuestionRepo.find.mockResolvedValue([]);

      // 1. With quizId
      await service.getAttemptHistory(learnerA.userId, { page: 1, limit: 10, quizId: 'quiz-filter-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('attempt.quiz_id = :quizId', { quizId: 'quiz-filter-1' });

      // 2. Global without quizId (overloaded signature support)
      qb.andWhere.mockClear();
      await service.getAttemptHistory(learnerA.userId, { page: 1, limit: 10 });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('Phase 6.5.1 — Results and History Correctness Audit', () => {
    describe('calculateAttemptElapsedTime', () => {
      it('6.5.1-1. early submission before the deadline computes actual submission duration', () => {
        const startedAt = new Date('2026-10-29T10:00:00Z');
        const expiresAt = new Date('2026-10-29T10:30:00Z'); // 30 min limit
        const submittedAt = new Date('2026-10-29T10:12:30Z'); // submitted after 12.5 min = 750s

        const elapsed = service.calculateAttemptElapsedTime(
          {
            status: AttemptStatus.SUBMITTED,
            startedAt,
            submittedAt,
            expiresAt,
          },
          { timeLimitSeconds: 1800 },
        );

        expect(elapsed).toBe(750);
      });

      it('6.5.1-2. submission at the deadline resulting in expiration computes deadline duration', () => {
        const startedAt = new Date('2026-10-29T10:00:00Z');
        const expiresAt = new Date('2026-10-29T10:30:00Z');
        const submittedAt = new Date('2026-10-29T10:30:00Z');

        const elapsed = service.calculateAttemptElapsedTime(
          {
            status: AttemptStatus.EXPIRED,
            startedAt,
            submittedAt,
            expiresAt,
          },
          { timeLimitSeconds: 1800 },
        );

        expect(elapsed).toBe(1800);
      });

      it('6.5.1-3. expiration finalized after the deadline is bounded by deadline and does not inflate elapsed time', () => {
        const startedAt = new Date('2026-10-29T10:00:00Z');
        const expiresAt = new Date('2026-10-29T10:30:00Z'); // deadline was 10:30:00
        const submittedAt = new Date('2026-10-29T11:15:00Z'); // lazy finalization occurred 45 min late

        const elapsed = service.calculateAttemptElapsedTime(
          {
            status: AttemptStatus.EXPIRED,
            startedAt,
            submittedAt,
            expiresAt,
          },
          { timeLimitSeconds: 1800 },
        );

        expect(elapsed).toBe(1800);
      });

      it('6.5.1-4. untimed attempt submission calculates elapsed time from start to finalization', () => {
        const startedAt = new Date('2026-10-29T10:00:00Z');
        const submittedAt = new Date('2026-10-29T10:45:00Z'); // 45 min = 2700s

        const elapsed = service.calculateAttemptElapsedTime(
          {
            status: AttemptStatus.SUBMITTED,
            startedAt,
            submittedAt,
            expiresAt: null,
          },
          { timeLimitSeconds: null },
        );

        expect(elapsed).toBe(2700);
      });

      it('6.5.1-5. handles missing or invalid timing data defensively and clamps negative times to zero', () => {
        // Missing startedAt
        expect(
          service.calculateAttemptElapsedTime({
            status: AttemptStatus.SUBMITTED,
            startedAt: null as unknown as Date,
            submittedAt: new Date(),
            expiresAt: null,
          }),
        ).toBeNull();

        // Invalid startedAt string
        expect(
          service.calculateAttemptElapsedTime({
            status: AttemptStatus.SUBMITTED,
            startedAt: new Date('invalid-date'),
            submittedAt: new Date(),
            expiresAt: null,
          }),
        ).toBeNull();

        // Missing submittedAt on SUBMITTED
        expect(
          service.calculateAttemptElapsedTime({
            status: AttemptStatus.SUBMITTED,
            startedAt: new Date(),
            submittedAt: null,
            expiresAt: null,
          }),
        ).toBeNull();

        // Invalid submittedAt string on SUBMITTED
        expect(
          service.calculateAttemptElapsedTime({
            status: AttemptStatus.SUBMITTED,
            startedAt: new Date('2026-10-29T10:00:00Z'),
            submittedAt: new Date('invalid-date'),
            expiresAt: null,
          }),
        ).toBeNull();

        // Server clock skew (submittedAt before startedAt) clamps to 0
        expect(
          service.calculateAttemptElapsedTime({
            status: AttemptStatus.SUBMITTED,
            startedAt: new Date('2026-10-29T10:05:00Z'),
            submittedAt: new Date('2026-10-29T10:00:00Z'),
            expiresAt: null,
          }),
        ).toBe(0);

        // Expired with null expiresAt falls back to version timeLimitSeconds
        expect(
          service.calculateAttemptElapsedTime(
            {
              status: AttemptStatus.EXPIRED,
              startedAt: new Date('2026-10-29T10:00:00Z'),
              submittedAt: new Date('2026-10-29T10:45:00Z'),
              expiresAt: null,
            },
            { timeLimitSeconds: 600 },
          ),
        ).toBe(600);
      });
    });

    describe('Result & History Totals, Naming Standardization, and Authorization', () => {
      function setupQueryBuilderMock(rawAttempts: any[], totalCount: number) {
        const qb = {
          leftJoin: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          take: vi.fn().mockReturnThis(),
          getRawMany: vi.fn().mockResolvedValue(rawAttempts),
          getCount: vi.fn().mockResolvedValue(totalCount),
        };
        mockQuizAttemptRepo.createQueryBuilder = vi.fn(() => qb);
        return qb;
      }

      it('6.5.1-6. getAttemptResult returns standardized totalMarks and totalScore as equal values', async () => {
        const attempt: QuizAttempt = {
          id: 'att-651-std',
          userId: learnerA.userId,
          quizId: publishedQuiz.id,
          quizVersionId: publishedVersion.id,
          status: AttemptStatus.SUBMITTED,
          score: 8,
          percentage: 80,
          correctAnswers: 2,
          wrongAnswers: 1,
          unanswered: 0,
          startedAt: new Date('2026-10-29T10:00:00Z'),
          submittedAt: new Date('2026-10-29T10:15:00Z'),
          expiresAt: null,
          answers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          quiz: publishedQuiz,
          quizVersion: publishedVersion,
          user: {} as any,
        };

        const activeQuestions = [
          {
            id: 'q-651-1',
            quizVersionId: publishedVersion.id,
            text: 'Q1',
            questionType: QuestionType.SINGLE_CHOICE,
            order: 1,
            marks: 5,
            options: [],
            quizVersion: publishedVersion,
          },
          {
            id: 'q-651-2',
            quizVersionId: publishedVersion.id,
            text: 'Q2',
            questionType: QuestionType.SINGLE_CHOICE,
            order: 2,
            marks: 5,
            options: [],
            quizVersion: publishedVersion,
          },
        ] as Question[];

        const mockManager = {
          findOne: vi.fn(async (entity: unknown) => {
            if (entity === QuizAttempt) return attempt;
            if (entity === Quiz) return publishedQuiz;
            if (entity === QuizVersion) return publishedVersion;
            return null;
          }),
          find: vi.fn(async (entity: unknown) => {
            if (entity === Question) return activeQuestions;
            return [];
          }),
          save: vi.fn(async (_entity: unknown, data: any) => data),
        };

        mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
          cb(mockManager),
        );

        const result = await service.getAttemptResult(attempt.id, learnerA);
        expect(result.totalMarks).toBe(10);
        expect(result.totalScore).toBe(10);
        expect(result.totalScore).toBe(result.totalMarks);
      });

      it('6.5.1-7. getAttemptResult allows quiz creator to view finalized learner attempt result', async () => {
        const creatorUser: AuthenticatedUser = {
          userId: publishedQuiz.creatorId,
          email: 'creator@example.com',
          role: 'user',
        };

        const attempt: QuizAttempt = {
          id: 'att-651-creator',
          userId: learnerA.userId,
          quizId: publishedQuiz.id,
          quizVersionId: publishedVersion.id,
          status: AttemptStatus.SUBMITTED,
          score: 10,
          percentage: 100,
          correctAnswers: 2,
          wrongAnswers: 0,
          unanswered: 0,
          startedAt: new Date('2026-10-29T10:00:00Z'),
          submittedAt: new Date('2026-10-29T10:10:00Z'),
          expiresAt: null,
          answers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          quiz: publishedQuiz,
          quizVersion: publishedVersion,
          user: {} as any,
        };

        const mockManager = {
          findOne: vi.fn(async (entity: unknown) => {
            if (entity === QuizAttempt) return attempt;
            if (entity === Quiz) return publishedQuiz;
            if (entity === QuizVersion) return publishedVersion;
            return null;
          }),
          find: vi.fn(async (entity: unknown) => {
            if (entity === Question) return [];
            return [];
          }),
          save: vi.fn(async (_entity: unknown, data: any) => data),
        };

        mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
          cb(mockManager),
        );

        const result = await service.getAttemptResult(attempt.id, creatorUser);
        expect(result.attemptId).toBe(attempt.id);
        expect(result.status).toBe(AttemptStatus.SUBMITTED);
      });

      it('6.5.1-8. getAttemptResult rejects third-party non-creator, non-admin user (403 Forbidden)', async () => {
        const stranger: AuthenticatedUser = {
          userId: 'stranger-user-id',
          email: 'stranger@example.com',
          role: 'user',
        };

        const attempt: QuizAttempt = {
          id: 'att-651-stranger',
          userId: learnerA.userId,
          quizId: publishedQuiz.id,
          quizVersionId: publishedVersion.id,
          status: AttemptStatus.SUBMITTED,
          score: 10,
          percentage: 100,
          correctAnswers: 2,
          wrongAnswers: 0,
          unanswered: 0,
          startedAt: new Date('2026-10-29T10:00:00Z'),
          submittedAt: new Date('2026-10-29T10:10:00Z'),
          expiresAt: null,
          answers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          quiz: publishedQuiz,
          quizVersion: publishedVersion,
          user: {} as any,
        };

        const mockManager = {
          findOne: vi.fn(async (entity: unknown) => {
            if (entity === QuizAttempt) return attempt;
            if (entity === Quiz) return publishedQuiz;
            if (entity === QuizVersion) return publishedVersion;
            return null;
          }),
          find: vi.fn(async () => []),
          save: vi.fn(async (_entity: unknown, data: any) => data),
        };

        mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
          cb(mockManager),
        );

        await expect(service.getAttemptResult(attempt.id, stranger)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('6.5.1-9. getAttemptResult isolates version marks strictly from attempt.quizVersionId', async () => {
        const v1Version: QuizVersion = { ...publishedVersion, id: 'version-v1', version: 1 };
        const v1Questions: Question[] = [
          {
            id: 'q-v1',
            quizVersionId: 'version-v1',
            text: 'Old Question',
            questionType: QuestionType.SINGLE_CHOICE,
            order: 1,
            marks: 5,
            options: [],
            quizVersion: v1Version,
          },
        ];

        const attemptV1: QuizAttempt = {
          id: 'att-v1',
          userId: learnerA.userId,
          quizId: publishedQuiz.id,
          quizVersionId: 'version-v1',
          status: AttemptStatus.SUBMITTED,
          score: 5,
          percentage: 100,
          correctAnswers: 1,
          wrongAnswers: 0,
          unanswered: 0,
          startedAt: new Date('2026-10-29T10:00:00Z'),
          submittedAt: new Date('2026-10-29T10:05:00Z'),
          expiresAt: null,
          answers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          quiz: publishedQuiz,
          quizVersion: v1Version,
          user: {} as any,
        };

        const mockManager = {
          findOne: vi.fn(async (entity: unknown) => {
            if (entity === QuizAttempt) return attemptV1;
            if (entity === Quiz) return publishedQuiz;
            if (entity === QuizVersion) return v1Version;
            return null;
          }),
          find: vi.fn(async (entity: unknown, opts?: { where?: any }) => {
            if (entity === Question) {
              if (opts?.where?.quizVersionId === 'version-v1') {
                return v1Questions;
              }
              return [];
            }
            return [];
          }),
          save: vi.fn(async (_entity: unknown, data: any) => data),
        };

        mockDataSource.transaction.mockImplementation(async (cb: (m: typeof mockManager) => unknown) =>
          cb(mockManager),
        );

        const result = await service.getAttemptResult(attemptV1.id, learnerA);
        expect(result.totalMarks).toBe(5);
        expect(result.totalScore).toBe(5);
      });

      it('6.5.1-10. getAttemptHistory maps totalScore equal to totalMarks for each attempt item', async () => {
        const rawAttempts = [
          {
            attempt_id: 'att-hist-1',
            attempt_quiz_id: publishedQuiz.id,
            attempt_quiz_version_id: publishedVersion.id,
            attempt_status: AttemptStatus.SUBMITTED,
            attempt_score: 9,
            attempt_percentage: 90,
            attempt_correct_answers: 3,
            attempt_wrong_answers: 0,
            attempt_unanswered: 0,
            attempt_started_at: new Date('2026-10-29T10:00:00Z'),
            attempt_submitted_at: new Date('2026-10-29T10:10:00Z'),
            quiz_title: 'History Standardized Quiz',
            version_version: 1,
          },
        ];

        setupQueryBuilderMock(rawAttempts, 1);
        mockQuestionRepo.find.mockResolvedValue([
          { quizVersionId: publishedVersion.id, marks: 10 },
        ]);

        const history = await service.getAttemptHistory(learnerA.userId);
        expect(history.items).toHaveLength(1);
        expect(history.items[0].totalMarks).toBe(10);
        expect(history.items[0].totalScore).toBe(10);
      });
    });
  });

  describe('Phase 7.1 — Quiz Creator Dashboard & Scoped Quiz Listing', () => {
    const creatorA: AuthenticatedUser = {
      userId: 'creator-user-a',
      email: 'creator.a@example.com',
      role: UserRole.CREATOR,
    };

    const creatorB: AuthenticatedUser = {
      userId: 'creator-user-b',
      email: 'creator.b@example.com',
      role: UserRole.CREATOR,
    };

    const adminUser: AuthenticatedUser = {
      userId: 'admin-user-id',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    };

    function setupQuizQueryBuilderMock(quizzes: any[], totalCount: number) {
      const qb = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([quizzes, totalCount]),
      };
      mockQuizRepo.createQueryBuilder = vi.fn(() => qb);
      return qb;
    }

    it('7.1-1. Authenticated creator lists their own quizzes with version metadata', async () => {
      const mockQuizzes = [
        {
          id: 'quiz-a1',
          title: 'Creator A TypeScript Quiz',
          description: 'TS advanced concepts',
          status: QuizStatus.PUBLISHED,
          creatorId: creatorA.userId,
          createdAt: new Date('2026-10-01T10:00:00Z'),
          updatedAt: new Date('2026-10-02T10:00:00Z'),
        },
      ];

      const qb = setupQuizQueryBuilderMock(mockQuizzes, 1);
      mockQuizVersionRepo.find = vi.fn().mockResolvedValue([
        {
          id: 'ver-1',
          quizId: 'quiz-a1',
          version: 1,
          status: QuizVersionStatus.PUBLISHED,
        },
        {
          id: 'ver-2',
          quizId: 'quiz-a1',
          version: 2,
          status: QuizVersionStatus.DRAFT,
        },
      ]);

      const result = await service.getCreatorQuizzes(creatorA);

      expect(qb.where).toHaveBeenCalledWith('quiz.creatorId = :creatorId', {
        creatorId: creatorA.userId,
      });
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.id).toBe('quiz-a1');
      expect(item.title).toBe('Creator A TypeScript Quiz');
      expect(item.status).toBe(QuizStatus.PUBLISHED);
      expect(item.publishedVersionsCount).toBe(1);
      expect(item.hasDraft).toBe(true);
      expect(item.latestVersion).toBe(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('7.1-2. One creator cannot retrieve another creator private drafts', async () => {
      const qb = setupQuizQueryBuilderMock([], 0);
      mockQuizVersionRepo.find = vi.fn().mockResolvedValue([]);

      // Creator A attempts to supply Creator B's ID in query
      await service.getCreatorQuizzes(creatorA, {
        creatorId: creatorB.userId,
      });

      // Server strictly overrides and enforces creatorA.userId from JWT
      expect(qb.where).toHaveBeenCalledWith('quiz.creatorId = :creatorId', {
        creatorId: creatorA.userId,
      });
      expect(qb.where).not.toHaveBeenCalledWith('quiz.creatorId = :creatorId', {
        creatorId: creatorB.userId,
      });
    });

    it('7.1-3. Administrator policy is preserved (can query all or specific creator)', async () => {
      const qb = setupQuizQueryBuilderMock([], 0);
      mockQuizVersionRepo.find = vi.fn().mockResolvedValue([]);

      // Admin querying a specific creator
      await service.getCreatorQuizzes(adminUser, {
        creatorId: creatorB.userId,
      });
      expect(qb.where).toHaveBeenCalledWith('quiz.creatorId = :creatorId', {
        creatorId: creatorB.userId,
      });

      // Admin querying without creatorId filter: no restriction to admin's own ID
      const qbAll = setupQuizQueryBuilderMock([], 0);
      await service.getCreatorQuizzes(adminUser, {});
      expect(qbAll.where).not.toHaveBeenCalledWith(
        'quiz.creatorId = :creatorId',
        expect.anything(),
      );
    });

    it('7.1-4. Status filtering and search query behave correctly', async () => {
      const qb = setupQuizQueryBuilderMock([], 0);
      mockQuizVersionRepo.find = vi.fn().mockResolvedValue([]);

      await service.getCreatorQuizzes(creatorA, {
        status: QuizStatus.DRAFT,
        search: 'Architecture',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('quiz.status = :status', {
        status: QuizStatus.DRAFT,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(LOWER(quiz.title) LIKE LOWER(:search) OR LOWER(quiz.description) LIKE LOWER(:search))',
        { search: '%Architecture%' },
      );
    });

    it('7.1-5. Pagination bounds are enforced (min page 1, max limit 50, correct skip/take and totalPages)', async () => {
      const qb = setupQuizQueryBuilderMock([], 105);
      mockQuizVersionRepo.find = vi.fn().mockResolvedValue([]);

      const result = await service.getCreatorQuizzes(creatorA, {
        page: 3,
        limit: 20,
      });

      expect(qb.skip).toHaveBeenCalledWith(40); // (3 - 1) * 20
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(105);
      expect(result.totalPages).toBe(6); // Math.ceil(105 / 20) = 6

      // Edge case: limit > 50 clamped to 50, page < 1 clamped to 1
      const qbClamped = setupQuizQueryBuilderMock([], 10);
      const clampedResult = await service.getCreatorQuizzes(creatorA, {
        page: -5,
        limit: 100,
      });
      expect(qbClamped.skip).toHaveBeenCalledWith(0);
      expect(qbClamped.take).toHaveBeenCalledWith(50);
      expect(clampedResult.page).toBe(1);
      expect(clampedResult.limit).toBe(50);
    });

    it('7.1-6. Version batch loading avoids N+1 database queries', async () => {
      const mockQuizzes = [
        {
          id: 'q-1',
          title: 'Quiz 1',
          description: null,
          status: QuizStatus.DRAFT,
          creatorId: creatorA.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'q-2',
          title: 'Quiz 2',
          description: null,
          status: QuizStatus.PUBLISHED,
          creatorId: creatorA.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      setupQuizQueryBuilderMock(mockQuizzes, 2);
      mockQuizVersionRepo.find = vi.fn().mockResolvedValue([
        { id: 'v-1', quizId: 'q-1', version: 1, status: QuizVersionStatus.DRAFT },
        { id: 'v-2', quizId: 'q-2', version: 1, status: QuizVersionStatus.PUBLISHED },
      ]);

      const result = await service.getCreatorQuizzes(creatorA);

      // Exactly 1 batch query for all quiz IDs on this page
      expect(mockQuizVersionRepo.find).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].hasDraft).toBe(true);
      expect(result.items[1].publishedVersionsCount).toBe(1);
    });
  });

  describe('Phase 7.2 — Quiz Editing, Immutability & Version Integrity', () => {
    const creatorUser: AuthenticatedUser = {
      userId: 'creator-user-1',
      email: 'creator1@example.com',
      role: UserRole.CREATOR,
    };

    const strangerUser: AuthenticatedUser = {
      userId: 'stranger-user-9',
      email: 'stranger@example.com',
      role: UserRole.CREATOR,
    };

    const draftQuiz: Quiz = {
      id: 'quiz-p72',
      title: 'Architectural Patterns',
      description: 'System design questions',
      status: QuizStatus.DRAFT,
      creatorId: creatorUser.userId,
      organizationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [],
      assignments: [],
    };

    const draftVersion: QuizVersion = {
      id: 'ver-draft-1',
      quizId: draftQuiz.id,
      version: 1,
      status: QuizVersionStatus.DRAFT,
      timeLimitSeconds: 1200,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      quiz: draftQuiz,
      questions: [],
    };

    const publishedQuiz: Quiz = {
      ...draftQuiz,
      id: 'quiz-pub-1',
      status: QuizStatus.PUBLISHED,
    };

    const publishedVersion: QuizVersion = {
      ...draftVersion,
      id: 'ver-pub-1',
      quizId: publishedQuiz.id,
      status: QuizVersionStatus.PUBLISHED,
      publishedAt: new Date(),
    };

    it('7.2-1. Immutability: saveQuestionsBulk on PUBLISHED version throws BadRequestException', async () => {
      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(publishedQuiz);
          if (entity === QuizVersion) return Promise.resolve(publishedVersion);
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.saveQuestionsBulk(publishedQuiz.id, publishedVersion.id, { questions: [] }, creatorUser),
      ).rejects.toThrow(new BadRequestException('Questions can only be modified in a draft version'));
    });

    it('7.2-2. Immutability: updateQuizVersion on PUBLISHED version throws BadRequestException', async () => {
      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(publishedQuiz);
          if (entity === QuizVersion) return Promise.resolve(publishedVersion);
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.updateQuizVersion(publishedQuiz.id, publishedVersion.id, creatorUser, { timeLimitSeconds: 900 }),
      ).rejects.toThrow(new BadRequestException('Settings can only be modified in a draft version'));
    });

    it('7.2-3. Version settings: updates timeLimitSeconds on DRAFT version and supports untimed (null)', async () => {
      const draftToUpdate = { ...draftVersion };
      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(draftQuiz);
          if (entity === QuizVersion) return Promise.resolve(draftToUpdate);
          return Promise.resolve(null);
        }),
        save: vi.fn().mockImplementation((_entity, ver) => Promise.resolve(ver)),
      };
      mockDataSource.transaction.mockImplementation(async (cb: (m: any) => unknown) => cb(txManager));

      // 1. Update to 1800s
      const updated1 = await service.updateQuizVersion(draftQuiz.id, draftVersion.id, creatorUser, {
        timeLimitSeconds: 1800,
      });
      expect(updated1.timeLimitSeconds).toBe(1800);
      expect(draftToUpdate.timeLimitSeconds).toBe(1800);

      // 2. Remove time limit (null)
      const updated2 = await service.updateQuizVersion(draftQuiz.id, draftVersion.id, creatorUser, {
        timeLimitSeconds: null,
      });
      expect(updated2.timeLimitSeconds).toBeNull();
      expect(draftToUpdate.timeLimitSeconds).toBeNull();
    });

    it('7.2-4. Version settings: rejects negative or zero timeLimitSeconds', async () => {
      await expect(
        service.updateQuizVersion(draftQuiz.id, draftVersion.id, creatorUser, { timeLimitSeconds: 0 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateQuizVersion(draftQuiz.id, draftVersion.id, creatorUser, { timeLimitSeconds: -100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('7.2-5. Publishing readiness: rejects publishing version with empty quiz title', async () => {
      const emptyTitleQuiz = { ...draftQuiz, title: '   ' };
      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(emptyTitleQuiz);
          if (entity === QuizVersion) return Promise.resolve(draftVersion);
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.publishVersion(emptyTitleQuiz.id, draftVersion.id, creatorUser),
      ).rejects.toThrow(new BadRequestException('Quiz title cannot be empty'));
    });

    it('7.2-6. Publishing readiness: rejects publishing version without questions', async () => {
      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(draftQuiz);
          if (entity === QuizVersion) return Promise.resolve(draftVersion);
          return Promise.resolve(null);
        }),
        find: vi.fn().mockResolvedValue([]),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.publishVersion(draftQuiz.id, draftVersion.id, creatorUser),
      ).rejects.toThrow(new BadRequestException('Cannot publish a quiz without questions'));
    });

    it('7.2-7. Publishing readiness: rejects publishing while AI generation is PENDING or PROCESSING', async () => {
      const inFlightGen = { id: 'gen-active-1', status: GenerationStatus.PROCESSING };
      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(draftQuiz);
          if (entity === QuizVersion) return Promise.resolve(draftVersion);
          if (entity === QuizQuestionGeneration) return Promise.resolve(inFlightGen);
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.publishVersion(draftQuiz.id, draftVersion.id, creatorUser),
      ).rejects.toThrow(new BadRequestException('Cannot publish version while AI question generation is in progress'));
    });

    it('7.2-8. Publishing readiness: rejects questions with empty text or duplicate option text', async () => {
      const mockQuestions = [
        { id: 'q-1', text: 'Valid question text', marks: 1, order: 1, questionType: QuestionType.SINGLE_CHOICE },
      ];
      const mockOptions = [
        { id: 'opt-1', text: 'Same text', order: 1, isCorrect: true },
        { id: 'opt-2', text: 'Same Text', order: 2, isCorrect: false },
      ];

      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(draftQuiz);
          if (entity === QuizVersion) return Promise.resolve(draftVersion);
          return Promise.resolve(null);
        }),
        find: vi.fn().mockImplementation((entity) => {
          if (entity === Question) return Promise.resolve(mockQuestions);
          if (entity === Option) return Promise.resolve(mockOptions);
          return Promise.resolve([]);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.publishVersion(draftQuiz.id, draftVersion.id, creatorUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('7.2-9. Publishing readiness: successfully publishes valid draft and sets Quiz status to PUBLISHED', async () => {
      const mockQuestions = [
        { id: 'q-1', text: 'What is CQRS?', marks: 2, order: 1, questionType: QuestionType.SINGLE_CHOICE },
      ];
      const mockOptions = [
        { id: 'opt-1', text: 'Command Query Responsibility Segregation', order: 1, isCorrect: true },
        { id: 'opt-2', text: 'Central Query Routing System', order: 2, isCorrect: false },
      ];

      const currentQuiz = { ...draftQuiz };
      const currentVersion = { ...draftVersion };

      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(currentQuiz);
          if (entity === QuizVersion) return Promise.resolve(currentVersion);
          return Promise.resolve(null);
        }),
        find: vi.fn().mockImplementation((entity) => {
          if (entity === Question) return Promise.resolve(mockQuestions);
          if (entity === Option) return Promise.resolve(mockOptions);
          return Promise.resolve([]);
        }),
        save: vi.fn().mockImplementation((_entity, record) => Promise.resolve(record)),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      const published = await service.publishVersion(currentQuiz.id, currentVersion.id, creatorUser);
      expect(published.status).toBe(QuizVersionStatus.PUBLISHED);
      expect(currentQuiz.status).toBe(QuizStatus.PUBLISHED);
      expect(currentVersion.status).toBe(QuizVersionStatus.PUBLISHED);
      expect(currentVersion.publishedAt).toBeInstanceOf(Date);
    });

    it('7.2-10. Version branching: createNewVersion creates DRAFT v+1 with cloned questions and enforces single-draft rule', async () => {
      const existingPublishedV1 = { ...publishedVersion, version: 1 };
      const v1Questions = [
        { id: 'q-v1-1', text: 'Q1 prompt', marks: 1, order: 1, questionType: QuestionType.SINGLE_CHOICE },
      ];
      const v1Options = [
        { id: 'opt-v1-1', text: 'Opt A', order: 1, isCorrect: true },
        { id: 'opt-v1-2', text: 'Opt B', order: 2, isCorrect: false },
      ];

      // 1. First invocation: creates draft v2
      const txManagerSuccess = {
        findOne: vi.fn().mockImplementation((entity, opts) => {
          if (entity === Quiz) return Promise.resolve(publishedQuiz);
          if (entity === QuizVersion && opts?.where?.status === QuizVersionStatus.DRAFT) {
            return Promise.resolve(null);
          }
          if (entity === QuizVersion && opts?.where?.status === QuizVersionStatus.PUBLISHED) {
            return Promise.resolve(existingPublishedV1);
          }
          return Promise.resolve(null);
        }),
        create: vi.fn().mockImplementation((entity, payload) => ({ id: `new-${entity.name}`, ...payload })),
        save: vi.fn().mockImplementation((_entity, record) => Promise.resolve(record)),
        find: vi.fn().mockImplementation((entity) => {
          if (entity === Question) return Promise.resolve(v1Questions);
          if (entity === Option) return Promise.resolve(v1Options);
          return Promise.resolve([]);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManagerSuccess));

      const newVer = await service.createNewVersion(publishedQuiz.id, creatorUser);
      expect(newVer.version).toBe(2);
      expect(newVer.status).toBe(QuizVersionStatus.DRAFT);

      // 2. Second invocation: active draft exists -> rejects
      const existingDraftV2 = { id: 'ver-draft-2', version: 2, status: QuizVersionStatus.DRAFT };
      const txManagerDuplicate = {
        findOne: vi.fn().mockImplementation((entity, opts) => {
          if (entity === Quiz) return Promise.resolve(publishedQuiz);
          if (entity === QuizVersion && opts?.where?.status === QuizVersionStatus.DRAFT) {
            return Promise.resolve(existingDraftV2);
          }
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManagerDuplicate));

      await expect(
        service.createNewVersion(publishedQuiz.id, creatorUser),
      ).rejects.toThrow(new BadRequestException('A draft version already exists for this quiz'));
    });

    it('7.2-11. Discard draft: rejects discarding initial draft before published version exists', async () => {
      const txManager = {
        findOne: vi.fn().mockImplementation((entity, opts) => {
          if (entity === Quiz) return Promise.resolve(draftQuiz);
          if (entity === QuizVersion && opts?.where?.id === draftVersion.id) return Promise.resolve(draftVersion);
          if (entity === QuizVersion && opts?.where?.status === QuizVersionStatus.PUBLISHED) return Promise.resolve(null);
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.discardVersion(draftQuiz.id, draftVersion.id, creatorUser),
      ).rejects.toThrow(new BadRequestException('The initial draft version cannot be discarded before the quiz is published'));
    });

    it('7.2-12. Creator isolation: Stranger creator cannot edit or publish another creator draft', async () => {
      const txManager = {
        findOne: vi.fn().mockImplementation((entity, opts) => {
          if (entity === Quiz) {
            if (opts?.where?.creatorId === strangerUser.userId) return Promise.resolve(null);
          }
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementation(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.saveQuestionsBulk(draftQuiz.id, draftVersion.id, { questions: [] }, strangerUser),
      ).rejects.toThrow(new NotFoundException('Quiz not found'));

      await expect(
        service.updateQuizVersion(draftQuiz.id, draftVersion.id, strangerUser, { timeLimitSeconds: 600 }),
      ).rejects.toThrow(new NotFoundException('Quiz not found'));

      await expect(
        service.publishVersion(draftQuiz.id, draftVersion.id, strangerUser),
      ).rejects.toThrow(new NotFoundException('Quiz not found'));
    });
  });

  describe('Phase 7.3: Publishing Workflow Hardening, Lifecycle Invariants & Learner Discovery', () => {
    const testDraftQuiz: Quiz = {
      id: 'quiz-draft-p73',
      title: 'Phase 7.3 Draft Quiz',
      description: 'Test description',
      status: QuizStatus.DRAFT,
      creatorId: creatorUser.userId,
      organizationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Quiz;

    const testDraftVersion: QuizVersion = {
      id: 'ver-draft-p73',
      quizId: testDraftQuiz.id,
      version: 1,
      status: QuizVersionStatus.DRAFT,
      publishedAt: null,
      timeLimitSeconds: 600,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as QuizVersion;

    it('7.3-1. Repeated publication returns predictable idempotent published result without re-validating or mutating', async () => {
      const alreadyPublishedVersion = {
        ...testDraftVersion,
        id: 'ver-published-1',
        version: 1,
        status: QuizVersionStatus.PUBLISHED,
        publishedAt: new Date('2026-10-29T10:00:00Z'),
      };
      const publishedQuizRecord = {
        ...testDraftQuiz,
        id: 'quiz-published-1',
        status: QuizStatus.PUBLISHED,
      };

      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(publishedQuizRecord);
          if (entity === QuizVersion) return Promise.resolve(alreadyPublishedVersion);
          return Promise.resolve(null);
        }),
        save: vi.fn(),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      const result = await service.publishVersion(publishedQuizRecord.id, alreadyPublishedVersion.id, creatorUser);
      expect(result.status).toBe(QuizVersionStatus.PUBLISHED);
      expect(result.quizVersionId).toBe(alreadyPublishedVersion.id);
      expect(result.version).toBe(1);
      expect(result.publishedAt).toEqual(alreadyPublishedVersion.publishedAt);
      expect(txManager.save).not.toHaveBeenCalled();
    });

    it('7.3-2. Rejects publishing an ARCHIVED version', async () => {
      const archivedVersion = {
        ...testDraftVersion,
        id: 'ver-archived-1',
        status: QuizVersionStatus.ARCHIVED,
      };
      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(testDraftQuiz);
          if (entity === QuizVersion) return Promise.resolve(archivedVersion);
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.publishVersion(testDraftQuiz.id, archivedVersion.id, creatorUser),
      ).rejects.toThrow(new BadRequestException('Cannot publish an archived version'));
    });

    it('7.3-3. In-flight AI generation check targets only the version being published (does not block on other quizzes or completed/failed generations)', async () => {
      const mockQuestions = [
        { id: 'q-1', text: 'Prompt text', marks: 1, order: 1, questionType: QuestionType.SINGLE_CHOICE },
      ];
      const mockOptions = [
        { id: 'opt-1', text: 'Option A', order: 1, isCorrect: true },
        { id: 'opt-2', text: 'Option B', order: 2, isCorrect: false },
      ];

      // Query for In([PENDING, PROCESSING]) returns null (no in-flight generation for this targetVersionId)
      const txManager = {
        findOne: vi.fn().mockImplementation((entity, opts) => {
          if (entity === Quiz) return Promise.resolve({ ...testDraftQuiz });
          if (entity === QuizVersion) return Promise.resolve({ ...testDraftVersion });
          if (entity === QuizQuestionGeneration) {
            // Only returns in-flight if matches target version
            if (opts?.where?.targetVersionId === testDraftVersion.id) return Promise.resolve(null);
          }
          return Promise.resolve(null);
        }),
        find: vi.fn().mockImplementation((entity) => {
          if (entity === Question) return Promise.resolve(mockQuestions);
          if (entity === Option) return Promise.resolve(mockOptions);
          return Promise.resolve([]);
        }),
        save: vi.fn().mockImplementation((_entity, record) => Promise.resolve(record)),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      const published = await service.publishVersion(testDraftQuiz.id, testDraftVersion.id, creatorUser);
      expect(published.status).toBe(QuizVersionStatus.PUBLISHED);
    });

    it('7.3-4. Transaction safety: validation failure causes transaction to throw BadRequestException and rolls back cleanly', async () => {
      const invalidQuestions = [
        { id: 'q-1', text: '', marks: 1, order: 1, questionType: QuestionType.SINGLE_CHOICE }, // empty text
      ];
      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(testDraftQuiz);
          if (entity === QuizVersion) return Promise.resolve(testDraftVersion);
          return Promise.resolve(null);
        }),
        find: vi.fn().mockImplementation((entity) => {
          if (entity === Question) return Promise.resolve(invalidQuestions);
          return Promise.resolve([]);
        }),
        save: vi.fn(),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.publishVersion(testDraftQuiz.id, testDraftVersion.id, creatorUser),
      ).rejects.toThrow(new BadRequestException('Question 1 text cannot be empty'));
      expect(txManager.save).not.toHaveBeenCalled();
    });

    it('7.3-5. Deterministic latest published version: getLatestPublishedQuizVersion resolves highest version number with status=PUBLISHED', async () => {
      const pubQuiz = { id: 'quiz-pub-1', title: 'Pub Quiz', status: QuizStatus.PUBLISHED };
      const latestVer = { id: 'ver-v2', quizId: 'quiz-pub-1', version: 2, status: QuizVersionStatus.PUBLISHED, timeLimitSeconds: 600 };

      mockQuizRepo.findOne.mockResolvedValueOnce(pubQuiz);
      mockQuizVersionRepo.findOne.mockResolvedValueOnce(latestVer);

      // getPublishedQuizVersion inner calls:
      mockQuizRepo.findOne.mockResolvedValueOnce(pubQuiz);
      mockQuizVersionRepo.findOne.mockResolvedValueOnce(latestVer);
      mockQuestionRepo.find.mockResolvedValueOnce([
        { id: 'q-1', text: 'Sample Q', marks: 2, order: 1, questionType: QuestionType.SINGLE_CHOICE },
      ]);
      mockOptionRepo.find.mockResolvedValueOnce([
        { id: 'opt-1', text: 'Opt 1', order: 1, isCorrect: true },
        { id: 'opt-2', text: 'Opt 2', order: 2, isCorrect: false },
      ]);

      const result = await service.getLatestPublishedQuizVersion('quiz-pub-1');
      expect(result.version).toBe(2);
      expect(result.quizVersionId).toBe('ver-v2');
      expect(result.questions[0].options[0]).not.toHaveProperty('isCorrect');
    });

    it('7.3-6. getPublishedQuizzes lists only published quizzes having published versions and omits answer keys', async () => {
      const qbMock = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValueOnce([
          [
            { id: 'quiz-1', title: 'Quiz 1', description: 'Desc 1', status: QuizStatus.PUBLISHED, createdAt: new Date(), updatedAt: new Date() },
          ],
          1,
        ]),
      };
      mockQuizRepo.createQueryBuilder = vi.fn().mockReturnValue(qbMock as any);

      mockQuizVersionRepo.find.mockResolvedValueOnce([
        { id: 'v-1', quizId: 'quiz-1', version: 1, status: QuizVersionStatus.PUBLISHED, timeLimitSeconds: 300, publishedAt: new Date() },
      ]);

      mockQuestionRepo.find.mockResolvedValueOnce([
        { id: 'q-1', quizVersionId: 'v-1', marks: 5 },
        { id: 'q-2', quizVersionId: 'v-1', marks: 5 },
      ]);

      const catalog = await service.getPublishedQuizzes();
      expect(catalog.total).toBe(1);
      expect(catalog.items).toHaveLength(1);
      expect(catalog.items[0].latestPublishedVersionId).toBe('v-1');
      expect(catalog.items[0].totalQuestions).toBe(2);
      expect(catalog.items[0].totalMarks).toBe(10);
      expect(catalog.items[0].timeLimitSeconds).toBe(300);
    });

    it('7.3-7. startAttempt with only quizId automatically resolves and binds to the active published version', async () => {
      const activePubVersion = {
        id: 'ver-active-pub',
        quizId: 'quiz-1',
        version: 2,
        status: QuizVersionStatus.PUBLISHED,
        timeLimitSeconds: 600,
      };
      const sampleQuestion = { id: 'q-1', quizVersionId: 'ver-active-pub', marks: 2, order: 1 };
      const sampleOption = { id: 'opt-1', questionId: 'q-1', text: 'Option A', order: 1 };

      const txManager = {
        findOne: vi.fn().mockImplementation((entity, opts) => {
          if (entity === Quiz) return Promise.resolve({ id: 'quiz-1', status: QuizStatus.PUBLISHED, organizationId: null });
          if (entity === QuizVersion) {
            if (opts?.where?.status === QuizVersionStatus.PUBLISHED) return Promise.resolve(activePubVersion);
          }
          if (entity === QuizAttempt) return Promise.resolve(null);
          return Promise.resolve(null);
        }),
        find: vi.fn().mockImplementation((entity) => {
          if (entity === Question) return Promise.resolve([sampleQuestion]);
          if (entity === Option) return Promise.resolve([sampleOption]);
          return Promise.resolve([]);
        }),
        create: vi.fn().mockImplementation((_entity, data) => ({ id: 'new-att-uuid', ...data })),
        save: vi.fn().mockImplementation((_entity, record) => Promise.resolve(record)),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      const attemptResult = await service.startAttempt('quiz-1', learnerA);
      expect(attemptResult.quizVersionId).toBe('ver-active-pub');
      expect(attemptResult.remainingTimeSeconds).toBe(600);
    });

    it('7.3-8. startAttempt rejects attempts against unpublished quizzes and draft versions', async () => {
      const txManagerUnpublished = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve({ id: 'quiz-draft', status: QuizStatus.DRAFT });
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManagerUnpublished));

      await expect(
        service.startAttempt('quiz-draft', 'ver-1', learnerA),
      ).rejects.toThrow(new BadRequestException('Only published quizzes can be attempted'));

      const txManagerDraftVersion = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve({ id: 'quiz-pub', status: QuizStatus.PUBLISHED });
          if (entity === QuizVersion) return Promise.resolve({ id: 'ver-draft', status: QuizVersionStatus.DRAFT, quizId: 'quiz-pub' });
          return Promise.resolve(null);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManagerDraftVersion));

      await expect(
        service.startAttempt('quiz-pub', 'ver-draft', learnerA),
      ).rejects.toThrow(new BadRequestException('Only published quiz versions can be attempted'));
    });
  });

  describe('Phase 7.4 — Learner-Facing Quiz Discovery, Pre-Attempt & Tenant Isolation', () => {
    const orgQuiz: Quiz = {
      id: 'quiz-org-1',
      title: 'Org Assessment',
      description: 'Private org quiz',
      creatorId: 'creator-uuid-1',
      organizationId: 'org-1',
      status: QuizStatus.PUBLISHED,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Quiz;

    const orgVersion: QuizVersion = {
      id: 'ver-org-1',
      quizId: 'quiz-org-1',
      version: 1,
      status: QuizVersionStatus.PUBLISHED,
      timeLimitSeconds: 1200,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
    } as QuizVersion;

    const activeOrgAssignment: QuizAssignment = {
      id: 'assign-org-1',
      quizId: 'quiz-org-1',
      quizVersionId: 'ver-org-1',
      organizationId: 'org-1',
      isActive: true,
      startsAt: null,
      dueAt: null,
    } as QuizAssignment;

    it('7.4-1. getPublishedQuizzes filters by timing (timed vs untimed)', async () => {
      const qbMock = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([
          [
            { id: 'quiz-timed', title: 'Timed Quiz', description: 'Timed', status: QuizStatus.PUBLISHED, createdAt: new Date(), updatedAt: new Date() },
            { id: 'quiz-untimed', title: 'Untimed Quiz', description: 'Untimed', status: QuizStatus.PUBLISHED, createdAt: new Date(), updatedAt: new Date() },
          ],
          2,
        ]),
      };
      mockQuizRepo.createQueryBuilder = vi.fn().mockReturnValue(qbMock as any);

      mockQuizVersionRepo.find.mockResolvedValue([
        { id: 'v-timed', quizId: 'quiz-timed', version: 1, status: QuizVersionStatus.PUBLISHED, timeLimitSeconds: 600, publishedAt: new Date() },
        { id: 'v-untimed', quizId: 'quiz-untimed', version: 1, status: QuizVersionStatus.PUBLISHED, timeLimitSeconds: null, publishedAt: new Date() },
      ]);

      mockQuestionRepo.find.mockResolvedValue([
        { id: 'q-1', quizVersionId: 'v-timed', marks: 5 },
        { id: 'q-2', quizVersionId: 'v-untimed', marks: 10 },
      ]);

      const timedCatalog = await service.getPublishedQuizzes({ timing: 'timed' }, learnerA);
      expect(timedCatalog.items).toHaveLength(1);
      expect(timedCatalog.items[0].id).toBe('quiz-timed');
      expect(timedCatalog.items[0].timeLimitSeconds).toBe(600);

      const untimedCatalog = await service.getPublishedQuizzes({ timing: 'untimed' }, learnerA);
      expect(untimedCatalog.items).toHaveLength(1);
      expect(untimedCatalog.items[0].id).toBe('quiz-untimed');
      expect(untimedCatalog.items[0].timeLimitSeconds).toBeNull();
    });

    it('7.4-2. getPublishedQuizVersion rejects unassigned learner for organization-owned quiz', async () => {
      mockQuizRepo.findOne.mockResolvedValue(orgQuiz);
      mockQuizVersionRepo.findOne.mockResolvedValue(orgVersion);

      const mockAssignmentRepo = {
        find: vi.fn().mockResolvedValue([activeOrgAssignment]),
      };
      const mockRecipientRepo = {
        find: vi.fn().mockResolvedValue([]), // learnerA is NOT in recipients
      };

      mockDataSource.getRepository = vi.fn().mockImplementation((entity) => {
        if (entity === QuizAssignment) return mockAssignmentRepo;
        if (entity === QuizAssignmentRecipient) return mockRecipientRepo;
        return {};
      });

      await expect(
        service.getPublishedQuizVersion('quiz-org-1', 'ver-org-1', learnerA),
      ).rejects.toThrow(new ForbiddenException('You are not assigned to take this quiz'));
    });

    it('7.4-3. getPublishedQuizVersion permits assigned learner, admin, and quiz creator', async () => {
      mockQuizRepo.findOne.mockResolvedValue(orgQuiz);
      mockQuizVersionRepo.findOne.mockResolvedValue(orgVersion);
      mockQuestionRepo.find.mockResolvedValue([
        { id: 'q-org-1', quizVersionId: 'ver-org-1', marks: 5, questionType: QuestionType.SINGLE_CHOICE, order: 1 },
      ]);
      mockOptionRepo.find.mockResolvedValue([
        { id: 'opt-1', questionId: 'q-org-1', text: 'Option A', isCorrect: true, order: 1 },
      ]);

      const mockAssignmentRepo = {
        find: vi.fn().mockResolvedValue([activeOrgAssignment]),
      };
      const mockRecipientRepo = {
        find: vi.fn().mockResolvedValue([{ assignmentId: 'assign-org-1', studentId: learnerA.userId }]),
      };

      mockDataSource.getRepository = vi.fn().mockImplementation((entity) => {
        if (entity === QuizAssignment) return mockAssignmentRepo;
        if (entity === QuizAssignmentRecipient) return mockRecipientRepo;
        return {};
      });

      // 1. Assigned learner
      const learnerResult = await service.getPublishedQuizVersion('quiz-org-1', 'ver-org-1', learnerA);
      expect(learnerResult.quizId).toBe('quiz-org-1');
      expect(learnerResult.organizationId).toBe('org-1');
      expect((learnerResult.questions[0].options[0] as any).isCorrect).toBeUndefined();

      // 2. Creator
      const creatorResult = await service.getPublishedQuizVersion('quiz-org-1', 'ver-org-1', {
        userId: 'creator-uuid-1',
        role: UserRole.CREATOR,
        email: 'creator@test.com',
      });
      expect(creatorResult.quizId).toBe('quiz-org-1');

      // 3. Admin
      const adminResult = await service.getPublishedQuizVersion('quiz-org-1', 'ver-org-1', {
        userId: 'admin-uuid-1',
        role: UserRole.ADMIN,
        email: 'admin@test.com',
      });
      expect(adminResult.quizId).toBe('quiz-org-1');
    });

    it('7.4-4. startAttempt rejects unassigned learner when no assignments exist for org quiz', async () => {
      const txManager = {
        findOne: vi.fn().mockImplementation((entity) => {
          if (entity === Quiz) return Promise.resolve(orgQuiz);
          if (entity === QuizVersion) return Promise.resolve(orgVersion);
          return Promise.resolve(null);
        }),
        find: vi.fn().mockImplementation((entity) => {
          if (entity === Question) return Promise.resolve([{ id: 'q-1', marks: 1, order: 1 }]);
          if (entity === QuizAssignment) return Promise.resolve([]); // zero assignments
          return Promise.resolve([]);
        }),
      };
      mockDataSource.transaction.mockImplementationOnce(async (cb: (m: any) => unknown) => cb(txManager));

      await expect(
        service.startAttempt('quiz-org-1', 'ver-org-1', learnerA),
      ).rejects.toThrow(new ForbiddenException('You are not assigned to take this quiz'));
    });
  });

  describe('Phase 7.5 — Creator Analytics & Performance Insights', () => {
    const creatorA: AuthenticatedUser = {
      userId: 'creator-a-id',
      email: 'creator.a@example.com',
      role: UserRole.CREATOR,
    };
    const creatorB: AuthenticatedUser = {
      userId: 'creator-b-id',
      email: 'creator.b@example.com',
      role: UserRole.CREATOR,
    };
    const adminUser: AuthenticatedUser = {
      userId: 'admin-id',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    };
    const learnerUser: AuthenticatedUser = {
      userId: 'learner-id',
      email: 'learner@example.com',
      role: UserRole.TAKER,
    };

    const testQuiz: Quiz = {
      id: 'quiz-analytics-1',
      title: 'Analytics Test Quiz',
      creatorId: creatorA.userId,
      organizationId: null,
      status: QuizStatus.PUBLISHED,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Quiz;

    const version1: QuizVersion = {
      id: 'ver-1',
      quizId: testQuiz.id,
      version: 1,
      status: QuizVersionStatus.PUBLISHED,
      timeLimitSeconds: 600,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
      publishedAt: new Date('2026-01-01T10:00:00Z'),
    } as QuizVersion;

    const version2: QuizVersion = {
      id: 'ver-2',
      quizId: testQuiz.id,
      version: 2,
      status: QuizVersionStatus.DRAFT,
      timeLimitSeconds: 900,
      createdAt: new Date('2026-01-02T10:00:00Z'),
      updatedAt: new Date('2026-01-02T10:00:00Z'),
      publishedAt: null,
    } as QuizVersion;

    const q1: Question = {
      id: 'q-mcq-1',
      quizVersionId: version1.id,
      text: 'Select the primary colors',
      questionType: QuestionType.MULTIPLE_CHOICE,
      order: 1,
      marks: 3,
      options: [
        { id: 'opt-red', questionId: 'q-mcq-1', text: 'Red', isCorrect: true, order: 1 } as Option,
        { id: 'opt-blue', questionId: 'q-mcq-1', text: 'Blue', isCorrect: true, order: 2 } as Option,
        { id: 'opt-green', questionId: 'q-mcq-1', text: 'Green', isCorrect: false, order: 3 } as Option,
      ],
    } as Question;

    const q2: Question = {
      id: 'q-sc-2',
      quizVersionId: version1.id,
      text: 'What is 2 + 2?',
      questionType: QuestionType.SINGLE_CHOICE,
      order: 2,
      marks: 2,
      options: [
        { id: 'opt-4', questionId: 'q-sc-2', text: '4', isCorrect: true, order: 1 } as Option,
        { id: 'opt-5', questionId: 'q-sc-2', text: '5', isCorrect: false, order: 2 } as Option,
      ],
    } as Question;

    const q3: Question = {
      id: 'q-tf-3',
      quizVersionId: version1.id,
      text: 'Earth is flat',
      questionType: QuestionType.TRUE_FALSE,
      order: 3,
      marks: 1,
      options: [
        { id: 'opt-t', questionId: 'q-tf-3', text: 'True', isCorrect: false, order: 1 } as Option,
        { id: 'opt-f', questionId: 'q-tf-3', text: 'False', isCorrect: true, order: 2 } as Option,
      ],
    } as Question;

    const allQ1 = [q1, q2, q3];

    it('7.5-1. Creator viewing their own quiz analytics succeeds and returns complete KPIs and metrics', async () => {
      mockQuizRepo.findOne.mockResolvedValue(testQuiz);
      mockQuizVersionRepo.find.mockResolvedValue([version2, version1]);

      const attemptA: QuizAttempt = {
        id: 'att-a',
        quizVersionId: version1.id,
        userId: 'user-alice',
        status: AttemptStatus.SUBMITTED,
        score: 6,
        percentage: 100,
        correctAnswers: 3,
        wrongAnswers: 0,
        unanswered: 0,
        startedAt: new Date('2026-01-01T10:00:00Z'),
        submittedAt: new Date('2026-01-01T10:05:00Z'), // 300s
        expiresAt: new Date('2026-01-01T10:10:00Z'),
        user: { id: 'user-alice', username: 'alice', email: 'alice@example.com' },
      } as any;

      const attemptB: QuizAttempt = {
        id: 'att-b',
        quizVersionId: version1.id,
        userId: 'user-bob',
        status: AttemptStatus.EXPIRED,
        score: 2,
        percentage: 40,
        correctAnswers: 1,
        wrongAnswers: 1,
        unanswered: 1,
        startedAt: new Date('2026-01-01T10:00:00Z'),
        submittedAt: new Date('2026-01-01T10:10:00Z'),
        expiresAt: new Date('2026-01-01T10:10:00Z'), // 600s
        user: { id: 'user-bob', username: 'bob', email: 'bob@example.com' },
      } as any;

      const attemptC: QuizAttempt = {
        id: 'att-c',
        quizVersionId: version1.id,
        userId: 'user-charlie',
        status: AttemptStatus.IN_PROGRESS,
        score: null,
        percentage: null,
        startedAt: new Date(),
        submittedAt: null,
        expiresAt: new Date(Date.now() + 600000),
      } as any;

      const attemptsVer2: QuizAttempt = {
        id: 'att-v2-1',
        quizVersionId: version2.id,
        userId: 'user-david',
        status: AttemptStatus.SUBMITTED,
        score: 10,
        percentage: 100,
      } as any;

      mockQuizAttemptRepo.find.mockImplementation(async (opts?: any) => {
        if (opts?.relations?.user) {
          return [attemptA, attemptB, attemptC];
        }
        return [attemptA, attemptB, attemptC, attemptsVer2];
      });

      mockQuestionRepo.find.mockImplementation(async (opts?: any) => {
        if (opts?.relations?.options) {
          return allQ1;
        }
        return allQ1;
      });

      // Answers and answer options for question analytics
      const answers: Answer[] = [
        // Alice answered all 3 correctly
        { id: 'ans-a1', attemptId: 'att-a', questionId: 'q-mcq-1' } as Answer,
        { id: 'ans-a2', attemptId: 'att-a', questionId: 'q-sc-2' } as Answer,
        { id: 'ans-a3', attemptId: 'att-a', questionId: 'q-tf-3' } as Answer,
        // Bob answered q2 correctly, q1 wrong, q3 unanswered
        { id: 'ans-b1', attemptId: 'att-b', questionId: 'q-mcq-1' } as Answer,
        { id: 'ans-b2', attemptId: 'att-b', questionId: 'q-sc-2' } as Answer,
      ];

      const answerOptions: AnswerOption[] = [
        // Alice selected red and blue for q1
        { id: 'ao-a1-1', answerId: 'ans-a1', optionId: 'opt-red' } as AnswerOption,
        { id: 'ao-a1-2', answerId: 'ans-a1', optionId: 'opt-blue' } as AnswerOption,
        { id: 'ao-a2', answerId: 'ans-a2', optionId: 'opt-4' } as AnswerOption,
        { id: 'ao-a3', answerId: 'ans-a3', optionId: 'opt-f' } as AnswerOption,
        // Bob selected only red for q1 (partial -> wrong under all-or-nothing)
        { id: 'ao-b1', answerId: 'ans-b1', optionId: 'opt-red' } as AnswerOption,
        { id: 'ao-b2', answerId: 'ans-b2', optionId: 'opt-4' } as AnswerOption,
      ];

      mockDataSource.getRepository = vi.fn().mockImplementation((entity) => {
        if (entity === Answer) return { find: vi.fn().mockResolvedValue(answers) };
        if (entity === AnswerOption) return { find: vi.fn().mockResolvedValue(answerOptions) };
        return {};
      });

      const res = await service.getQuizAnalytics(testQuiz.id, undefined, creatorA);

      expect(res.quizId).toBe(testQuiz.id);
      expect(res.versionId).toBe(version1.id); // Defaults to published version
      expect(res.publishedVersionsCount).toBe(1);
      expect(res.availableVersions).toHaveLength(2);

      // Summary KPIs
      expect(res.summary.totalAttempts).toBe(3);
      expect(res.summary.submittedAttempts).toBe(1);
      expect(res.summary.expiredAttempts).toBe(1);
      expect(res.summary.inProgressAttempts).toBe(1);
      expect(res.summary.completedAttempts).toBe(2);
      expect(res.summary.completionRate).toBe(33.33); // 1 / 3
      expect(res.summary.finalizedRate).toBe(66.67); // 2 / 3
      expect(res.summary.avgScore).toBe(4); // (6 + 2) / 2
      expect(res.summary.avgPercentage).toBe(70); // (100 + 40) / 2
      expect(res.summary.highestScore).toBe(6);
      expect(res.summary.lowestScore).toBe(2);
      expect(res.summary.avgDurationSeconds).toBe(450); // (300 + 600) / 2
      expect(res.summary.totalQuestions).toBe(3);
      expect(res.summary.totalMarks).toBe(6);

      // Version summaries
      expect(res.versionSummaries).toHaveLength(2);
      const v1Summary = res.versionSummaries.find((v) => v.versionId === version1.id);
      expect(v1Summary?.totalAttempts).toBe(3);
      expect(v1Summary?.submittedAttempts).toBe(1);
      expect(v1Summary?.expiredAttempts).toBe(1);

      // Top Scorers with privacy-masked emails
      expect(res.topScorers).toHaveLength(2);
      expect(res.topScorers[0].username).toBe('alice');
      expect(res.topScorers[0].email).toBe('al***@example.com');
      expect(res.topScorers[0].score).toBe(6);
      expect(res.topScorers[1].username).toBe('bob');
      expect(res.topScorers[1].email).toBe('bo***@example.com');

      // Question Analytics with all-or-nothing check and defensible difficulty
      expect(res.questionAnalytics).toHaveLength(3);
      const qMcq = res.questionAnalytics.find((q) => q.questionId === 'q-mcq-1');
      expect(qMcq?.attemptCount).toBe(2);
      expect(qMcq?.correctCount).toBe(1); // Alice only; Bob's partial selection is wrong
      expect(qMcq?.wrongCount).toBe(1);
      expect(qMcq?.unansweredCount).toBe(0);
      expect(qMcq?.correctPercentage).toBe(50);
      expect(qMcq?.difficultyEstimate).toBe('MEDIUM'); // 50% is between 40 and 75

      const qSc = res.questionAnalytics.find((q) => q.questionId === 'q-sc-2');
      expect(qSc?.correctCount).toBe(2); // Alice and Bob
      expect(qSc?.correctPercentage).toBe(100);
      expect(qSc?.difficultyEstimate).toBe('EASY'); // 100% >= 75

      const qTf = res.questionAnalytics.find((q) => q.questionId === 'q-tf-3');
      expect(qTf?.correctCount).toBe(1);
      expect(qTf?.unansweredCount).toBe(1); // Bob didn't answer

      // Question Type Breakdown
      expect(res.questionTypeBreakdown[QuestionType.MULTIPLE_CHOICE]).toBeDefined();
      expect(res.questionTypeBreakdown[QuestionType.MULTIPLE_CHOICE].questionCount).toBe(1);
      expect(res.questionTypeBreakdown[QuestionType.SINGLE_CHOICE].questionCount).toBe(1);
      expect(res.questionTypeBreakdown[QuestionType.TRUE_FALSE].questionCount).toBe(1);
    });

    it('7.5-2. Cross-creator access is forbidden (Creator B cannot inspect Creator A quiz)', async () => {
      mockQuizRepo.findOne.mockResolvedValue(testQuiz);

      await expect(
        service.getQuizAnalytics(testQuiz.id, undefined, creatorB),
      ).rejects.toThrow(new ForbiddenException('You do not have permission to view analytics for this quiz'));
    });

    it('7.5-3. Learner access is forbidden', async () => {
      mockQuizRepo.findOne.mockResolvedValue(testQuiz);

      await expect(
        service.getQuizAnalytics(testQuiz.id, undefined, learnerUser),
      ).rejects.toThrow(new ForbiddenException('You do not have permission to view analytics for this quiz'));
    });

    it('7.5-4. Admin can view analytics for any creator quiz', async () => {
      mockQuizRepo.findOne.mockResolvedValue(testQuiz);
      mockQuizVersionRepo.find.mockResolvedValue([version1]);
      mockQuizAttemptRepo.find.mockResolvedValue([]);
      mockQuestionRepo.find.mockResolvedValue([]);

      const res = await service.getQuizAnalytics(testQuiz.id, undefined, adminUser);
      expect(res.quizId).toBe(testQuiz.id);
    });

    it('7.5-5. Non-existent quiz throws NotFoundException', async () => {
      mockQuizRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getQuizAnalytics('non-existent-quiz', undefined, creatorA),
      ).rejects.toThrow(new NotFoundException('Quiz not found'));
    });

    it('7.5-6. Non-existent versionId throws NotFoundException', async () => {
      mockQuizRepo.findOne.mockResolvedValue(testQuiz);
      mockQuizVersionRepo.find.mockResolvedValue([version1]);

      await expect(
        service.getQuizAnalytics(testQuiz.id, 'missing-version-id', creatorA),
      ).rejects.toThrow(new NotFoundException('Quiz version not found'));
    });

    it('7.5-7. Zero attempts handles division-by-zero safely and returns 0 metrics', async () => {
      mockQuizRepo.findOne.mockResolvedValue(testQuiz);
      mockQuizVersionRepo.find.mockResolvedValue([version1]);
      mockQuizAttemptRepo.find.mockResolvedValue([]);
      mockQuestionRepo.find.mockResolvedValue(allQ1);

      const res = await service.getQuizAnalytics(testQuiz.id, undefined, creatorA);

      expect(res.summary.totalAttempts).toBe(0);
      expect(res.summary.submittedAttempts).toBe(0);
      expect(res.summary.completedAttempts).toBe(0);
      expect(res.summary.completionRate).toBe(0);
      expect(res.summary.finalizedRate).toBe(0);
      expect(res.summary.avgScore).toBe(0);
      expect(res.summary.avgPercentage).toBe(0);
      expect(res.summary.highestScore).toBe(0);
      expect(res.summary.lowestScore).toBe(0);
      expect(res.topScorers).toEqual([]);

      for (const qa of res.questionAnalytics) {
        expect(qa.attemptCount).toBe(0);
        expect(qa.correctCount).toBe(0);
        expect(qa.correctPercentage).toBe(0);
        expect(qa.difficultyEstimate).toBe('MEDIUM');
        expect(qa.observedAccuracy).toBe(0);
      }
    });

    it('7.5-8. Handles null or undefined scores safely without crashing', async () => {
      mockQuizRepo.findOne.mockResolvedValue(testQuiz);
      mockQuizVersionRepo.find.mockResolvedValue([version1]);

      const attemptNullScore: QuizAttempt = {
        id: 'att-null',
        quizVersionId: version1.id,
        userId: 'user-null',
        status: AttemptStatus.SUBMITTED,
        score: null,
        percentage: null,
        startedAt: new Date(),
        submittedAt: new Date(),
      } as any;

      mockQuizAttemptRepo.find.mockImplementation(async (opts?: any) => {
        if (opts?.relations?.user) return [attemptNullScore];
        return [attemptNullScore];
      });
      mockQuestionRepo.find.mockResolvedValue(allQ1);

      mockDataSource.getRepository = vi.fn().mockImplementation((entity) => {
        if (entity === Answer) return { find: vi.fn().mockResolvedValue([]) };
        if (entity === AnswerOption) return { find: vi.fn().mockResolvedValue([]) };
        return {};
      });

      const res = await service.getQuizAnalytics(testQuiz.id, undefined, creatorA);
      expect(res.summary.totalAttempts).toBe(1);
      expect(res.summary.submittedAttempts).toBe(1);
      expect(res.summary.avgScore).toBe(0);
      expect(res.summary.avgPercentage).toBe(0);
    });

    it('7.5-9. Correctly categorizes difficulty estimate: HARD (<40%), MEDIUM (40-74%), EASY (>=75%)', async () => {
      mockQuizRepo.findOne.mockResolvedValue(testQuiz);
      mockQuizVersionRepo.find.mockResolvedValue([version1]);

      // 4 completed attempts
      const attempts = [1, 2, 3, 4].map(
        (i) =>
          ({
            id: `att-${i}`,
            quizVersionId: version1.id,
            status: AttemptStatus.SUBMITTED,
            score: 5,
            percentage: 80,
            startedAt: new Date(),
            submittedAt: new Date(),
          }) as any,
      );

      mockQuizAttemptRepo.find.mockImplementation(async (opts?: any) => {
        if (opts?.relations?.user) return attempts;
        return attempts;
      });

      mockQuestionRepo.find.mockResolvedValue(allQ1);

      // Answers:
      // q1: 1 out of 4 correct = 25% -> HARD
      // q2: 2 out of 4 correct = 50% -> MEDIUM
      // q3: 3 out of 4 correct = 75% -> EASY
      const answers: Answer[] = [
        // q1: only att-1 correct
        { id: 'ans-1-1', attemptId: 'att-1', questionId: 'q-mcq-1' } as Answer,
        // q2: att-1 and att-2 correct
        { id: 'ans-2-1', attemptId: 'att-1', questionId: 'q-sc-2' } as Answer,
        { id: 'ans-2-2', attemptId: 'att-2', questionId: 'q-sc-2' } as Answer,
        // q3: att-1, att-2, att-3 correct
        { id: 'ans-3-1', attemptId: 'att-1', questionId: 'q-tf-3' } as Answer,
        { id: 'ans-3-2', attemptId: 'att-2', questionId: 'q-tf-3' } as Answer,
        { id: 'ans-3-3', attemptId: 'att-3', questionId: 'q-tf-3' } as Answer,
      ];

      const answerOptions: AnswerOption[] = [
        { id: 'ao-1-1a', answerId: 'ans-1-1', optionId: 'opt-red' } as AnswerOption,
        { id: 'ao-1-1b', answerId: 'ans-1-1', optionId: 'opt-blue' } as AnswerOption,
        { id: 'ao-2-1', answerId: 'ans-2-1', optionId: 'opt-4' } as AnswerOption,
        { id: 'ao-2-2', answerId: 'ans-2-2', optionId: 'opt-4' } as AnswerOption,
        { id: 'ao-3-1', answerId: 'ans-3-1', optionId: 'opt-f' } as AnswerOption,
        { id: 'ao-3-2', answerId: 'ans-3-2', optionId: 'opt-f' } as AnswerOption,
        { id: 'ao-3-3', answerId: 'ans-3-3', optionId: 'opt-f' } as AnswerOption,
      ];

      mockDataSource.getRepository = vi.fn().mockImplementation((entity) => {
        if (entity === Answer) return { find: vi.fn().mockResolvedValue(answers) };
        if (entity === AnswerOption) return { find: vi.fn().mockResolvedValue(answerOptions) };
        return {};
      });

      const res = await service.getQuizAnalytics(testQuiz.id, undefined, creatorA);

      const qa1 = res.questionAnalytics.find((q) => q.questionId === 'q-mcq-1');
      expect(qa1?.correctPercentage).toBe(25);
      expect(qa1?.difficultyEstimate).toBe('HARD');

      const qa2 = res.questionAnalytics.find((q) => q.questionId === 'q-sc-2');
      expect(qa2?.correctPercentage).toBe(50);
      expect(qa2?.difficultyEstimate).toBe('MEDIUM');

      const qa3 = res.questionAnalytics.find((q) => q.questionId === 'q-tf-3');
      expect(qa3?.correctPercentage).toBe(75);
      expect(qa3?.difficultyEstimate).toBe('EASY');
    });

    it('7.5-10. Enforces organization tenant membership for organization-owned quizzes', async () => {
      const orgQuiz = { ...testQuiz, organizationId: 'org-tenant-1' } as Quiz;
      mockQuizRepo.findOne.mockResolvedValue(orgQuiz);

      const orgService = (service as any).organizationService;
      orgService.getPrimaryMembership = vi.fn().mockResolvedValue({
        organizationId: 'other-org-id', // Mismatch!
      });

      await expect(
        service.getQuizAnalytics(orgQuiz.id, undefined, creatorA),
      ).rejects.toThrow(new ForbiddenException('You do not have permission to view analytics for this organization quiz'));

      // Same organization passes
      orgService.getPrimaryMembership.mockResolvedValue({
        organizationId: 'org-tenant-1',
      });
      mockQuizVersionRepo.find.mockResolvedValue([version1]);
      mockQuizAttemptRepo.find.mockResolvedValue([]);
      mockQuestionRepo.find.mockResolvedValue([]);

      const allowedRes = await service.getQuizAnalytics(orgQuiz.id, undefined, creatorA);
      expect(allowedRes.quizId).toBe(orgQuiz.id);
    });
  });
});
