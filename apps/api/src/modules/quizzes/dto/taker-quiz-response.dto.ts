import { QuestionType } from '../enums/question-type.enum.js';

export class TakerOptionResponseDto {
    id: string;
    text: string;
    order: number;
}

export class TakerQuestionResponseDto {
    id: string;
    text: string;
    questionType: QuestionType;
    order: number;
    marks: number;
    options: TakerOptionResponseDto[];
}

export class TakerQuizVersionResponseDto {
    quizId: string;
    quizVersionId: string;

    title: string;
    description: string | null;

    version: number;

    timeLimitSeconds: number | null;

    questions: TakerQuestionResponseDto[];
}