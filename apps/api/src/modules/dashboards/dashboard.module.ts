import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizAssignmentRecipient } from '../quiz-assignments/entities/quiz-assignment-recipient.entity.js';
import { QuizAttempt } from '../quizzes/entities/quiz-attempt.entity.js';
import { ClassroomTeacher } from '../classrooms/entities/classroom-teacher.entity.js';
import { ClassroomStudent } from '../classrooms/entities/classroom-student.entity.js';
import { Quiz } from '../quizzes/entities/quiz.entity.js';
import { QuizAssignment } from '../quiz-assignments/entities/quiz-assignment.entity.js';
import { StudentDashboardService } from './student-dashboard.service.js';
import { TeacherDashboardService } from './teacher-dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuizAssignmentRecipient,
      QuizAttempt,
      ClassroomTeacher,
      ClassroomStudent,
      Quiz,
      QuizAssignment,
    ]),
  ],
  controllers: [DashboardController],
  providers: [StudentDashboardService, TeacherDashboardService],
  exports: [StudentDashboardService, TeacherDashboardService],
})
export class DashboardModule {}
