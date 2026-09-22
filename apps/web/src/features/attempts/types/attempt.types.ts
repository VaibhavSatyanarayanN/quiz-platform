import type { QuestionType } from '@/features/quizzes/types/quiz.types';

export const AttemptStatus = {
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  EXPIRED: 'expired',
} as const;

export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

export interface SaveAnswerRequest {
  optionIds: string[];
}

export interface AttemptOptionResponse {
  id: string;
  text: string;
  order: number;
}

export interface AttemptQuestionResponse {
  id: string;
  text: string;
  questionType: QuestionType;
  order: number;
  marks: number;
  options: AttemptOptionResponse[];
  selectedOptionIds: string[];
}

export interface StartAttemptResponse {
  id: string;
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string | null;
}

export interface AttemptResponse {
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  quizTitle?: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  remainingTimeSeconds: number | null;
  score: number | null;
  correctAnswers: number | null;
  wrongAnswers: number | null;
  unanswered: number | null;
  percentage: number | null;
  questions: AttemptQuestionResponse[];
}

export interface AttemptResultResponse {
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  quizTitle?: string;
  quizVersion?: number;
  status: AttemptStatus;
  score: number | null;
  totalMarks: number;
  correctAnswers: number | null;
  correctCount?: number;
  wrongAnswers: number | null;
  wrongCount?: number;
  unanswered: number | null;
  unansweredCount?: number;
  percentage: number | null;
  startedAt: string;
  submittedAt: string | null;
}

export interface AttemptHistoryItem {
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  version: number;
  status: AttemptStatus;
  score: number | null;
  totalMarks?: number;
  correctAnswers: number | null;
  wrongAnswers: number | null;
  unanswered: number | null;
  percentage: number | null;
  startedAt: string;
  submittedAt: string | null;
}

export interface AttemptHistoryResponse {
  items: AttemptHistoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AttemptHistoryQuery {
  page?: number;
  limit?: number;
}
