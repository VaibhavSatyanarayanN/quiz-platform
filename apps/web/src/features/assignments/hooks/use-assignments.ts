import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '../api/assignments.api.js';
import type { CreateAssignmentRequest } from '../types/assignment.types.js';

export function useAssignments() {
  return useQuery({
    queryKey: ['quiz-assignments'],
    queryFn: () => assignmentsApi.getAssignments(),
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAssignmentRequest) => assignmentsApi.createAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
  });
}
