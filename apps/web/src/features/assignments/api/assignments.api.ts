import { apiClient } from '@/lib/api/client';
import type { CreateAssignmentRequest, QuizAssignment } from '../types/assignment.types.js';

export const assignmentsApi = {
  createAssignment: async (data: CreateAssignmentRequest): Promise<QuizAssignment> => {
    const response = await apiClient.post<QuizAssignment>('/quiz-assignments', data);
    return response.data;
  },

  getAssignments: async (): Promise<QuizAssignment[]> => {
    const response = await apiClient.get<QuizAssignment[]>('/quiz-assignments');
    return response.data;
  },
};
