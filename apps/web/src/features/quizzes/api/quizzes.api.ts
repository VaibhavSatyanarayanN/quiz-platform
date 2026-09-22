import { apiClient } from '@/lib/api/client';
import type {
  CreateQuizRequest,
  UpdateQuizRequest,
  BulkSaveQuestionsRequest,
  QuizResponse,
  CreatorQuizListResponse,
  CreatorQuizDetailsResponse,
  TakerQuizVersionResponse,
  CreateQuizResponse,
  CreateNewVersionResponse,
} from '../types/quiz.types';

export const quizzesApi = {
  getCreatorQuizzes: async (): Promise<CreatorQuizListResponse> => {
    const response = await apiClient.get<CreatorQuizListResponse>('/quizzes');
    return response.data;
  },

  getCreatorQuizDetails: async (quizId: string): Promise<CreatorQuizDetailsResponse> => {
    const response = await apiClient.get<CreatorQuizDetailsResponse>(`/quizzes/${quizId}`);
    return response.data;
  },

  createQuiz: async (data: CreateQuizRequest): Promise<CreateQuizResponse> => {
    const response = await apiClient.post<{
      id?: string;
      quizId: string;
      quizVersionId: string;
      version: number;
      status: CreateQuizResponse['status'];
      timeLimitSeconds: number | null;
    }>('/quizzes', data);
    const resData = response.data;
    const id = resData.quizId || resData.id || '';
    return {
      ...resData,
      id,
      quizId: id,
    };
  },

  updateQuiz: async (quizId: string, data: UpdateQuizRequest): Promise<QuizResponse> => {
    const response = await apiClient.patch<QuizResponse>(`/quizzes/${quizId}`, data);
    return response.data;
  },

  bulkSaveQuestions: async (
    quizId: string,
    versionId: string,
    data: BulkSaveQuestionsRequest,
  ): Promise<void> => {
    await apiClient.put(`/quizzes/${quizId}/versions/${versionId}/questions/bulk`, data);
  },

  publishVersion: async (quizId: string, versionId: string): Promise<void> => {
    await apiClient.patch(`/quizzes/${quizId}/versions/${versionId}/publish`);
  },

  discardVersion: async (quizId: string, versionId: string): Promise<void> => {
    await apiClient.patch(`/quizzes/${quizId}/versions/${versionId}/discard`);
  },

  createNewVersion: async (quizId: string): Promise<CreateNewVersionResponse> => {
    const response = await apiClient.post<{
      id?: string;
      quizId: string;
      quizVersionId: string;
      version: number;
      status: CreateNewVersionResponse['status'];
      timeLimitSeconds: number | null;
    }>(`/quizzes/${quizId}/versions`);
    const resData = response.data;
    const id = resData.quizVersionId || resData.id || '';
    return {
      ...resData,
      id,
      quizVersionId: id,
    };
  },

  getPublishedQuizVersion: async (
    quizId: string,
    versionId: string,
  ): Promise<TakerQuizVersionResponse> => {
    const response = await apiClient.get<TakerQuizVersionResponse>(
      `/quizzes/${quizId}/versions/${versionId}`,
    );
    return response.data;
  },
};
