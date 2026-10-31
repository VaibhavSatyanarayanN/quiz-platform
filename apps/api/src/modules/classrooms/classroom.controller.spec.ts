import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ClassroomController } from './classroom.controller.js';
import { ClassroomService } from './classroom.service.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

describe('ClassroomController Role Metadata & Handlers', () => {
  let controller: ClassroomController;
  let mockClassroomService: any;
  const reflector = new Reflector();

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@test.com',
    role: UserRole.CREATOR,
  };

  beforeEach(() => {
    mockClassroomService = {
      createClassroom: vi.fn().mockResolvedValue({ id: 'class-1' }),
      getClassroomsForUser: vi.fn().mockResolvedValue([]),
      getClassroomDetails: vi.fn().mockResolvedValue({ id: 'class-1' }),
      addTeacher: vi.fn().mockResolvedValue({ id: 'tr-1' }),
      removeTeacher: vi.fn().mockResolvedValue({ message: 'Teacher removed' }),
      addStudent: vi.fn().mockResolvedValue({ id: 'sr-1' }),
      removeStudent: vi.fn().mockResolvedValue({ message: 'Student removed' }),
    };

    controller = new ClassroomController(
      mockClassroomService as unknown as ClassroomService,
    );
  });

  describe('Role Guard Metadata', () => {
    it('requires CREATOR or ADMIN roles on createClassroom', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.createClassroom);
      expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
    });

    it('requires CREATOR or ADMIN roles on addTeacher', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.addTeacher);
      expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
    });

    it('requires CREATOR or ADMIN roles on removeTeacher', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.removeTeacher);
      expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
    });

    it('requires CREATOR or ADMIN roles on addStudent', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.addStudent);
      expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
    });

    it('requires CREATOR or ADMIN roles on removeStudent', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.removeStudent);
      expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
    });

    it('does not place CREATOR restriction on getClassrooms (allows student access to enrolled classes)', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.getClassrooms);
      expect(roles).toBeUndefined();
    });

    it('does not place CREATOR restriction on getClassroomDetails (students can view their classes)', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.getClassroomDetails);
      expect(roles).toBeUndefined();
    });
  });

  describe('Handler Delegation', () => {
    it('delegates createClassroom to service', async () => {
      const dto = { organizationId: 'org-1', name: 'Math 101' };
      await controller.createClassroom(dto, mockUser);
      expect(mockClassroomService.createClassroom).toHaveBeenCalledWith(dto, mockUser);
    });

    it('delegates getClassroomDetails to service', async () => {
      await controller.getClassroomDetails('class-1', mockUser);
      expect(mockClassroomService.getClassroomDetails).toHaveBeenCalledWith('class-1', mockUser);
    });

    it('delegates addTeacher to service', async () => {
      await controller.addTeacher('class-1', { teacherId: 'teacher-2' }, mockUser);
      expect(mockClassroomService.addTeacher).toHaveBeenCalledWith('class-1', 'teacher-2', mockUser);
    });

    it('delegates removeTeacher to service', async () => {
      await controller.removeTeacher('class-1', 'teacher-2', mockUser);
      expect(mockClassroomService.removeTeacher).toHaveBeenCalledWith('class-1', 'teacher-2', mockUser);
    });

    it('delegates addStudent to service', async () => {
      await controller.addStudent('class-1', { studentId: 'student-2' }, mockUser);
      expect(mockClassroomService.addStudent).toHaveBeenCalledWith('class-1', 'student-2', mockUser);
    });

    it('delegates removeStudent to service', async () => {
      await controller.removeStudent('class-1', 'student-2', mockUser);
      expect(mockClassroomService.removeStudent).toHaveBeenCalledWith('class-1', 'student-2', mockUser);
    });
  });
});
