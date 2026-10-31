import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuizAssignmentService } from './quiz-assignment.service.js';
import { QuizVersionStatus } from '../quizzes/enums/quiz-version-status.enum.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { OrganizationRole } from '../organizations/enums/organization-role.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

describe('QuizAssignmentService', () => {
  let service: QuizAssignmentService;
  let mockAssignmentRepo: any;
  let mockRecipientRepo: any;
  let mockVersionRepo: any;
  let mockDataSource: any;
  let mockTeacherRepo: any;
  let mockOrgMemberRepo: any;
  let mockStudentRepo: any;

  const creatorUser: AuthenticatedUser = {
    userId: 'creator-1',
    email: 'creator@test.com',
    role: UserRole.CREATOR,
  };

  const adminUser: AuthenticatedUser = {
    userId: 'admin-1',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    platformRole: 'platform_admin',
  };

  const strangerUser: AuthenticatedUser = {
    userId: 'stranger-1',
    email: 'stranger@test.com',
    role: UserRole.CREATOR,
  };

  const publishedVersion = {
    id: 'v-1',
    quizId: 'quiz-1',
    status: QuizVersionStatus.PUBLISHED,
    quiz: {
      id: 'quiz-1',
      creatorId: 'creator-1',
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    mockAssignmentRepo = {
      create: vi.fn((dto) => ({ ...dto, id: 'assign-1' })),
      save: vi.fn((a) => Promise.resolve(a)),
      find: vi.fn().mockResolvedValue([]),
    };

    mockRecipientRepo = {
      create: vi.fn((dto) => ({ ...dto, id: 'rec-1' })),
      save: vi.fn((r) => Promise.resolve(r)),
    };

    mockVersionRepo = {
      findOne: vi.fn(),
    };

    mockTeacherRepo = {
      findOne: vi.fn(),
    };

    mockOrgMemberRepo = {
      findOne: vi.fn(),
    };

    mockStudentRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockDataSource = {
      getRepository: vi.fn((entity) => {
        if (entity.name === 'ClassroomTeacher') return mockTeacherRepo;
        if (entity.name === 'OrganizationMember') return mockOrgMemberRepo;
        if (entity.name === 'ClassroomStudent') return mockStudentRepo;
        return { findOne: vi.fn(), find: vi.fn().mockResolvedValue([]) };
      }),
    };

    service = new QuizAssignmentService(
      mockAssignmentRepo,
      mockRecipientRepo,
      mockVersionRepo,
      mockDataSource,
    );
  });

  describe('createAssignment authorization & validation', () => {
    it('throws NotFoundException if quiz version does not exist', async () => {
      mockVersionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createAssignment(
          { quizId: 'quiz-1', quizVersionId: 'v-unknown', organizationId: 'org-1' },
          creatorUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if quiz version is not PUBLISHED', async () => {
      mockVersionRepo.findOne.mockResolvedValue({
        ...publishedVersion,
        status: QuizVersionStatus.DRAFT,
      });

      await expect(
        service.createAssignment(
          { quizId: 'quiz-1', quizVersionId: 'v-1', organizationId: 'org-1' },
          creatorUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows quiz creator to create assignment', async () => {
      mockVersionRepo.findOne.mockResolvedValue(publishedVersion);

      const res = await service.createAssignment(
        { quizId: 'quiz-1', quizVersionId: 'v-1', organizationId: 'org-1' },
        creatorUser,
      );

      expect(res.id).toBe('assign-1');
      expect(mockAssignmentRepo.save).toHaveBeenCalled();
    });

    it('allows platform admin to create assignment for any quiz', async () => {
      mockVersionRepo.findOne.mockResolvedValue(publishedVersion);

      const res = await service.createAssignment(
        { quizId: 'quiz-1', quizVersionId: 'v-1', organizationId: 'org-1' },
        adminUser,
      );

      expect(res.id).toBe('assign-1');
    });

    it('allows classroom teacher to create assignment for assigned classroom', async () => {
      mockVersionRepo.findOne.mockResolvedValue(publishedVersion);
      mockTeacherRepo.findOne.mockResolvedValue({ id: 'tr-1', teacherId: 'stranger-1' });

      const res = await service.createAssignment(
        { quizId: 'quiz-1', quizVersionId: 'v-1', organizationId: 'org-1', classroomId: 'class-1' },
        strangerUser,
      );

      expect(res.id).toBe('assign-1');
    });

    it('allows organization admin to create assignment for org quiz', async () => {
      mockVersionRepo.findOne.mockResolvedValue(publishedVersion);
      mockTeacherRepo.findOne.mockResolvedValue(null);
      mockOrgMemberRepo.findOne.mockResolvedValue({ role: OrganizationRole.ADMIN });

      const res = await service.createAssignment(
        { quizId: 'quiz-1', quizVersionId: 'v-1', organizationId: 'org-1' },
        strangerUser,
      );

      expect(res.id).toBe('assign-1');
    });

    it('blocks unauthorized creator from assigning another creators quiz with ForbiddenException', async () => {
      mockVersionRepo.findOne.mockResolvedValue(publishedVersion);
      mockTeacherRepo.findOne.mockResolvedValue(null);
      mockOrgMemberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createAssignment(
          { quizId: 'quiz-1', quizVersionId: 'v-1', organizationId: 'org-1' },
          strangerUser,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAssignmentRepo.save).not.toHaveBeenCalled();
    });
  });
});
