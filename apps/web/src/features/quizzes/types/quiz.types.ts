export const QuizStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type QuizStatus = (typeof QuizStatus)[keyof typeof QuizStatus];

export const QuizVersionStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type QuizVersionStatus = (typeof QuizVersionStatus)[keyof typeof QuizVersionStatus];

export const QuestionType = {
  SINGLE_CHOICE: 'single_choice',
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
} as const;

export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export interface CreateQuizRequest {
  title: string;
  description?: string | null;
  timeLimitSeconds?: number;
}

export interface UpdateQuizRequest {
  title?: string;
  description?: string | null;
}

export interface CreateOptionRequest {
  id?: string;
  text: string;
  isCorrect: boolean;
}

export interface CreateQuestionRequest {
  id?: string;
  text: string;
  questionType: QuestionType;
  marks: number;
  options: CreateOptionRequest[];
}

export interface BulkSaveQuestionsRequest {
  questions: CreateQuestionRequest[];
}

export interface CreateQuizResponse {
  id: string;
  quizId: string;
  quizVersionId: string;
  version: number;
  status: QuizVersionStatus;
  timeLimitSeconds: number | null;
}

export interface CreateNewVersionResponse {
  id: string;
  quizId: string;
  quizVersionId: string;
  version: number;
  status: QuizVersionStatus;
  timeLimitSeconds: number | null;
}

export interface QuizResponse {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizVersionResponse {
  id: string;
  quizId: string;
  version: number;
  status: QuizVersionStatus;
  publishedAt: string | null;
  timeLimitSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorQuizListItem {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  publishedVersionsCount: number;
  hasDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorQuizListResponse {
  items: CreatorQuizListItem[];
}

export interface CreatorOptionResponse {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface CreatorQuestionResponse {
  id: string;
  text: string;
  questionType: QuestionType;
  order: number;
  marks: number;
  options: CreatorOptionResponse[];
}

export interface CreatorQuizVersionResponse {
  id: string;
  version: number;
  status: QuizVersionStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions: CreatorQuestionResponse[];
}

export interface CreatorQuizDetailsResponse {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  versions: CreatorQuizVersionResponse[];
}

export interface TakerOptionResponse {
  id: string;
  text: string;
  order: number;
}

export interface TakerQuestionResponse {
  id: string;
  text: string;
  questionType: QuestionType;
  order: number;
  marks: number;
  options: TakerOptionResponse[];
}

export interface TakerQuizVersionResponse {
  quizId: string;
  quizVersionId: string;
  title: string;
  quizTitle?: string;
  description: string | null;
  quizDescription?: string | null;
  version: number;
  status?: QuizVersionStatus;
  totalMarks?: number;
  timeLimitSeconds: number | null;
  questions: TakerQuestionResponse[];
}
