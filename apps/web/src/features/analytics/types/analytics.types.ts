export interface AnalyticsVersionItem {
  id: string;
  versionNumber: number;
  status: string;
}

export interface QuizAnalyticsSummary {
  totalAttempts: number;
  completedAttempts: number;
  completionRate: number;
  avgScore: number;
  avgPercentage: number;
  highestScore: number;
  lowestScore: number;
  avgDurationSeconds: number;
  totalQuestions: number;
  totalMarks: number;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  totalUnanswered: number;
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
  options: OptionDistribution[];
}

export interface QuizAnalyticsResponse {
  quizId: string;
  quizTitle: string;
  versionId: string;
  versionNumber: number;
  availableVersions: AnalyticsVersionItem[];
  summary: QuizAnalyticsSummary;
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
