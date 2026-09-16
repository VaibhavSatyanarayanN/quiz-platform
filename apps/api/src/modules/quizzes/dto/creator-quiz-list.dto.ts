import { QuizStatus } from '../enums/quiz-status.enum.js';

export class CreatorQuizListItemDto {
    id: string;
    title: string;
    description: string | null;
    status: QuizStatus;
    createdAt: Date;
    updatedAt: Date;
}

export class CreatorQuizListResponseDto {
    items: CreatorQuizListItemDto[];
}