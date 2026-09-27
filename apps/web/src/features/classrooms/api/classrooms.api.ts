import { apiClient } from '@/lib/api/client';
import type { Classroom, CreateClassroomRequest } from '../types/classroom.types.js';

export interface OrganizationStudent {
  id: string;
  userId: string;
  username: string;
  email: string;
  role: string;
  joinedAt: string;
}

export const classroomsApi = {
  getClassrooms: async (organizationId?: string): Promise<Classroom[]> => {
    const response = await apiClient.get<Classroom[]>('/classrooms', {
      params: organizationId ? { organizationId } : undefined,
    });
    return response.data;
  },

  getClassroomDetails: async (classroomId: string): Promise<Classroom> => {
    const response = await apiClient.get<Classroom>(`/classrooms/${classroomId}`);
    return response.data;
  },

  getOrganizationStudents: async (organizationId: string): Promise<OrganizationStudent[]> => {
    const response = await apiClient.get<OrganizationStudent[]>(`/organizations/${organizationId}/students`);
    return response.data;
  },

  createClassroom: async (data: CreateClassroomRequest): Promise<Classroom> => {
    const response = await apiClient.post<Classroom>('/classrooms', data);
    return response.data;
  },

  addTeacher: async (classroomId: string, teacherId: string): Promise<void> => {
    await apiClient.post(`/classrooms/${classroomId}/teachers`, { teacherId });
  },

  removeTeacher: async (classroomId: string, teacherId: string): Promise<void> => {
    await apiClient.delete(`/classrooms/${classroomId}/teachers/${teacherId}`);
  },

  addStudent: async (classroomId: string, studentId: string): Promise<void> => {
    await apiClient.post(`/classrooms/${classroomId}/students`, { studentId });
  },

  removeStudent: async (classroomId: string, studentId: string): Promise<void> => {
    await apiClient.delete(`/classrooms/${classroomId}/students/${studentId}`);
  },

  createOrgStudent: async (
    organizationId: string,
    data: { email: string; username: string; tempPassword?: string },
  ): Promise<OrganizationStudent> => {
    const response = await apiClient.post<OrganizationStudent>(
      `/organizations/${organizationId}/students`,
      data,
    );
    return response.data;
  },

  createOrgTeacher: async (
    organizationId: string,
    data: { email: string; username: string; tempPassword?: string },
  ): Promise<OrganizationStudent> => {
    const response = await apiClient.post<OrganizationStudent>(
      `/organizations/${organizationId}/teachers`,
      data,
    );
    return response.data;
  },
};
