import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { classroomsApi } from '../api/classrooms.api.js';
import type { CreateClassroomRequest } from '../types/classroom.types.js';

export function useClassrooms(organizationId?: string) {
  return useQuery({
    queryKey: ['classrooms', organizationId ?? 'all'],
    queryFn: () => classroomsApi.getClassrooms(organizationId),
  });
}

export function useClassroomDetails(classroomId: string) {
  return useQuery({
    queryKey: ['classroom-details', classroomId],
    queryFn: () => classroomsApi.getClassroomDetails(classroomId),
    enabled: !!classroomId,
  });
}

export function useOrganizationStudents(organizationId?: string) {
  return useQuery({
    queryKey: ['organization-students', organizationId],
    queryFn: () => classroomsApi.getOrganizationStudents(organizationId!),
    enabled: !!organizationId,
  });
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClassroomRequest) => classroomsApi.createClassroom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}

export function useAddClassroomStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classroomId, studentId }: { classroomId: string; studentId: string }) =>
      classroomsApi.addStudent(classroomId, studentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classroom-details', variables.classroomId] });
    },
  });
}

export function useRemoveClassroomStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classroomId, studentId }: { classroomId: string; studentId: string }) =>
      classroomsApi.removeStudent(classroomId, studentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classroom-details', variables.classroomId] });
    },
  });
}

export function useCreateOrgStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      email,
      username,
      tempPassword,
    }: {
      organizationId: string;
      email: string;
      username: string;
      tempPassword?: string;
    }) => classroomsApi.createOrgStudent(organizationId, { email, username, tempPassword }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-students', variables.organizationId] });
    },
  });
}

export function useCreateOrgTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      email,
      username,
      tempPassword,
    }: {
      organizationId: string;
      email: string;
      username: string;
      tempPassword?: string;
    }) => classroomsApi.createOrgTeacher(organizationId, { email, username, tempPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}
