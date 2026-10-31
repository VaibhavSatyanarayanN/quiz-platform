export class AnalyticsVersionItemDto {
  id: string;
  versionNumber: number;
  status: string;
}

export class VersionAnalyticsSummaryDto {
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

export class QuizAnalyticsSummaryDto {
  totalAttempts: number;
  submittedAttempts: number;
  expiredAttempts: number;
  inProgressAttempts: number;
  completedAttempts: number;
  completionRate: number; // submittedAttempts / totalAttempts * 100
  finalizedRate: number; // (submittedAttempts + expiredAttempts) / totalAttempts * 100
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

export class ScoreBucketDto {
  count: number;
  percentage: number;
}

export class ScoreDistributionDto {
  range90To100: ScoreBucketDto;
  range80To89: ScoreBucketDto;
  range70To79: ScoreBucketDto;
  range60To69: ScoreBucketDto;
  rangeBelow60: ScoreBucketDto;
}

export class TopScorerDto {
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

export class OptionDistributionDto {
  optionId: string;
  optionText: string;
  isCorrect: boolean;
  selectionCount: number;
  selectionPercentage: number;
}

export class QuestionTypePerformanceDto {
  questionType: string;
  questionCount: number;
  totalResponses: number;
  correctResponses: number;
  accuracyPercentage: number;
}

export class QuestionAnalyticsDto {
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
  options: OptionDistributionDto[];
}

export class QuizAnalyticsResponseDto {
  quizId: string;
  quizTitle: string;
  versionId: string;
  versionNumber: number;
  publishedVersionsCount: number;
  availableVersions: AnalyticsVersionItemDto[];
  versionSummaries: VersionAnalyticsSummaryDto[];
  summary: QuizAnalyticsSummaryDto;
  questionTypeBreakdown: Record<string, QuestionTypePerformanceDto>;
  scoreDistribution: ScoreDistributionDto;
  topScorers: TopScorerDto[];
  questionAnalytics: QuestionAnalyticsDto[];
}
