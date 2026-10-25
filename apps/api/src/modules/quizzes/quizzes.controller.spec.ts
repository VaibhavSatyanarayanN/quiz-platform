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
      listGenerations: vi.fn().mockResolvedValue([]),
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
  });
});
