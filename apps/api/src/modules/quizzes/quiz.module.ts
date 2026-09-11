import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Quiz } from './entities/quiz.entity.js';
import { QuizVersion } from './entities/quiz-version.entity.js';
import { QuizService } from './quizzes.service.js';
import { QuizController } from './quizzes.controller.js';
import { Question } from './entities/question.entity.js';
import { Option } from './entities/option.entity.js';
import { QuizAttempt } from './entities/quiz-attempt.entity.js';
import { Answer } from './entities/answer.entity.js';
import { AnswerOption } from './entities/answer-option.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quiz,
      QuizVersion,
      Question,
      Option,
      QuizAttempt,
      Answer,
      AnswerOption,
    ]),
  ],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule { }