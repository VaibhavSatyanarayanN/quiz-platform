import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ClassroomService } from './classroom.service.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { OrganizationRole } from '../organizations/enums/organization-role.enum.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

describe('ClassroomService Authorization & Management', () => {
  let service: ClassroomService;
  let mockClassroomRepo: any;
  let mockTeacherRepo: any;
  let mockStudentRepo: any;
  let mockOrgService: any;

  const mockAdmin: AuthenticatedUser = {
    userId: 'admin-1',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    platformRole: 'platform_admin',
  };

  const mockCreator: AuthenticatedUser = {
    userId: 'creator-1',
    email: 'creator@test.com',
    role: UserRole.CREATOR,
  };

  const mockOtherUser: AuthenticatedUser = {
    userId: 'other-1',
    email: 'other@test.com',
    role: UserRole.CREATOR,
  };

  const mockStudentUser: AuthenticatedUser = {
    userId: 'student-1',
    email: 'student@test.com',
    role: UserRole.LEARNER,
  };

  const testClassroom = {
    id: 'class-1',
    organizationId: 'org-1',
    name: 'Class A',
    createdBy: 'creator-1',
    isActive: true,
  };

  beforeEach(() => {
    mockClassroomRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn((dto) => ({ ...dto, id: 'class-new' })),
      save: vi.fn((c) => Promise.resolve(c)),
      createQueryBuilder: vi.fn(),
    };

    mockTeacherRepo = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((dto) => ({ ...dto, id: 'teacher-rec-1' })),
      save: vi.fn((t) => Promise.resolve(t)),
      remove: vi.fn().mockResolvedValue(true),
    };

    mockStudentRepo = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((dto) => ({ ...dto, id: 'student-rec-1' })),
      save: vi.fn((s) => Promise.resolve(s)),
    };

    mockOrgService = {
      getUserMemberships: vi.fn().mockResolvedValue([]),
    };

    service = new ClassroomService(
      mockClassroomRepo,
      mockTeacherRepo,
      mockStudentRepo,
      mockOrgService,
    );
  });

  describe('getClassroomDetails authorization (BOLA/IDOR protection)', () => {
    it('allows the classroom creator to view details', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);

      const result = await service.getClassroomDetails('class-1', mockCreator);
      expect(result.id).toBe('class-1');
      expect(result.name).toBe('Class A');
    });

    it('allows a platform admin to view details', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);

      const result = await service.getClassroomDetails('class-1', mockAdmin);
      expect(result.id).toBe('class-1');
    });

    it('allows an assigned teacher to view details', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);
      mockTeacherRepo.findOne.mockResolvedValue({ id: 'tr-1', teacherId: 'other-1', classroomId: 'class-1' });

      const result = await service.getClassroomDetails('class-1', mockOtherUser);
      expect(result.id).toBe('class-1');
    });

    it('allows an enrolled active student to view details', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);
      mockTeacherRepo.findOne.mockResolvedValue(null);
      mockStudentRepo.findOne.mockResolvedValue({ id: 'sr-1', studentId: 'student-1', classroomId: 'class-1', isActive: true });

      const result = await service.getClassroomDetails('class-1', mockStudentUser);
      expect(result.id).toBe('class-1');
    });

    it('allows an organization admin to view details', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);
      mockTeacherRepo.findOne.mockResolvedValue(null);
      mockStudentRepo.findOne.mockResolvedValue(null);
      mockOrgService.getUserMemberships.mockResolvedValue([{ organizationId: 'org-1', role: OrganizationRole.ADMIN }]);

      const result = await service.getClassroomDetails('class-1', mockOtherUser);
      expect(result.id).toBe('class-1');
    });

    it('rejects an unrelated user with ForbiddenException', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);
      mockTeacherRepo.findOne.mockResolvedValue(null);
      mockStudentRepo.findOne.mockResolvedValue(null);
      mockOrgService.getUserMemberships.mockResolvedValue([]);

      await expect(service.getClassroomDetails('class-1', mockOtherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException if classroom does not exist', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(null);

      await expect(service.getClassroomDetails('unknown', mockCreator)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Management authorization (add/remove teachers & students)', () => {
    it('allows creator to add a student', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);
      mockStudentRepo.findOne.mockResolvedValue(null);

      const res = await service.addStudent('class-1', 'student-2', mockCreator);
      expect(res.studentId).toBe('student-2');
      expect(mockStudentRepo.save).toHaveBeenCalled();
    });

    it('allows creator to add a teacher', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);
      mockTeacherRepo.findOne.mockResolvedValue(null);

      const res = await service.addTeacher('class-1', 'teacher-2', mockCreator);
      expect(res.teacherId).toBe('teacher-2');
      expect(mockTeacherRepo.save).toHaveBeenCalled();
    });

    it('blocks unrelated user from adding a student with ForbiddenException', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);
      mockTeacherRepo.findOne.mockResolvedValue(null);
      mockOrgService.getUserMemberships.mockResolvedValue([]);

      await expect(service.addStudent('class-1', 'student-2', mockOtherUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockStudentRepo.save).not.toHaveBeenCalled();
    });

    it('blocks unrelated user from removing a teacher with ForbiddenException', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);
      mockTeacherRepo.findOne.mockResolvedValue(null);
      mockOrgService.getUserMemberships.mockResolvedValue([]);

      await expect(service.removeTeacher('class-1', 'teacher-2', mockOtherUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockTeacherRepo.remove).not.toHaveBeenCalled();
    });

    it('throws ConflictException when adding existing teacher', async () => {
      mockClassroomRepo.findOne.mockResolvedValue(testClassroom);
      mockTeacherRepo.findOne.mockResolvedValue({ id: 'tr-1', teacherId: 'teacher-2' });

      await expect(service.addTeacher('class-1', 'teacher-2', mockCreator)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
