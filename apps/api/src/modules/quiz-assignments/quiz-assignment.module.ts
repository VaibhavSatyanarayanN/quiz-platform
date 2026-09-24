import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizAssignment } from './entities/quiz-assignment.entity.js';
import { QuizAssignmentRecipient } from './entities/quiz-assignment-recipient.entity.js';
import { QuizVersion } from '../quizzes/entities/quiz-version.entity.js';
import { QuizAssignmentService } from './quiz-assignment.service.js';
import { QuizAssignmentController } from './quiz-assignment.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuizAssignment,
      QuizAssignmentRecipient,
      QuizVersion,
    ]),
  ],
  controllers: [QuizAssignmentController],
  providers: [QuizAssignmentService],
  exports: [QuizAssignmentService, TypeOrmModule],
})
export class QuizAssignmentModule {}
