import { apiClient } from '@/lib/api/client';

export interface StudentDashboardData {
  metrics: {
    assignedQuizzes: number;
    completedQuizzes: number;
    pendingQuizzes: number;
    missedQuizzes: number;
    totalQuestionsAnswered: number;
    correctAnswers: number;
    wrongAnswers: number;
    unansweredQuestions: number;
    avgScore: number;
    avgPercentage: number;
    accuracy: number;
  };
  recentQuizzes: Array<{
    assignmentId: string;
    quizId: string;
    quizVersionId: string;
    quizTitle: string;
    classroomName: string | null;
    status: 'completed' | 'pending' | 'missed';
    score: number | null;
    percentage: number | null;
    dueAt: string | null;
  }>;
  performanceOverTime: Array<{
    date: string;
    score: number;
    percentage: number;
  }>;
}

export interface TeacherDashboardData {
  metrics: {
    myClassrooms: number;
    myStudents: number;
    myQuizzes: number;
    assignedQuizzes: number;
    completedAttempts: number;
    avgScorePercentage: number;
  };
  recentAssignments: Array<{
    id: string;
    quizTitle: string;
    classroomName: string;
    dueAt: string | null;
    createdAt: string;
  }>;
}

export const dashboardsApi = {
  getStudentDashboard: async (): Promise<StudentDashboardData> => {
    const response = await apiClient.get<StudentDashboardData>('/student/dashboard');
    return response.data;
  },

  getTeacherDashboard: async (): Promise<TeacherDashboardData> => {
    const response = await apiClient.get<TeacherDashboardData>('/teacher/dashboard');
    return response.data;
  },
};
