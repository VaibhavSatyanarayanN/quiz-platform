import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { DashboardController } from './dashboard.controller.js';
import { StudentDashboardService } from './student-dashboard.service.js';
import { TeacherDashboardService } from './teacher-dashboard.service.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

describe('DashboardController Role Metadata & Handlers', () => {
  let controller: DashboardController;
  let mockStudentService: any;
  let mockTeacherService: any;
  const reflector = new Reflector();

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@test.com',
    role: UserRole.CREATOR,
  };

  beforeEach(() => {
    mockStudentService = {
      getStudentDashboard: vi.fn().mockResolvedValue({ enrolledClassrooms: [] }),
    };

    mockTeacherService = {
      getTeacherDashboard: vi.fn().mockResolvedValue({ totalQuizzes: 5 }),
    };

    controller = new DashboardController(
      mockStudentService as unknown as StudentDashboardService,
      mockTeacherService as unknown as TeacherDashboardService,
    );
  });

  it('requires CREATOR or ADMIN role on getTeacherDashboard', () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.getTeacherDashboard);
    expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
  });

  it('allows learners on getStudentDashboard (no role restriction)', () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.getStudentDashboard);
    expect(roles).toBeUndefined();
  });

  it('delegates getStudentDashboard to service', async () => {
    await controller.getStudentDashboard(mockUser);
    expect(mockStudentService.getStudentDashboard).toHaveBeenCalledWith(mockUser.userId);
  });

  it('delegates getTeacherDashboard to service', async () => {
    await controller.getTeacherDashboard(mockUser);
    expect(mockTeacherService.getTeacherDashboard).toHaveBeenCalledWith(mockUser);
  });
});
