import { Test, TestingModule } from '@nestjs/testing';
import { QuizController } from './quizzes.controller.js';
import { QuizService } from './quizzes.service.js';
import { QuizGenerationService } from './quiz-generation.service.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { QuestionType } from './enums/question-type.enum.js';
import { DifficultyLevel } from './enums/difficulty-level.enum.js';

describe('QuizController', () => {
  let controller: QuizController;
  let mockQuizService: Partial<QuizService>;
  let mockQuizGenerationService: Partial<QuizGenerationService>;

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'creator@example.com',
    role: UserRole.CREATOR,
  };

  beforeEach(async () => {
    mockQuizService = {
      createQuiz: vi.fn(),
      getCreatorQuizzes: vi.fn(),
      getCreatorQuizDetails: vi.fn(),
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
});
