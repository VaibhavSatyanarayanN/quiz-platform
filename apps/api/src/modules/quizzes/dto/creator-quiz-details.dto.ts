import { QuizStatus } from '../enums/quiz-status.enum.js';
import { QuizVersionStatus } from '../enums/quiz-version-status.enum.js';
import { QuestionType } from '../enums/question-type.enum.js';

export class CreatorOptionResponseDto {
    id: string;
    text: string;
    isCorrect: boolean;
    order: number;
}

export class CreatorQuestionResponseDto {
    id: string;
    text: string;
    questionType: QuestionType;
    order: number;
    marks: number;
    options: CreatorOptionResponseDto[];
}

export class CreatorQuizVersionResponseDto {
    id: string;
    version: number;
    status: QuizVersionStatus;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;

    questions: CreatorQuestionResponseDto[];
}

export class CreatorQuizDetailsResponseDto {
    id: string;
    title: string;
    description: string | null;
    status: QuizStatus;
    creatorId: string;

    createdAt: Date;
    updatedAt: Date;

    versions: CreatorQuizVersionResponseDto[];
}