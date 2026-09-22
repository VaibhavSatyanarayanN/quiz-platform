import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attemptsApi } from '../api/attempts.api';
import type { SaveAnswerRequest } from '../types/attempt.types';

export const attemptKeys = {
  all: ['attempts'] as const,
  detail: (id: string) => [...attemptKeys.all, 'detail', id] as const,
  result: (id: string) => [...attemptKeys.all, 'result', id] as const,
  history: (quizId: string) => [...attemptKeys.all, 'history', quizId] as const,
};

export function useAttempt(attemptId: string) {
  return useQuery({
    queryKey: attemptKeys.detail(attemptId),
    queryFn: () => attemptsApi.getAttempt(attemptId),
    enabled: !!attemptId,
  });
}

export function useAttemptResult(attemptId: string) {
  return useQuery({
    queryKey: attemptKeys.result(attemptId),
    queryFn: () => attemptsApi.getAttemptResult(attemptId),
    enabled: !!attemptId,
  });
}

export function useAttemptHistory(quizId: string, page?: number, limit?: number) {
  return useQuery({
    queryKey: [...attemptKeys.history(quizId), { page, limit }],
    queryFn: () => attemptsApi.getAttemptHistory(quizId, { page, limit }),
    enabled: !!quizId,
  });
}

export function useStartAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, versionId }: { quizId: string; versionId: string }) =>
      attemptsApi.startAttempt(quizId, versionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: attemptKeys.detail(data.attemptId) });
    },
  });
}

export function useSaveAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      attemptId,
      questionId,
      data,
    }: {
      attemptId: string;
      questionId: string;
      data: SaveAnswerRequest;
    }) => attemptsApi.saveAnswer(attemptId, questionId, data),
    onSuccess: (_, { attemptId }) => {
      queryClient.invalidateQueries({ queryKey: attemptKeys.detail(attemptId) });
    },
  });
}

export function useSubmitAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attemptId: string) => attemptsApi.submitAttempt(attemptId),
    onSuccess: (_, attemptId) => {
      queryClient.invalidateQueries({ queryKey: attemptKeys.detail(attemptId) });
      queryClient.invalidateQueries({ queryKey: attemptKeys.result(attemptId) });
    },
  });
}
