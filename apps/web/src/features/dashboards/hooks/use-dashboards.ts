import { useQuery } from '@tanstack/react-query';
import { dashboardsApi } from '../api/dashboards.api.js';

export function useStudentDashboard() {
  return useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardsApi.getStudentDashboard(),
  });
}

export function useTeacherDashboard() {
  return useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: () => dashboardsApi.getTeacherDashboard(),
  });
}
