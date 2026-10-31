import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { OrganizationService } from './organization.service.js';
import { OrganizationRole } from './enums/organization-role.enum.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { QuizStatus } from '../quizzes/enums/quiz-status.enum.js';
import { AttemptStatus } from '../quizzes/enums/attempt-status.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

describe('OrganizationService Analytics & Verification', () => {
  let service: OrganizationService;
  let mockOrgRepo: any;
  let mockMemberRepo: any;
  let mockDataSource: any;
  let mockQuizRepo: any;
  let mockAttemptRepo: any;

  const adminUser: AuthenticatedUser = {
    userId: 'admin-1',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    platformRole: 'platform_admin',
  };

  const orgAdminUser: AuthenticatedUser = {
    userId: 'org-admin-1',
    email: 'orgadmin@test.com',
    role: UserRole.CREATOR,
  };

  const outsiderUser: AuthenticatedUser = {
    userId: 'outsider-1',
    email: 'outsider@test.com',
    role: UserRole.LEARNER,
  };

  const testOrg = {
    id: 'org-1',
    name: 'Acme Academy',
  };

  beforeEach(() => {
    mockOrgRepo = {
      findOne: vi.fn(),
    };

    mockMemberRepo = {
      findOne: vi.fn(),
      count: vi.fn().mockResolvedValue(10),
    };

    mockQuizRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockAttemptRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockDataSource = {
      getRepository: vi.fn((entity) => {
        if (entity.name === 'Quiz') return mockQuizRepo;
        if (entity.name === 'QuizAttempt') return mockAttemptRepo;
        return { find: vi.fn().mockResolvedValue([]) };
      }),
    };

    service = new OrganizationService(mockOrgRepo, mockMemberRepo, mockDataSource);
  });

  describe('getOrganizationAnalytics', () => {
    it('throws NotFoundException if organization does not exist', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getOrganizationAnalytics('non-existent', orgAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user is not member and not platform admin', async () => {
      mockOrgRepo.findOne.mockResolvedValue(testOrg);
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getOrganizationAnalytics('org-1', outsiderUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows platform admin to view organization analytics', async () => {
      mockOrgRepo.findOne.mockResolvedValue(testOrg);
      mockMemberRepo.findOne.mockResolvedValue(null);

      const analytics = await service.getOrganizationAnalytics('org-1', adminUser);
      expect(analytics.organizationId).toBe('org-1');
    });

    it('calculates metrics accurately for organization quizzes using batch In query', async () => {
      mockOrgRepo.findOne.mockResolvedValue(testOrg);
      mockMemberRepo.findOne.mockResolvedValue({ role: OrganizationRole.ADMIN });

      mockQuizRepo.find.mockResolvedValue([
        { id: 'q-1', title: 'Quiz 1', status: QuizStatus.PUBLISHED },
        { id: 'q-2', title: 'Quiz 2', status: QuizStatus.DRAFT },
      ]);

      mockAttemptRepo.find.mockResolvedValue([
        { id: 'a-1', quizId: 'q-1', status: AttemptStatus.SUBMITTED, percentage: 80 },
        { id: 'a-2', quizId: 'q-1', status: AttemptStatus.EXPIRED, percentage: 40 },
      ]);

      const analytics = await service.getOrganizationAnalytics('org-1', orgAdminUser);

      expect(analytics.organizationId).toBe('org-1');
      expect(analytics.totalQuizzes).toBe(2);
      expect(analytics.publishedQuizzes).toBe(1);
      expect(analytics.totalAttempts).toBe(2);
      expect(analytics.completedAttempts).toBe(2);
      expect(analytics.avgPercentage).toBe(60);
      expect(analytics.topQuizzes).toHaveLength(2);
      expect(analytics.topQuizzes[0].quizId).toBe('q-1');
      expect(analytics.topQuizzes[0].attemptCount).toBe(2);
    });
  });
});
