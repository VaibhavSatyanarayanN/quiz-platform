import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassroomTeacher } from '../classrooms/entities/classroom-teacher.entity.js';
import { ClassroomStudent } from '../classrooms/entities/classroom-student.entity.js';
import { Quiz } from '../quizzes/entities/quiz.entity.js';
import { QuizAssignment } from '../quiz-assignments/entities/quiz-assignment.entity.js';
import { QuizAttempt } from '../quizzes/entities/quiz-attempt.entity.js';
import { AttemptStatus } from '../quizzes/enums/attempt-status.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Injectable()
export class TeacherDashboardService {
  constructor(
    @InjectRepository(ClassroomTeacher)
    private readonly classroomTeacherRepository: Repository<ClassroomTeacher>,

    @InjectRepository(ClassroomStudent)
    private readonly classroomStudentRepository: Repository<ClassroomStudent>,

    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,

    @InjectRepository(QuizAssignment)
    private readonly assignmentRepository: Repository<QuizAssignment>,

    @InjectRepository(QuizAttempt)
    private readonly attemptRepository: Repository<QuizAttempt>,
  ) {}

  async getTeacherDashboard(user: AuthenticatedUser) {
    const teacherClassrooms = await this.classroomTeacherRepository.find({
      where: { teacherId: user.userId },
      relations: { classroom: true },
    });

    const myClassroomsCount = teacherClassrooms.length;
    const classroomIds = teacherClassrooms.map((tc) => tc.classroomId);

    let myStudentsCount = 0;
    if (classroomIds.length > 0) {
      const students = await this.classroomStudentRepository.find({
        where: classroomIds.map((id) => ({ classroomId: id, isActive: true })),
      });
      const uniqueStudentIds = new Set(students.map((s) => s.studentId));
      myStudentsCount = uniqueStudentIds.size;
    }

    const myQuizzes = await this.quizRepository.find({
      where: { creatorId: user.userId },
    });
    const myQuizzesCount = myQuizzes.length;

    const myAssignments = await this.assignmentRepository.find({
      where: { assignedBy: user.userId, isActive: true },
      relations: { classroom: true, quiz: true },
      order: { createdAt: 'DESC' },
    });
    const assignedQuizzesCount = myAssignments.length;

    let completedAttemptsCount = 0;
    let avgScorePercentage = 0;

    if (myQuizzesCount > 0) {
      const quizIds = myQuizzes.map((q) => q.id);
      const attempts = await this.attemptRepository.find({
        where: quizIds.map((id) => ({ quizId: id, status: AttemptStatus.SUBMITTED })),
      });
      completedAttemptsCount = attempts.length;

      if (completedAttemptsCount > 0) {
        const sumPct = attempts.reduce((sum, a) => sum + Number(a.percentage ?? 0), 0);
        avgScorePercentage = Math.round((sumPct / completedAttemptsCount) * 100) / 100;
      }
    }

    return {
      metrics: {
        myClassrooms: myClassroomsCount,
        myStudents: myStudentsCount,
        myQuizzes: myQuizzesCount,
        assignedQuizzes: assignedQuizzesCount,
        completedAttempts: completedAttemptsCount,
        avgScorePercentage,
      },
      recentAssignments: myAssignments.slice(0, 10).map((a) => ({
        id: a.id,
        quizTitle: a.quiz?.title,
        classroomName: a.classroom?.name ?? 'Individual Students',
        dueAt: a.dueAt,
        createdAt: a.createdAt,
      })),
    };
  }
}
