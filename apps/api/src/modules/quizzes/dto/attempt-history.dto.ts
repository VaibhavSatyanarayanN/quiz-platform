import { AttemptStatus } from '../enums/attempt-status.enum.js';

export class AttemptHistoryItemDto {
    attemptId: string;
    quizId: string;
    quizVersionId: string;
    quizTitle?: string;
    version: number;

    status: AttemptStatus;

    score: number | null;
    totalMarks: number;
    totalScore?: number;
    correctAnswers: number | null;
    wrongAnswers: number | null;
    unanswered: number | null;
    percentage: number | null;

    startedAt: Date;
    submittedAt: Date | null;
}

export class AttemptHistoryResponseDto {
    items: AttemptHistoryItemDto[];

    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
