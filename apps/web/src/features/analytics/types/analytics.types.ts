export interface AnalyticsVersionItem {
  id: string;
  versionNumber: number;
  status: string;
}

export interface VersionAnalyticsSummary {
  versionId: string;
  versionNumber: number;
  status: string;
  totalQuestions: number;
  totalMarks: number;
  timeLimitSeconds: number | null;
  totalAttempts: number;
  submittedAttempts: number;
  expiredAttempts: number;
  inProgressAttempts: number;
  avgScore: number;
  avgPercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
}

export interface QuestionTypePerformance {
  questionType: string;
  questionCount: number;
  totalResponses: number;
  correctResponses: number;
  accuracyPercentage: number;
}

export interface QuizAnalyticsSummary {
  totalAttempts: number;
  submittedAttempts: number;
  expiredAttempts: number;
  inProgressAttempts: number;
  completedAttempts: number;
  completionRate: number;
  finalizedRate: number;
  avgScore: number;
  avgPercentage: number;
  highestScore: number;
  lowestScore: number;
  highestPercentage: number;
  lowestPercentage: number;
  avgDurationSeconds: number;
  totalQuestions: number;
  totalMarks: number;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  totalUnanswered: number;
  publishedVersionsCount: number;
}

export interface ScoreBucket {
  count: number;
  percentage: number;
}

export interface ScoreDistribution {
  range90To100: ScoreBucket;
  range80To89: ScoreBucket;
  range70To79: ScoreBucket;
  range60To69: ScoreBucket;
  rangeBelow60: ScoreBucket;
}

export interface TopScorer {
  attemptId: string;
  userId: string;
  username: string;
  email: string;
  score: number;
  totalMarks: number;
  percentage: number;
  durationSeconds: number;
  submittedAt: string;
}

export interface OptionDistribution {
  optionId: string;
  optionText: string;
  isCorrect: boolean;
  selectionCount: number;
  selectionPercentage: number;
}

export interface QuestionAnalytics {
  questionId: string;
  questionText: string;
  questionType: string;
  marks: number;
  order: number;
  attemptCount: number;
  correctCount: number;
  correctPercentage: number;
  wrongCount: number;
  wrongPercentage: number;
  unansweredCount: number;
  unansweredPercentage: number;
  difficultyEstimate: 'EASY' | 'MEDIUM' | 'HARD';
  observedAccuracy: number;
  options: OptionDistribution[];
}

export interface QuizAnalyticsResponse {
  quizId: string;
  quizTitle: string;
  versionId: string;
  versionNumber: number;
  publishedVersionsCount: number;
  availableVersions: AnalyticsVersionItem[];
  versionSummaries?: VersionAnalyticsSummary[];
  summary: QuizAnalyticsSummary;
  questionTypeBreakdown?: Record<string, QuestionTypePerformance>;
  scoreDistribution: ScoreDistribution;
  topScorers: TopScorer[];
  questionAnalytics: QuestionAnalytics[];
}

export interface TopQuizAnalytics {
  quizId: string;
  title: string;
  attemptCount: number;
  avgPercentage: number;
}

export interface OrganizationAnalyticsResponse {
  organizationId: string;
  organizationName: string;
  totalQuizzes: number;
  publishedQuizzes: number;
  totalAttempts: number;
  completedAttempts: number;
  avgPercentage: number;
  totalMembers: number;
  topQuizzes: TopQuizAnalytics[];
}
