import { AttemptStatus } from '../enums/attempt-status.enum.js';
import { QuestionType } from '../enums/question-type.enum.js';

export class AttemptOptionResponseDto {
    id: string;
    text: string;
    order: number;
}

export class AttemptQuestionResponseDto {
    id: string;
    text: string;
    questionType: QuestionType;
    order: number;
    marks: number;
    options: AttemptOptionResponseDto[];
    selectedOptionIds: string[];
}

export class AttemptResponseDto {
    attemptId: string;
    quizId: string;
    quizVersionId: string;

    status: AttemptStatus;

    startedAt: Date;
    submittedAt: Date | null;

    score: number | null;
    correctAnswers: number | null;
    wrongAnswers: number | null;
    unanswered: number | null;
    percentage: number | null;

    questions: AttemptQuestionResponseDto[];
}