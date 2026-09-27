import { Test, TestingModule } from '@nestjs/testing';
import { QuizController } from './quizzes.controller.js';
import { QuizService } from './quizzes.service.js';

describe('QuizController', () => {
  let controller: QuizController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [
        {
          provide: QuizService,
          useValue: {
            createQuiz: vi.fn(),
            getQuizzes: vi.fn(),
            getQuizById: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<QuizController>(QuizController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
