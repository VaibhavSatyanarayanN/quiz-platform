import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quizzesApi } from '../api/quizzes.api';
import { GenerationStatus } from '../types/quiz.types';
import type {
  CreateQuizRequest,
  UpdateQuizRequest,
  BulkSaveQuestionsRequest,
  GenerateAiQuestionsRequest,
  GenerateAiQuestionsFromPdfRequest,
  UpdateGenerationReviewRequest,
  ApplyGeneratedQuestionsRequest,
  CreatorQuizQueryParams,
  PublishedQuizQueryParams,
} from '../types/quiz.types';

export const quizKeys = {
  all: ['quizzes'] as const,
  lists: (params?: CreatorQuizQueryParams) => [...quizKeys.all, 'list', params] as const,
  publishedList: (params?: PublishedQuizQueryParams) =>
    [...quizKeys.all, 'published', params] as const,
  detail: (id: string) => [...quizKeys.all, 'detail', id] as const,
  takerVersion: (quizId: string, versionId: string) =>
    [...quizKeys.all, 'taker', quizId, versionId] as const,
  latestPublished: (quizId: string) =>
    [...quizKeys.all, 'latest-published', quizId] as const,
  aiGenerations: (quizId: string) => [...quizKeys.all, 'ai-generations', quizId] as const,
  aiGenerationReview: (quizId: string, generationId: string) =>
    [...quizKeys.all, 'ai-generation-review', quizId, generationId] as const,
};

export function useCreatorQuizzes(
  params?: CreatorQuizQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: quizKeys.lists(params),
    queryFn: () => quizzesApi.getCreatorQuizzes(params),
    enabled: options?.enabled ?? true,
  });
}

export function usePublishedQuizzes(
  params?: PublishedQuizQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: quizKeys.publishedList(params),
    queryFn: () => quizzesApi.getPublishedQuizzes(params),
    enabled: options?.enabled ?? true,
  });
}

export function useLatestPublishedQuizVersion(
  quizId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: quizKeys.latestPublished(quizId),
    queryFn: () => quizzesApi.getLatestPublishedQuizVersion(quizId),
    enabled: (options?.enabled ?? true) && !!quizId,
  });
}

export function useCreatorQuizDetails(quizId: string) {
  return useQuery({
    queryKey: quizKeys.detail(quizId),
    queryFn: () => quizzesApi.getCreatorQuizDetails(quizId),
    enabled: !!quizId,
  });
}

export function usePublishedQuizVersion(quizId: string, versionId: string) {
  return useQuery({
    queryKey: quizKeys.takerVersion(quizId, versionId),
    queryFn: () => quizzesApi.getPublishedQuizVersion(quizId, versionId),
    enabled: !!quizId && !!versionId,
  });
}

export function useCreateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQuizRequest) => quizzesApi.createQuiz(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useUpdateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, data }: { quizId: string; data: UpdateQuizRequest }) =>
      quizzesApi.updateQuiz(quizId, data),
    onSuccess: (_, { quizId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) });
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useBulkSaveQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      versionId,
      data,
    }: {
      quizId: string;
      versionId: string;
      data: BulkSaveQuestionsRequest;
    }) => quizzesApi.bulkSaveQuestions(quizId, versionId, data),
    onSuccess: (_, { quizId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) });
    },
  });
}

export function usePublishVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, versionId }: { quizId: string; versionId: string }) =>
      quizzesApi.publishVersion(quizId, versionId),
    onSuccess: (_, { quizId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) });
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useDiscardVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, versionId }: { quizId: string; versionId: string }) =>
      quizzesApi.discardVersion(quizId, versionId),
    onSuccess: (_, { quizId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) });
    },
  });
}

export function useUpdateQuizVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      versionId,
      data,
    }: {
      quizId: string;
      versionId: string;
      data: { timeLimitSeconds: number | null };
    }) => quizzesApi.updateQuizVersion(quizId, versionId, data),
    onSuccess: (_, { quizId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) });
    },
  });
}

export function useCreateNewVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quizId: string) => quizzesApi.createNewVersion(quizId),
    onSuccess: (_, quizId) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) });
    },
  });
}

export function useAiGenerations(quizId: string) {
  return useQuery({
    queryKey: quizKeys.aiGenerations(quizId),
    queryFn: () => quizzesApi.listAiGenerations(quizId),
    enabled: !!quizId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        Array.isArray(data) &&
        data.some(
          (g) =>
            g.status === GenerationStatus.PENDING ||
            g.status === GenerationStatus.PROCESSING,
        )
      ) {
        return 3000;
      }
      return false;
    },
  });
}

export function useAiGenerationReview(quizId: string, generationId: string) {
  return useQuery({
    queryKey: quizKeys.aiGenerationReview(quizId, generationId),
    queryFn: () => quizzesApi.getAiGenerationReview(quizId, generationId),
    enabled: !!quizId && !!generationId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data &&
        (data.status === GenerationStatus.PENDING ||
          data.status === GenerationStatus.PROCESSING)
      ) {
        return 3000;
      }
      return false;
    },
  });
}

export function useGenerateAiQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      versionId,
      data,
    }: {
      quizId: string;
      versionId: string;
      data: GenerateAiQuestionsRequest;
    }) => quizzesApi.generateAiQuestions(quizId, versionId, data),
    onSuccess: (_, { quizId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.aiGenerations(quizId) });
    },
  });
}

export function useGenerateAiQuestionsFromPdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      versionId,
      file,
      data,
    }: {
      quizId: string;
      versionId: string;
      file: File;
      data: GenerateAiQuestionsFromPdfRequest;
    }) => quizzesApi.generateAiQuestionsFromPdf(quizId, versionId, file, data),
    onSuccess: (_, { quizId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.aiGenerations(quizId) });
    },
  });
}

export function useCancelAiGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, generationId }: { quizId: string; generationId: string }) =>
      quizzesApi.cancelAiGeneration(quizId, generationId),
    onSuccess: (_, { quizId, generationId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.aiGenerations(quizId) });
      queryClient.invalidateQueries({
        queryKey: quizKeys.aiGenerationReview(quizId, generationId),
      });
    },
  });
}

export function useSaveAiGenerationReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      generationId,
      data,
    }: {
      quizId: string;
      generationId: string;
      data: UpdateGenerationReviewRequest;
    }) => quizzesApi.saveAiGenerationReview(quizId, generationId, data),
    onSuccess: (updated, { quizId, generationId }) => {
      queryClient.setQueryData(quizKeys.aiGenerationReview(quizId, generationId), updated);
      queryClient.invalidateQueries({ queryKey: quizKeys.aiGenerations(quizId) });
    },
  });
}

export function useResetAiGenerationReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, generationId }: { quizId: string; generationId: string }) =>
      quizzesApi.resetAiGenerationReview(quizId, generationId),
    onSuccess: (updated, { quizId, generationId }) => {
      queryClient.setQueryData(quizKeys.aiGenerationReview(quizId, generationId), updated);
      queryClient.invalidateQueries({ queryKey: quizKeys.aiGenerations(quizId) });
    },
  });
}

export function useApplyAiGenerationQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      generationId,
      data,
    }: {
      quizId: string;
      generationId: string;
      data?: ApplyGeneratedQuestionsRequest;
    }) => quizzesApi.applyAiGenerationQuestions(quizId, generationId, data),
    onSuccess: (_, { quizId, generationId }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) });
      queryClient.invalidateQueries({ queryKey: quizKeys.aiGenerations(quizId) });
      queryClient.invalidateQueries({
        queryKey: quizKeys.aiGenerationReview(quizId, generationId),
      });
    },
  });
}
