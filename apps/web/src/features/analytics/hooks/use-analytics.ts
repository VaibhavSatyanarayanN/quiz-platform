import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics.api.js';

export function useQuizAnalytics(quizId: string, versionId?: string) {
  return useQuery({
    queryKey: ['quiz-analytics', quizId, versionId ?? 'latest'],
    queryFn: () => analyticsApi.getQuizAnalytics(quizId, versionId),
    enabled: !!quizId,
  });
}

export function useOrganizationAnalytics(organizationId: string) {
  return useQuery({
    queryKey: ['org-analytics', organizationId],
    queryFn: () => analyticsApi.getOrganizationAnalytics(organizationId),
    enabled: !!organizationId,
  });
}
