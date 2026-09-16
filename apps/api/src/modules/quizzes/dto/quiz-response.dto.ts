import { QuizStatus } from '../enums/quiz-status.enum.js';

export class QuizResponseDto {
    id: string;
    title: string;
    description: string | null;
    status: QuizStatus;
    creatorId: string;
    createdAt: Date;
    updatedAt: Date;
}