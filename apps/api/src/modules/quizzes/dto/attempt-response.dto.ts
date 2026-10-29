import { AttemptStatus } from '../enums/attempt-status.enum.js';
import { QuestionType } from '../enums/question-type.enum.js';

export class StartAttemptResponseDto {
  id: string;
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  version: number;
  quizTitle: string;
  status: AttemptStatus;
  startedAt: Date;
  expiresAt: Date | null;
  remainingTimeSeconds: number | null;
  totalQuestions: number;
  totalMarks: number;
  resumed: boolean;
}

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
  isAnswered?: boolean;
}

export class AttemptResponseDto {
  id?: string;
  attemptId: string;

  quizId: string;
  quizVersionId: string;
  version?: number;
  quizTitle?: string;

  status: AttemptStatus;

  startedAt: Date;
  expiresAt: Date | null;
  submittedAt: Date | null;
  remainingTimeSeconds: number | null;

  totalQuestions?: number;
  answeredQuestions?: number;
  unansweredQuestions?: number;
  totalMarks?: number;

  score: number | null;
  correctAnswers: number | null;
  wrongAnswers: number | null;
  unanswered: number | null;
  percentage: number | null;

  questions: AttemptQuestionResponseDto[];
}
