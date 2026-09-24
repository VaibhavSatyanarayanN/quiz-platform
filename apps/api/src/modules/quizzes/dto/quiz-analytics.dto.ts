export class AnalyticsVersionItemDto {
  id: string;
  versionNumber: number;
  status: string;
}

export class QuizAnalyticsSummaryDto {
  totalAttempts: number;
  completedAttempts: number;
  completionRate: number; // percentage 0-100
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
  options: OptionDistributionDto[];
}

export class QuizAnalyticsResponseDto {
  quizId: string;
  quizTitle: string;
  versionId: string;
  versionNumber: number;
  availableVersions: AnalyticsVersionItemDto[];
  summary: QuizAnalyticsSummaryDto;
  scoreDistribution: ScoreDistributionDto;
  topScorers: TopScorerDto[];
  questionAnalytics: QuestionAnalyticsDto[];
}
