import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quizzesApi } from '../api/quizzes.api';
import type {
  CreateQuizRequest,
  UpdateQuizRequest,
  BulkSaveQuestionsRequest,
} from '../types/quiz.types';

export const quizKeys = {
  all: ['quizzes'] as const,
  lists: () => [...quizKeys.all, 'list'] as const,
  detail: (id: string) => [...quizKeys.all, 'detail', id] as const,
  takerVersion: (quizId: string, versionId: string) =>
    [...quizKeys.all, 'taker', quizId, versionId] as const,
};

export function useCreatorQuizzes() {
  return useQuery({
    queryKey: quizKeys.lists(),
    queryFn: quizzesApi.getCreatorQuizzes,
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

export function useCreateNewVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quizId: string) => quizzesApi.createNewVersion(quizId),
    onSuccess: (_, quizId) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) });
    },
  });
}
