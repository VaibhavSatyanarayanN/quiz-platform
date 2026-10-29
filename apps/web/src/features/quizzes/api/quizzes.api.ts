import { apiClient } from '@/lib/api/client';
import type {
  CreateQuizRequest,
  UpdateQuizRequest,
  BulkSaveQuestionsRequest,
  QuizResponse,
  CreatorQuizListResponse,
  CreatorQuizQueryParams,
  CreatorQuizDetailsResponse,
  TakerQuizVersionResponse,
  CreateQuizResponse,
  CreateNewVersionResponse,
  GenerateAiQuestionsRequest,
  GenerateAiQuestionsFromPdfRequest,
  GenerateAiQuestionsResponse,
  GenerationStatusResponse,
  GenerationReviewResponse,
  UpdateGenerationReviewRequest,
  ApplyGeneratedQuestionsRequest,
  ApplyGeneratedQuestionsResponse,
} from '../types/quiz.types';

export const quizzesApi = {
  getCreatorQuizzes: async (
    params?: CreatorQuizQueryParams,
  ): Promise<CreatorQuizListResponse> => {
    const response = await apiClient.get<CreatorQuizListResponse>('/quizzes', {
      params,
    });
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

  updateQuizVersion: async (
    quizId: string,
    versionId: string,
    data: { timeLimitSeconds: number | null },
  ): Promise<CreateNewVersionResponse> => {
    const response = await apiClient.patch<CreateNewVersionResponse>(
      `/quizzes/${quizId}/versions/${versionId}`,
      data,
    );
    return response.data;
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

  listAiGenerations: async (quizId: string): Promise<GenerationStatusResponse[]> => {
    const response = await apiClient.get<GenerationStatusResponse[]>(
      `/quizzes/${quizId}/ai-generations`,
    );
    return response.data;
  },

  getAiGenerationStatus: async (
    quizId: string,
    generationId: string,
  ): Promise<GenerationStatusResponse> => {
    const response = await apiClient.get<GenerationStatusResponse>(
      `/quizzes/${quizId}/ai-generations/${generationId}/status`,
    );
    return response.data;
  },

  generateAiQuestions: async (
    quizId: string,
    versionId: string,
    data: GenerateAiQuestionsRequest,
  ): Promise<GenerateAiQuestionsResponse> => {
    const response = await apiClient.post<GenerateAiQuestionsResponse>(
      `/quizzes/${quizId}/versions/${versionId}/ai-generate`,
      data,
    );
    return response.data;
  },

  generateAiQuestionsFromPdf: async (
    quizId: string,
    versionId: string,
    file: File,
    data: GenerateAiQuestionsFromPdfRequest,
  ): Promise<GenerateAiQuestionsResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (data.topic) formData.append('topic', data.topic);
    if (data.targetQuestionCount !== undefined) {
      formData.append('targetQuestionCount', String(data.targetQuestionCount));
    }
    if (data.difficulty) formData.append('difficulty', data.difficulty);
    if (data.customInstructions) {
      formData.append('customInstructions', data.customInstructions);
    }
    if (data.questionTypes && data.questionTypes.length > 0) {
      for (const qt of data.questionTypes) {
        formData.append('questionTypes', qt);
      }
    }

    const response = await apiClient.post<GenerateAiQuestionsResponse>(
      `/quizzes/${quizId}/versions/${versionId}/ai-generate-from-pdf`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  cancelAiGeneration: async (
    quizId: string,
    generationId: string,
  ): Promise<GenerationStatusResponse> => {
    const response = await apiClient.patch<GenerationStatusResponse>(
      `/quizzes/${quizId}/ai-generations/${generationId}/cancel`,
    );
    return response.data;
  },

  getAiGenerationReview: async (
    quizId: string,
    generationId: string,
  ): Promise<GenerationReviewResponse> => {
    const response = await apiClient.get<GenerationReviewResponse>(
      `/quizzes/${quizId}/ai-generations/${generationId}/review`,
    );
    return response.data;
  },

  saveAiGenerationReview: async (
    quizId: string,
    generationId: string,
    data: UpdateGenerationReviewRequest,
  ): Promise<GenerationReviewResponse> => {
    const response = await apiClient.put<GenerationReviewResponse>(
      `/quizzes/${quizId}/ai-generations/${generationId}/review`,
      data,
    );
    return response.data;
  },

  resetAiGenerationReview: async (
    quizId: string,
    generationId: string,
  ): Promise<GenerationReviewResponse> => {
    const response = await apiClient.post<GenerationReviewResponse>(
      `/quizzes/${quizId}/ai-generations/${generationId}/reset-review`,
    );
    return response.data;
  },

  applyAiGenerationQuestions: async (
    quizId: string,
    generationId: string,
    data: ApplyGeneratedQuestionsRequest = {},
  ): Promise<ApplyGeneratedQuestionsResponse> => {
    const response = await apiClient.post<ApplyGeneratedQuestionsResponse>(
      `/quizzes/${quizId}/ai-generations/${generationId}/apply`,
      data,
    );
    return response.data;
  },
};
