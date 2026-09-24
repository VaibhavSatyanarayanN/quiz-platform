import { apiClient } from '@/lib/api/client';
import type { OrganizationAnalyticsResponse, QuizAnalyticsResponse } from '../types/analytics.types.js';

export const analyticsApi = {
  getQuizAnalytics: async (
    quizId: string,
    versionId?: string,
  ): Promise<QuizAnalyticsResponse> => {
    const params = versionId ? { versionId } : undefined;
    const response = await apiClient.get<QuizAnalyticsResponse>(`/quizzes/${quizId}/analytics`, {
      params,
    });
    return response.data;
  },

  getOrganizationAnalytics: async (
    organizationId: string,
  ): Promise<OrganizationAnalyticsResponse> => {
    const response = await apiClient.get<OrganizationAnalyticsResponse>(
      `/organizations/${organizationId}/analytics`,
    );
    return response.data;
  },
};
