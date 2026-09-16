import { QuizVersionStatus } from '../enums/quiz-version-status.enum.js';

export class QuizVersionResponseDto {
    id: string;
    quizId: string;
    version: number;
    status: QuizVersionStatus;
    publishedAt: Date | null;
    timeLimitSeconds: number | null;
    createdAt: Date;
    updatedAt: Date;
}