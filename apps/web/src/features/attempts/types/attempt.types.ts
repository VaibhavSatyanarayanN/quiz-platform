import type { QuestionType } from '@/features/quizzes/types/quiz.types';

export const AttemptStatus = {
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  EXPIRED: 'expired',
} as const;

export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

export type QuestionSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface QuestionPersistenceState {
  status: QuestionSaveStatus;
  selectedOptionIds: string[];
  persistedOptionIds: string[];
  requestSeq: number;
  errorMessage: string | null;
  errorCode: number | null;
  lastSavedAt: string | null;
}

export interface SaveAnswerRequest {
  optionIds: string[];
}

export interface SaveAnswerResponse {
  answerId: string | null;
  attemptId: string;
  questionId: string;
  optionIds: string[];
  answeredAt: string | null;
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
  isAnswered?: boolean;
}

export interface StartAttemptResponse {
  id: string;
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  version?: number;
  quizTitle?: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string | null;
  remainingTimeSeconds?: number | null;
  totalQuestions?: number;
  totalMarks?: number;
  resumed?: boolean;
}

export interface AttemptResponse {
  id?: string;
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  version?: number;
  quizTitle?: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
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
  questions: AttemptQuestionResponse[];
}

export interface AttemptReviewOption {
  id: string;
  text: string;
  order: number;
  isCorrect: boolean;
}

export interface AttemptQuestionReview {
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
  options: AttemptReviewOption[];
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
  totalScore?: number;
  correctAnswers: number | null;
  correctCount?: number;
  wrongAnswers: number | null;
  wrongCount?: number;
  unanswered: number | null;
  unansweredCount?: number;
  percentage: number | null;
  startedAt: string;
  expiresAt?: string | null;
  submittedAt: string | null;
  timeLimitSeconds?: number | null;
  elapsedSeconds?: number | null;
  questions?: AttemptQuestionReview[];
}

export interface AttemptHistoryItem {
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  quizTitle?: string;
  version: number;
  status: AttemptStatus;
  score: number | null;
  totalMarks?: number;
  totalScore?: number;
  correctAnswers: number | null;
  wrongAnswers: number | null;
  unanswered: number | null;
  percentage: number | null;
  startedAt: string;
  expiresAt?: string | null;
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
  quizId?: string;
  page?: number;
  limit?: number;
}
