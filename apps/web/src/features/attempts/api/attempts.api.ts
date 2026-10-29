import { apiClient } from '@/lib/api/client';
import type {
  AttemptResponse,
  AttemptResultResponse,
  AttemptHistoryResponse,
  AttemptHistoryQuery,
  SaveAnswerRequest,
  SaveAnswerResponse,
  StartAttemptResponse,
} from '../types/attempt.types';

export const attemptsApi = {
  startAttempt: async (
    quizId: string,
    versionId: string,
  ): Promise<StartAttemptResponse> => {
    const response = await apiClient.post<{
      id: string;
      attemptId?: string;
      quizId: string;
      quizVersionId: string;
      version?: number;
      quizTitle?: string;
      status: StartAttemptResponse['status'];
      startedAt: string;
      expiresAt: string | null;
      remainingTimeSeconds?: number | null;
      totalQuestions?: number;
      totalMarks?: number;
      resumed?: boolean;
    }>(`/quizzes/${quizId}/versions/${versionId}/attempts`);

    const data = response.data;
    const attemptId = data.attemptId || data.id;
    return {
      ...data,
      id: data.id || attemptId,
      attemptId,
    };
  },

  saveAnswer: async (
    attemptId: string,
    questionId: string,
    data: SaveAnswerRequest,
    signal?: AbortSignal,
  ): Promise<SaveAnswerResponse> => {
    const response = await apiClient.post<SaveAnswerResponse>(
      `/quizzes/attempts/${attemptId}/questions/${questionId}/answers`,
      data,
      signal ? { signal } : undefined,
    );
    return response.data;
  },

  submitAttempt: async (attemptId: string): Promise<void> => {
    await apiClient.post(`/quizzes/attempts/${attemptId}/submit`);
  },

  getAttempt: async (attemptId: string): Promise<AttemptResponse> => {
    const response = await apiClient.get<AttemptResponse>(
      `/quizzes/attempts/${attemptId}`,
    );
    return response.data;
  },

  getAttemptResult: async (attemptId: string): Promise<AttemptResultResponse> => {
    const response = await apiClient.get<AttemptResultResponse>(
      `/quizzes/attempts/${attemptId}/result`,
    );
    return response.data;
  },

  getAttemptHistory: async (
    quizId?: string,
    query?: AttemptHistoryQuery,
  ): Promise<AttemptHistoryResponse> => {
    const url = quizId ? `/quizzes/${quizId}/attempts` : `/quizzes/attempts`;
    const response = await apiClient.get<AttemptHistoryResponse>(
      url,
      { params: query },
    );
    return response.data;
  },
};
