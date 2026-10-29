import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attemptsApi } from '../api/attempts.api';
import type { AttemptResponse, SaveAnswerRequest } from '../types/attempt.types';
import { classifyAttemptError } from '../utils/attempt-persistence';

export const attemptKeys = {
  all: ['attempts'] as const,
  detail: (id: string) => [...attemptKeys.all, 'detail', id] as const,
  result: (id: string) => [...attemptKeys.all, 'result', id] as const,
  history: (quizId?: string) => [...attemptKeys.all, 'history', quizId ?? 'global'] as const,
};

export function useAttempt(attemptId: string) {
  return useQuery({
    queryKey: attemptKeys.detail(attemptId),
    queryFn: () => attemptsApi.getAttempt(attemptId),
    enabled: !!attemptId,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      const classified = classifyAttemptError(error);
      if (
        classified.isUnauthorized ||
        classified.isForbidden ||
        classified.isNotFound
      ) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useAttemptResult(attemptId: string) {
  return useQuery({
    queryKey: attemptKeys.result(attemptId),
    queryFn: () => attemptsApi.getAttemptResult(attemptId),
    enabled: !!attemptId,
    refetchOnWindowFocus: false,
  });
}

export function useAttemptHistory(quizId?: string, page?: number, limit?: number) {
  return useQuery({
    queryKey: [...attemptKeys.history(quizId), { page, limit }],
    queryFn: () => attemptsApi.getAttemptHistory(quizId, { page, limit }),
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
    retry: false,
    mutationFn: ({
      attemptId,
      questionId,
      data,
      signal,
    }: {
      attemptId: string;
      questionId: string;
      data: SaveAnswerRequest;
      signal?: AbortSignal;
    }) => attemptsApi.saveAnswer(attemptId, questionId, data, signal),
    onSuccess: (savedData, { attemptId, questionId, data }) => {
      const confirmedIds = savedData?.optionIds ?? data.optionIds;
      queryClient.setQueryData<AttemptResponse | undefined>(
        attemptKeys.detail(attemptId),
        (prev) => {
          if (!prev || !Array.isArray(prev.questions)) {
            return prev;
          }
          const updatedQuestions = prev.questions.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  selectedOptionIds: confirmedIds,
                  isAnswered: confirmedIds.length > 0,
                }
              : q,
          );
          const answeredQuestions = updatedQuestions.filter(
            (q) => (q.selectedOptionIds?.length ?? 0) > 0,
          ).length;
          return {
            ...prev,
            answeredQuestions,
            unansweredQuestions: Math.max(0, updatedQuestions.length - answeredQuestions),
            questions: updatedQuestions,
          };
        },
      );
    },
  });
}

export function useSubmitAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: (attemptId: string) => attemptsApi.submitAttempt(attemptId),
    onSuccess: (_, attemptId) => {
      queryClient.invalidateQueries({ queryKey: attemptKeys.detail(attemptId) });
      queryClient.invalidateQueries({ queryKey: attemptKeys.result(attemptId) });
    },
  });
}
