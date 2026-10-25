import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Quiz } from './entities/quiz.entity.js';
import { QuizVersion } from './entities/quiz-version.entity.js';
import { QuizService } from './quizzes.service.js';
import { QuizController } from './quizzes.controller.js';
import { Question } from './entities/question.entity.js';
import { Option } from './entities/option.entity.js';
import { QuizAttempt } from './entities/quiz-attempt.entity.js';
import { Answer } from './entities/answer.entity.js';
import { AnswerOption } from './entities/answer-option.entity.js';
import { QuizQuestionGeneration } from './entities/quiz-question-generation.entity.js';
import { QuizGenerationService } from './quiz-generation.service.js';
import { AiPdfStorageService } from './services/ai-pdf-storage.service.js';
import { AiQuestionGenerationProcessor } from './processors/ai-question-generation.processor.js';

import { OrganizationModule } from '../organizations/organization.module.js';
import { AiModule } from '../../ai/ai.module.js';

@Module({
  imports: [
    OrganizationModule,
    AiModule,
    TypeOrmModule.forFeature([
      Quiz,
      QuizVersion,
      Question,
      Option,
      QuizAttempt,
      Answer,
      AnswerOption,
      QuizQuestionGeneration,
    ]),
    BullModule.registerQueue({
      name: 'ai-question-generation',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: {
          count: 500,
          age: 86400,
        },
        removeOnFail: {
          count: 1000,
          age: 604800,
        },
      },
    }),
  ],
  controllers: [QuizController],
  providers: [
    QuizService,
    QuizGenerationService,
    AiPdfStorageService,
    AiQuestionGenerationProcessor,
  ],
  exports: [QuizService, QuizGenerationService, AiPdfStorageService],
})
export class QuizModule { }
