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

export const DifficultyLevel = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;

export type DifficultyLevel = (typeof DifficultyLevel)[keyof typeof DifficultyLevel];

export const GenerationStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type GenerationStatus = (typeof GenerationStatus)[keyof typeof GenerationStatus];

export const GenerationReviewStatus = {
  PENDING_REVIEW: 'pending_review',
  REVIEWED: 'reviewed',
  APPLIED: 'applied',
} as const;

export type GenerationReviewStatus =
  (typeof GenerationReviewStatus)[keyof typeof GenerationReviewStatus];

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

export interface CreatorQuizQueryParams {
  search?: string;
  status?: QuizStatus;
  page?: number;
  limit?: number;
}

export interface CreatorQuizListItem {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  publishedVersionsCount: number;
  hasDraft: boolean;
  latestVersion?: number;
  latestVersionId?: string | null;
  latestVersionStatus?: QuizVersionStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorQuizListResponse {
  items: CreatorQuizListItem[];
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
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
  timeLimitSeconds: number | null;
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

export interface GenerateAiQuestionsRequest {
  topic: string;
  sourceText?: string;
  targetQuestionCount: number;
  questionTypes: QuestionType[];
  difficulty: DifficultyLevel;
  customInstructions?: string;
}

export interface GenerateAiQuestionsFromPdfRequest {
  topic?: string;
  targetQuestionCount?: number;
  questionTypes?: QuestionType[];
  difficulty?: DifficultyLevel;
  customInstructions?: string;
}

export interface GenerateAiQuestionsResponse {
  generationId: string;
  jobId: string;
  status: GenerationStatus;
  message?: string;
}

export interface GenerationStatusResponse {
  generationId: string;
  jobId: string | null;
  quizId: string;
  targetVersionId: string;
  status: GenerationStatus;
  stage: string;
  stageDescription: string;
  isTerminal: boolean;
  canCancel: boolean;
  reviewStatus: GenerationReviewStatus | null;
  isApplied: boolean;
  appliedAt: string | null;
  appliedQuestionsCount: number | null;
  promptParams: Record<string, unknown>;
  generatedQuestions: ReviewQuestionItem[] | null;
  errorMessage: string | null;
  tokensUsed: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ReviewOptionItem {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface ReviewQuestionItem {
  id: string;
  text: string;
  questionType: QuestionType;
  marks: number;
  order: number;
  explanation?: string | null;
  difficulty?: string | null;
  cognitiveLevel?: string | null;
  learningObjectiveId?: string | null;
  correctAnswer?: string | null;
  validationFeedback?: Record<string, unknown> | null;
  pedagogyFeedback?: Record<string, unknown> | null;
  options: ReviewOptionItem[];
}

export interface GenerationReviewResponse {
  generationId: string;
  jobId: string | null;
  quizId: string;
  targetVersionId: string;
  targetVersionStatus: QuizVersionStatus | null;
  targetVersionExistingQuestionCount: number;
  status: GenerationStatus;
  stage: string;
  stageDescription: string;
  reviewStatus: GenerationReviewStatus;
  isReadyForReview: boolean;
  isApplied: boolean;
  hasCreatorEdits: boolean;
  editedAt: string | null;
  appliedAt: string | null;
  appliedQuestionsCount: number | null;
  appliedQuestionIds: string[];
  promptParams: Record<string, unknown>;
  questions: ReviewQuestionItem[];
  errorMessage: string | null;
  tokensUsed: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface UpdateGenerationReviewRequest {
  questions: Array<{
    id?: string;
    text: string;
    questionType: QuestionType;
    marks?: number;
    order?: number;
    explanation?: string | null;
    difficulty?: string | null;
    cognitiveLevel?: string | null;
    learningObjectiveId?: string | null;
    correctAnswer?: string | null;
    options?: Array<{
      id?: string;
      text: string;
      isCorrect: boolean;
      order?: number;
    }>;
  }>;
}

export interface ApplyGeneratedQuestionsRequest {
  targetVersionId?: string;
  questions?: UpdateGenerationReviewRequest['questions'];
}

export interface ApplyGeneratedQuestionsResponse {
  generationId: string;
  quizId: string;
  targetVersionId: string;
  reviewStatus: GenerationReviewStatus;
  isApplied: boolean;
  appliedAt: string;
  appliedQuestionsCount: number;
  appliedQuestionIds: string[];
  applyStrategy: 'append';
  questions: ReviewQuestionItem[];
}
