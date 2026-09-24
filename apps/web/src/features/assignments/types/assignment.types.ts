export interface QuizAssignment {
  id: string;
  quizId: string;
  quizVersionId: string;
  organizationId: string;
  classroomId: string | null;
  assignedBy: string;
  startsAt: string | null;
  dueAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  quiz?: {
    title: string;
  };
  classroom?: {
    name: string;
  };
}

export interface CreateAssignmentRequest {
  quizId: string;
  quizVersionId: string;
  organizationId: string;
  classroomId?: string;
  studentIds?: string[];
  startsAt?: string;
  dueAt?: string;
}
