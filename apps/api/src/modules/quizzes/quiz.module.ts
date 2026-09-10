import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Quiz } from './entities/quiz.entity.js';
import { QuizVersion } from './entities/quiz-version.entity.js';
import { QuizService } from './quizzes.service.js';
import { QuizController } from './quizzes.controller.js';
import { Question } from './entities/question.entity.js';
import { Option } from './entities/option.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quiz,
      QuizVersion,
      Question,
      Option
    ]),
  ],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}