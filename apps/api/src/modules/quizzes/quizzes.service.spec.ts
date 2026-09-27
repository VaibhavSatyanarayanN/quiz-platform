import { Test, TestingModule } from '@nestjs/testing';
import { QuizService } from './quizzes.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Quiz } from './entities/quiz.entity.js';
import { QuizVersion } from './entities/quiz-version.entity.js';
import { Question } from './entities/question.entity.js';
import { Option } from './entities/option.entity.js';
import { QuizAttempt } from './entities/quiz-attempt.entity.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { DataSource } from 'typeorm';

describe('QuizService', () => {
  let service: QuizService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: getRepositoryToken(Quiz), useValue: {} },
        { provide: getRepositoryToken(QuizVersion), useValue: {} },
        { provide: getRepositoryToken(Question), useValue: {} },
        { provide: getRepositoryToken(Option), useValue: {} },
        { provide: getRepositoryToken(QuizAttempt), useValue: {} },
        { provide: OrganizationService, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
