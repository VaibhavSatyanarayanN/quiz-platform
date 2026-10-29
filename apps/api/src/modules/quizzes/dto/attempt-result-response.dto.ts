import { AttemptStatus } from '../enums/attempt-status.enum.js';
import { QuestionType } from '../enums/question-type.enum.js';

export class AttemptReviewOptionDto {
  id: string;
  text: string;
  order: number;
  isCorrect: boolean;
}

export class AttemptQuestionReviewDto {
  id: string;
  text: string;
  questionType: QuestionType;
  order: number;
  marks: number;
  marksAwarded: number;
  isCorrect: boolean;
  isUnanswered: boolean;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  options: AttemptReviewOptionDto[];
}

export class AttemptResultResponseDto {
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  quizTitle?: string;
  quizVersion?: number;

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
  timeLimitSeconds?: number | null;
  elapsedSeconds?: number | null;

  questions?: AttemptQuestionReviewDto[];
}
