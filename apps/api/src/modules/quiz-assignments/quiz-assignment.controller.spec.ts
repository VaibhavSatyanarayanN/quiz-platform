import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { QuizAssignmentController } from './quiz-assignment.controller.js';
import { QuizAssignmentService } from './quiz-assignment.service.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

describe('QuizAssignmentController Role Metadata & Handlers', () => {
  let controller: QuizAssignmentController;
  let mockService: any;
  const reflector = new Reflector();

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@test.com',
    role: UserRole.CREATOR,
  };

  beforeEach(() => {
    mockService = {
      createAssignment: vi.fn().mockResolvedValue({ id: 'assign-1' }),
      getAssignmentsForUser: vi.fn().mockResolvedValue([]),
    };

    controller = new QuizAssignmentController(mockService as unknown as QuizAssignmentService);
  });

  it('requires CREATOR or ADMIN roles on createAssignment', () => {
    const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.createAssignment);
    expect(roles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
  });

  it('delegates createAssignment to service', async () => {
    const dto = {
      quizId: 'quiz-1',
      quizVersionId: 'v-1',
      organizationId: 'org-1',
    };
    await controller.createAssignment(dto, mockUser);
    expect(mockService.createAssignment).toHaveBeenCalledWith(dto, mockUser);
  });

  it('delegates getAssignments to service', async () => {
    await controller.getAssignments(mockUser);
    expect(mockService.getAssignmentsForUser).toHaveBeenCalledWith(mockUser);
  });
});
