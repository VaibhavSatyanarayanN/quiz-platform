export class TopQuizAnalyticsDto {
  quizId: string;
  title: string;
  attemptCount: number;
  avgPercentage: number;
}

export class OrganizationAnalyticsResponseDto {
  organizationId: string;
  organizationName: string;
  totalQuizzes: number;
  publishedQuizzes: number;
  totalAttempts: number;
  completedAttempts: number;
  avgPercentage: number;
  totalMembers: number;
  topQuizzes: TopQuizAnalyticsDto[];
}
