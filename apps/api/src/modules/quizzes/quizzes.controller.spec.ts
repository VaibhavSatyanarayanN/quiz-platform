import { Test, TestingModule } from '@nestjs/testing';
import { QuizController } from './quizzes.controller.js';
import { QuizService } from './quizzes.service.js';
import { QuizGenerationService } from './quiz-generation.service.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { QuestionType } from './enums/question-type.enum.js';
import { DifficultyLevel } from './enums/difficulty-level.enum.js';
import { AttemptStatus } from './enums/attempt-status.enum.js';
import { SubmitAttemptDto } from './dto/submit-attempt.dto.js';
import { CreatorQuizQueryDto } from './dto/creator-quiz-query.dto.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

describe('QuizController', () => {
  let controller: QuizController;
  let mockQuizService: Partial<QuizService>;
  let mockQuizGenerationService: Partial<QuizGenerationService>;

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'creator@example.com',
    role: UserRole.CREATOR,
  };

  const mockLearner: AuthenticatedUser = {
    userId: 'learner-1',
    email: 'learner@example.com',
    role: UserRole.TAKER,
  };

  beforeEach(async () => {
    mockQuizService = {
      createQuiz: vi.fn(),
      getCreatorQuizzes: vi.fn(),
      getCreatorQuizDetails: vi.fn(),
      startAttempt: vi.fn().mockResolvedValue({
        id: 'attempt-1',
        attemptId: 'attempt-1',
        quizId: 'quiz-1',
        quizVersionId: 'ver-1',
        status: AttemptStatus.IN_PROGRESS,
      } as any),
      saveAnswer: vi.fn().mockResolvedValue({
        answerId: 'ans-1',
        attemptId: 'attempt-1',
        questionId: 'q-1',
        optionIds: ['opt-1'],
      } as any),
      getAttempt: vi.fn().mockResolvedValue({
        id: 'attempt-1',
        attemptId: 'attempt-1',
        quizId: 'quiz-1',
        quizVersionId: 'ver-1',
        status: AttemptStatus.IN_PROGRESS,
        questions: [],
      } as any),
      getAttemptResult: vi.fn().mockResolvedValue({
        attemptId: 'attempt-1',
        quizId: 'quiz-1',
        quizVersionId: 'ver-1',
        status: AttemptStatus.SUBMITTED,
        score: 5,
        totalMarks: 5,
      } as any),
      getAttemptHistory: vi.fn().mockResolvedValue({
        items: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      }),
    };

    mockQuizGenerationService = {
      createGeneration: vi.fn().mockResolvedValue({ generationId: 'gen-1' } as any),
      createGenerationFromPdf: vi.fn().mockResolvedValue({ generationId: 'gen-2' } as any),
      getGenerationStatus: vi.fn().mockResolvedValue({ status: 'PENDING' } as any),
      cancelGeneration: vi.fn().mockResolvedValue({ status: 'CANCELLED' } as any),
      listGenerations: vi.fn().mockResolvedValue([]),
      getGenerationForReview: vi.fn().mockResolvedValue({ generationId: 'gen-1', questions: [] } as any),
      saveReviewDraft: vi.fn().mockResolvedValue({ generationId: 'gen-1', reviewStatus: 'reviewed' } as any),
      resetReviewDraftToOriginal: vi.fn().mockResolvedValue({ generationId: 'gen-1', reviewStatus: 'pending_review' } as any),
      applyGeneratedQuestions: vi.fn().mockResolvedValue({ generationId: 'gen-1', appliedQuestionsCount: 2 } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [
        {
          provide: QuizService,
          useValue: mockQuizService,
        },
        {
          provide: QuizGenerationService,
          useValue: mockQuizGenerationService,
        },
      ],
    }).compile();

    controller = module.get<QuizController>(QuizController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Learner Attempt Endpoints', () => {
    it('startAttempt should delegate to quizService.startAttempt with authenticated learner', async () => {
      const result = await controller.startAttempt('quiz-1', 'ver-1', mockLearner);
      expect(result.attemptId).toBe('attempt-1');
      expect(mockQuizService.startAttempt).toHaveBeenCalledWith(
        'quiz-1',
        'ver-1',
        mockLearner,
      );
    });

    it('getAttempt should delegate to quizService.getAttempt with authenticated user', async () => {
      const result = await controller.getAttempt('attempt-1', mockLearner);
      expect(result.attemptId).toBe('attempt-1');
      expect(mockQuizService.getAttempt).toHaveBeenCalledWith(
        'attempt-1',
        mockLearner,
      );
    });

    it('getAttemptForQuiz should delegate to quizService.getAttempt with expected quizId', async () => {
      const result = await controller.getAttemptForQuiz('quiz-1', 'attempt-1', mockLearner);
      expect(result.attemptId).toBe('attempt-1');
      expect(mockQuizService.getAttempt).toHaveBeenCalledWith(
        'attempt-1',
        mockLearner,
        'quiz-1',
      );
    });

    it('getAttemptResult should delegate to quizService.getAttemptResult with authenticated user', async () => {
      const result = await controller.getAttemptResult('attempt-1', mockLearner);
      expect(result.attemptId).toBe('attempt-1');
      expect(mockQuizService.getAttemptResult).toHaveBeenCalledWith(
        'attempt-1',
        mockLearner,
      );
    });

    it('saveAnswer and saveAnswerViaPost should delegate to quizService.saveAnswer with authenticated user', async () => {
      const dto = { optionIds: ['opt-1'] };
      const putRes = await controller.saveAnswer('attempt-1', 'q-1', dto, mockLearner);
      expect(putRes.optionIds).toEqual(['opt-1']);
      expect(mockQuizService.saveAnswer).toHaveBeenCalledWith(
        'attempt-1',
        'q-1',
        dto,
        mockLearner,
      );

      const postRes = await controller.saveAnswerViaPost('attempt-1', 'q-1', dto, mockLearner);
      expect(postRes.optionIds).toEqual(['opt-1']);
      expect(mockQuizService.saveAnswer).toHaveBeenCalledTimes(2);
    });

    it('submitAttempt should delegate to quizService.submitAttempt with attemptId and authenticated user', async () => {
      mockQuizService.submitAttempt = vi.fn().mockResolvedValue({
        attemptId: 'attempt-1',
        status: AttemptStatus.SUBMITTED,
        score: 6,
        totalMarks: 6,
        percentage: 100,
      } as any);

      const result = await controller.submitAttempt('attempt-1', mockLearner, new SubmitAttemptDto());
      expect(result.status).toBe(AttemptStatus.SUBMITTED);
      expect(mockQuizService.submitAttempt).toHaveBeenCalledWith('attempt-1', mockLearner);
    });

    it('getMyAttemptHistory should delegate to quizService.getAttemptHistory with user.userId', async () => {
      const query = { page: 1, limit: 10 };
      const result = await controller.getMyAttemptHistory(query, mockLearner);
      expect(result).toEqual({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 });
      expect(mockQuizService.getAttemptHistory).toHaveBeenCalledWith(
        mockLearner.userId,
        query,
      );
    });

    it('getAttemptHistory should delegate to quizService.getAttemptHistory with user.userId and quizId', async () => {
      const query = { page: 1, limit: 10 };
      const result = await controller.getAttemptHistory('quiz-1', query, mockLearner);
      expect(result).toEqual({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 });
      expect(mockQuizService.getAttemptHistory).toHaveBeenCalledWith(
        mockLearner.userId,
        { ...query, quizId: 'quiz-1' },
      );
    });
  });

  describe('AI Generation Endpoints', () => {
    it('generateQuestions should delegate to quizGenerationService.createGeneration', async () => {
      const dto = {
        topic: 'Python',
        targetQuestionCount: 5,
        questionTypes: [QuestionType.SINGLE_CHOICE],
        difficulty: DifficultyLevel.MEDIUM,
      };

      const result = await controller.generateQuestions('quiz-1', 'ver-1', dto, mockUser);
      expect(result).toEqual({ generationId: 'gen-1' });
      expect(mockQuizGenerationService.createGeneration).toHaveBeenCalledWith(
        'quiz-1',
        'ver-1',
        dto,
        mockUser,
      );
    });

    it('generateQuestionsFromPdf should delegate to quizGenerationService.createGenerationFromPdf', async () => {
      const file = {
        buffer: Buffer.from('%PDF-1.4 test'),
        originalname: 'test.pdf',
        size: 15,
      } as Express.Multer.File;
      const dto = { targetQuestionCount: 5 };

      const result = await controller.generateQuestionsFromPdf(
        'quiz-1',
        'ver-1',
        file,
        dto,
        mockUser,
      );
      expect(result).toEqual({ generationId: 'gen-2' });
      expect(mockQuizGenerationService.createGenerationFromPdf).toHaveBeenCalledWith(
        'quiz-1',
        'ver-1',
        file,
        dto,
        mockUser,
      );
    });

    it('getGenerationStatus should delegate to quizGenerationService.getGenerationStatus', async () => {
      const result = await controller.getGenerationStatus('quiz-1', 'gen-1', mockUser);
      expect(result).toEqual({ status: 'PENDING' });
      expect(mockQuizGenerationService.getGenerationStatus).toHaveBeenCalledWith(
        'quiz-1',
        'gen-1',
        mockUser,
      );
    });

    it('listGenerations should delegate to quizGenerationService.listGenerations', async () => {
      const result = await controller.listGenerations('quiz-1', mockUser);
      expect(result).toEqual([]);
      expect(mockQuizGenerationService.listGenerations).toHaveBeenCalledWith(
        'quiz-1',
        mockUser,
      );
    });

    it('cancelGeneration should delegate to quizGenerationService.cancelGeneration', async () => {
      const result = await controller.cancelGeneration('quiz-1', 'gen-1', mockUser);
      expect(result).toEqual({ status: 'CANCELLED' });
      expect(mockQuizGenerationService.cancelGeneration).toHaveBeenCalledWith(
        'quiz-1',
        'gen-1',
        mockUser,
      );
    });

    it('cancelGenerationViaPost should delegate to quizGenerationService.cancelGeneration', async () => {
      const result = await controller.cancelGenerationViaPost('quiz-1', 'gen-1', mockUser);
      expect(result).toEqual({ status: 'CANCELLED' });
      expect(mockQuizGenerationService.cancelGeneration).toHaveBeenCalledWith(
        'quiz-1',
        'gen-1',
        mockUser,
      );
    });

    it('getGenerationForReview should delegate to quizGenerationService.getGenerationForReview', async () => {
      const result = await controller.getGenerationForReview('quiz-1', 'gen-1', mockUser);
      expect(result).toEqual({ generationId: 'gen-1', questions: [] });
      expect(mockQuizGenerationService.getGenerationForReview).toHaveBeenCalledWith(
        'quiz-1',
        'gen-1',
        mockUser,
      );
    });

    it('saveReviewDraft should delegate to quizGenerationService.saveReviewDraft', async () => {
      const dto = {
        questions: [
          {
            text: 'Updated Question',
            questionType: QuestionType.SINGLE_CHOICE,
            marks: 1,
            options: [
              { id: 'A', text: 'Option 1', isCorrect: true },
              { id: 'B', text: 'Option 2', isCorrect: false },
            ],
          },
        ],
      };
      const result = await controller.saveReviewDraft('quiz-1', 'gen-1', dto, mockUser);
      expect(result).toEqual({ generationId: 'gen-1', reviewStatus: 'reviewed' });
      expect(mockQuizGenerationService.saveReviewDraft).toHaveBeenCalledWith(
        'quiz-1',
        'gen-1',
        dto,
        mockUser,
      );
    });

    it('saveReviewDraftViaPatch should delegate to quizGenerationService.saveReviewDraft', async () => {
      const dto = {
        questions: [
          {
            text: 'Patched Question',
            questionType: QuestionType.TRUE_FALSE,
            marks: 1,
            options: [
              { id: 'A', text: 'True', isCorrect: true },
              { id: 'B', text: 'False', isCorrect: false },
            ],
          },
        ],
      };
      const result = await controller.saveReviewDraftViaPatch('quiz-1', 'gen-1', dto, mockUser);
      expect(result).toEqual({ generationId: 'gen-1', reviewStatus: 'reviewed' });
      expect(mockQuizGenerationService.saveReviewDraft).toHaveBeenCalledWith(
        'quiz-1',
        'gen-1',
        dto,
        mockUser,
      );
    });

    it('resetReviewDraft should delegate to quizGenerationService.resetReviewDraftToOriginal', async () => {
      const result = await controller.resetReviewDraft('quiz-1', 'gen-1', mockUser);
      expect(result).toEqual({ generationId: 'gen-1', reviewStatus: 'pending_review' });
      expect(mockQuizGenerationService.resetReviewDraftToOriginal).toHaveBeenCalledWith(
        'quiz-1',
        'gen-1',
        mockUser,
      );
    });

    it('applyGeneratedQuestions should delegate to quizGenerationService.applyGeneratedQuestions', async () => {
      const dto = { targetVersionId: 'ver-1' };
      const result = await controller.applyGeneratedQuestions('quiz-1', 'gen-1', dto, mockUser);
      expect(result).toEqual({ generationId: 'gen-1', appliedQuestionsCount: 2 });
      expect(mockQuizGenerationService.applyGeneratedQuestions).toHaveBeenCalledWith(
        'quiz-1',
        'gen-1',
        dto,
        mockUser,
      );
    });
  });

  describe('Phase 7.1 — Creator Dashboard Endpoints', () => {
    it('getCreatorQuizzes should delegate to quizService.getCreatorQuizzes with user and query', async () => {
      const query: CreatorQuizQueryDto = {
        page: 1,
        limit: 10,
        search: 'TypeScript',
      };
      const expectedResponse = {
        items: [
          {
            id: 'quiz-1',
            title: 'TypeScript Masterclass',
            description: 'Advanced types',
            status: 'draft' as any,
            publishedVersionsCount: 1,
            hasDraft: true,
            latestVersion: 2,
            latestVersionId: 'ver-2',
            latestVersionStatus: 'draft' as any,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      };
      (mockQuizService.getCreatorQuizzes as any).mockResolvedValue(expectedResponse);

      const result = await controller.getCreatorQuizzes(query, mockUser);
      expect(result).toEqual(expectedResponse);
      expect(mockQuizService.getCreatorQuizzes).toHaveBeenCalledWith(mockUser, query);
    });

    it('getCreatorQuizzes should have @Roles(UserRole.CREATOR, UserRole.ADMIN) metadata', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.getCreatorQuizzes);
      expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
    });

    it('getCreatorQuizDetails should delegate to quizService.getCreatorQuizDetails', async () => {
      const expectedQuiz = {
        id: 'quiz-1',
        title: 'Quiz 1',
        description: null,
        status: 'published' as any,
        creatorId: mockUser.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [],
      };
      (mockQuizService.getCreatorQuizDetails as any).mockResolvedValue(expectedQuiz);

      const result = await controller.getCreatorQuizDetails('quiz-1', mockUser);
      expect(result).toEqual(expectedQuiz);
      expect(mockQuizService.getCreatorQuizDetails).toHaveBeenCalledWith('quiz-1', mockUser);
    });

    it('getCreatorQuizDetails should have @Roles(UserRole.CREATOR, UserRole.ADMIN) metadata', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.getCreatorQuizDetails);
      expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
    });

    it('updateQuiz should delegate to quizService.updateQuiz with user principal', async () => {
      const updateDto = { title: 'Updated Title' };
      const expectedResult = {
        id: 'quiz-1',
        title: 'Updated Title',
        description: null,
        status: 'draft' as any,
        creatorId: mockUser.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockQuizService.updateQuiz as any) = vi.fn().mockResolvedValue(expectedResult);

      const result = await controller.updateQuiz('quiz-1', updateDto, mockUser);
      expect(result).toEqual(expectedResult);
      expect(mockQuizService.updateQuiz).toHaveBeenCalledWith('quiz-1', mockUser, updateDto);
    });

    describe('Phase 7.2 — Version integrity & metadata editing controller endpoints', () => {
      it('updateQuizVersion should delegate to quizService.updateQuizVersion and enforce roles', async () => {
        const updateVersionDto = { timeLimitSeconds: 1800 };
        const expectedVersion = {
          id: 'ver-1',
          quizId: 'quiz-1',
          version: 1,
          status: 'draft' as any,
          timeLimitSeconds: 1800,
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        (mockQuizService.updateQuizVersion as any) = vi.fn().mockResolvedValue(expectedVersion);

        const result = await controller.updateQuizVersion('quiz-1', 'ver-1', updateVersionDto, mockUser);
        expect(result).toEqual(expectedVersion);
        expect(mockQuizService.updateQuizVersion).toHaveBeenCalledWith('quiz-1', 'ver-1', mockUser, updateVersionDto);

        const roles = Reflect.getMetadata(ROLES_KEY, controller.updateQuizVersion);
        expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
      });

      it('createQuestionsBulk should have @Roles(UserRole.CREATOR, UserRole.ADMIN) metadata and pass user', async () => {
        const roles = Reflect.getMetadata(ROLES_KEY, controller.createQuestionsBulk);
        expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);

        (mockQuizService.saveQuestionsBulk as any) = vi.fn().mockResolvedValue({ quizId: 'quiz-1', questions: [] });
        const bulkDto = { questions: [] };
        await controller.createQuestionsBulk('quiz-1', 'ver-1', bulkDto, mockUser);
        expect(mockQuizService.saveQuestionsBulk).toHaveBeenCalledWith('quiz-1', 'ver-1', bulkDto, mockUser);
      });

      it('publishVersion should have @Roles(UserRole.CREATOR, UserRole.ADMIN) metadata and pass user', async () => {
        const roles = Reflect.getMetadata(ROLES_KEY, controller.publishVersion);
        expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);

        (mockQuizService.publishVersion as any) = vi.fn().mockResolvedValue({ quizId: 'quiz-1', quizVersionId: 'ver-1' });
        await controller.publishVersion('quiz-1', 'ver-1', mockUser);
        expect(mockQuizService.publishVersion).toHaveBeenCalledWith('quiz-1', 'ver-1', mockUser);
      });

      it('createNewVersion should have @Roles(UserRole.CREATOR, UserRole.ADMIN) metadata and pass user', async () => {
        const roles = Reflect.getMetadata(ROLES_KEY, controller.createNewVersion);
        expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);

        (mockQuizService.createNewVersion as any) = vi.fn().mockResolvedValue({ quizId: 'quiz-1', quizVersionId: 'ver-2', version: 2 });
        await controller.createNewVersion('quiz-1', mockUser);
        expect(mockQuizService.createNewVersion).toHaveBeenCalledWith('quiz-1', mockUser);
      });

      it('discardVersion should have @Roles(UserRole.CREATOR, UserRole.ADMIN) metadata and pass user', async () => {
        const roles = Reflect.getMetadata(ROLES_KEY, controller.discardVersion);
        expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);

        (mockQuizService.discardVersion as any) = vi.fn().mockResolvedValue({ id: 'ver-2', status: 'archived' });
        await controller.discardVersion('quiz-1', 'ver-2', mockUser);
        expect(mockQuizService.discardVersion).toHaveBeenCalledWith('quiz-1', 'ver-2', mockUser);
      });

      it('getPublishedQuizzes should delegate to quizService.getPublishedQuizzes without @Roles restriction', async () => {
        const roles = Reflect.getMetadata(ROLES_KEY, controller.getPublishedQuizzes);
        expect(roles).toBeUndefined();

        const mockResponse = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
        (mockQuizService.getPublishedQuizzes as any) = vi.fn().mockResolvedValue(mockResponse);

        const result = await controller.getPublishedQuizzes({ page: 1, limit: 10 }, mockLearner);
        expect(result).toBe(mockResponse);
        expect(mockQuizService.getPublishedQuizzes).toHaveBeenCalledWith({ page: 1, limit: 10 }, mockLearner);
      });

      it('getLatestPublishedQuizVersion should delegate to quizService.getLatestPublishedQuizVersion without @Roles restriction', async () => {
        const roles = Reflect.getMetadata(ROLES_KEY, controller.getLatestPublishedQuizVersion);
        expect(roles).toBeUndefined();

        const mockVersionResponse = { quizId: 'quiz-1', quizVersionId: 'ver-1', questions: [] };
        (mockQuizService.getLatestPublishedQuizVersion as any) = vi.fn().mockResolvedValue(mockVersionResponse);

        const result = await controller.getLatestPublishedQuizVersion('quiz-1', mockLearner);
        expect(result).toBe(mockVersionResponse);
        expect(mockQuizService.getLatestPublishedQuizVersion).toHaveBeenCalledWith('quiz-1', mockLearner);
      });

      it('startAttempt should support 2-argument invocation with just quizId and authenticated learner', async () => {
        (mockQuizService.startAttempt as any) = vi.fn().mockResolvedValue({ attemptId: 'att-1' });
        const result = await controller.startAttempt('quiz-1', mockLearner);
        expect(result).toEqual({ attemptId: 'att-1' });
        expect(mockQuizService.startAttempt).toHaveBeenCalledWith('quiz-1', undefined, mockLearner);
      });

      it('getQuizAnalytics should enforce @Roles(CREATOR, ADMIN) and delegate to quizService', async () => {
        const roles = Reflect.getMetadata(ROLES_KEY, controller.getQuizAnalytics);
        expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);

        const mockAnalytics = { quizId: 'quiz-1', summary: {} };
        (mockQuizService.getQuizAnalytics as any) = vi.fn().mockResolvedValue(mockAnalytics);

        // Path versionId
        const pathResult = await controller.getQuizAnalytics('quiz-1', 'ver-path', undefined, mockUser);
        expect(pathResult).toBe(mockAnalytics);
        expect(mockQuizService.getQuizAnalytics).toHaveBeenCalledWith('quiz-1', 'ver-path', mockUser);

        // Query versionId
        const queryResult = await controller.getQuizAnalytics('quiz-1', undefined, 'ver-query', mockUser);
        expect(queryResult).toBe(mockAnalytics);
        expect(mockQuizService.getQuizAnalytics).toHaveBeenCalledWith('quiz-1', 'ver-query', mockUser);
      });
    });
  });
});
