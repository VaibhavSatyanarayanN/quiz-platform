import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { QuizAssignmentRecipient } from '../quiz-assignments/entities/quiz-assignment-recipient.entity.js';
import { QuizAttempt } from '../quizzes/entities/quiz-attempt.entity.js';
import { AttemptStatus } from '../quizzes/enums/attempt-status.enum.js';

@Injectable()
export class StudentDashboardService {
  constructor(
    @InjectRepository(QuizAssignmentRecipient)
    private readonly recipientRepository: Repository<QuizAssignmentRecipient>,

    @InjectRepository(QuizAttempt)
    private readonly attemptRepository: Repository<QuizAttempt>,

    private readonly dataSource: DataSource,
  ) {}

  async getStudentDashboard(studentId: string) {
    const recipients = await this.recipientRepository.find({
      where: { studentId },
      relations: {
        assignment: {
          quiz: true,
          quizVersion: true,
          classroom: true,
        },
      },
    });

    const activeAssignments = recipients.map((r) => r.assignment).filter((a) => a && a.isActive);
    const assignedQuizzesCount = activeAssignments.length;

    // Fetch student's submitted attempts
    const submittedAttempts = await this.attemptRepository.find({
      where: { userId: studentId, status: AttemptStatus.SUBMITTED },
      order: { submittedAt: 'ASC' },
    });

    const now = new Date();
    let completedQuizzesCount = 0;
    let pendingQuizzesCount = 0;
    let missedQuizzesCount = 0;

    const recentQuizzesList: Array<{
      assignmentId: string;
      quizId: string;
      quizVersionId: string;
      quizTitle: string;
      classroomName: string | null;
      status: 'completed' | 'pending' | 'missed';
      score: number | null;
      percentage: number | null;
      dueAt: Date | null;
    }> = [];

    for (const a of activeAssignments) {
      const attempt = submittedAttempts.find(
        (att) => att.quizId === a.quizId && att.quizVersionId === a.quizVersionId,
      );

      let status: 'completed' | 'pending' | 'missed' = 'pending';
      if (attempt) {
        status = 'completed';
        completedQuizzesCount++;
      } else if (a.dueAt && new Date(a.dueAt) < now) {
        status = 'missed';
        missedQuizzesCount++;
      } else {
        pendingQuizzesCount++;
      }

      recentQuizzesList.push({
        assignmentId: a.id,
        quizId: a.quizId,
        quizVersionId: a.quizVersionId,
        quizTitle: a.quiz?.title ?? 'Quiz',
        classroomName: a.classroom?.name ?? null,
        status,
        score: attempt?.score ?? null,
        percentage: attempt?.percentage ? Number(attempt.percentage) : null,
        dueAt: a.dueAt,
      });
    }

    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unansweredQuestions = 0;
    let sumScore = 0;
    let sumPercentage = 0;

    const performanceOverTime = submittedAttempts.map((att) => {
      correctAnswers += att.correctAnswers ?? 0;
      wrongAnswers += att.wrongAnswers ?? 0;
      unansweredQuestions += att.unanswered ?? 0;
      sumScore += att.score ?? 0;
      sumPercentage += Number(att.percentage ?? 0);

      return {
        date: att.submittedAt ? att.submittedAt.toISOString() : new Date().toISOString(),
        score: att.score ?? 0,
        percentage: Number(att.percentage ?? 0),
      };
    });

    const totalQuestionsAnswered = correctAnswers + wrongAnswers;
    const completedCount = submittedAttempts.length;

    const avgScore = completedCount > 0 ? Math.round((sumScore / completedCount) * 100) / 100 : 0;
    const avgPercentage = completedCount > 0 ? Math.round((sumPercentage / completedCount) * 100) / 100 : 0;
    const accuracy = totalQuestionsAnswered > 0 ? Math.round((correctAnswers / totalQuestionsAnswered) * 10000) / 100 : 0;

    return {
      metrics: {
        assignedQuizzes: assignedQuizzesCount,
        completedQuizzes: completedQuizzesCount,
        pendingQuizzes: pendingQuizzesCount,
        missedQuizzes: missedQuizzesCount,
        totalQuestionsAnswered,
        correctAnswers,
        wrongAnswers,
        unansweredQuestions,
        avgScore,
        avgPercentage,
        accuracy,
      },
      recentQuizzes: recentQuizzesList.slice(0, 10),
      performanceOverTime,
    };
  }
}
