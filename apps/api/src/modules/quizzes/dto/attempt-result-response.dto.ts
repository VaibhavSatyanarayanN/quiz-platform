import { AttemptStatus } from '../enums/attempt-status.enum.js';

export class AttemptResultResponseDto {
    attemptId: string;
    quizId: string;
    quizVersionId: string;

    status: AttemptStatus;

    score: number | null;
    totalMarks: number;

    correctAnswers: number | null;
    wrongAnswers: number | null;
    unanswered: number | null;

    percentage: number | null;

    startedAt: Date;
    submittedAt: Date | null;
}