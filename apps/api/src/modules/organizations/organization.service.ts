import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Organization } from './entities/organization.entity.js';
import { OrganizationMember } from './entities/organization-member.entity.js';
import { OrganizationRole } from './enums/organization-role.enum.js';
import { randomBytes } from 'node:crypto';
import { Quiz } from '../quizzes/entities/quiz.entity.js';
import { QuizAttempt } from '../quizzes/entities/quiz-attempt.entity.js';
import { QuizStatus } from '../quizzes/enums/quiz-status.enum.js';
import { AttemptStatus } from '../quizzes/enums/attempt-status.enum.js';
import { OrganizationAnalyticsResponseDto, TopQuizAnalyticsDto } from './dto/organization-analytics.dto.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { UserRole } from '../users/enums/user-role.enum.js';

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'org';
}

import { UserService } from '../users/user.service.js';
import * as argon2 from 'argon2';
import { CreateOrgStudentDto } from './dto/create-student.dto.js';
import { CreateOrgTeacherDto } from './dto/create-teacher.dto.js';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,

    private readonly dataSource: DataSource,
    private readonly userService: UserService,
  ) {}

  async createOrganization(name: string): Promise<Organization> {
    const trimmedName = name.trim();
    let slug = slugify(trimmedName);

    const existingWithSlug = await this.organizationRepository.findOne({
      where: { slug },
    });

    if (existingWithSlug) {
      slug = `${slug}-${randomBytes(2).toString('hex')}`;
    }

    const organization = this.organizationRepository.create({
      name: trimmedName,
      slug,
      isActive: true,
    });

    return this.organizationRepository.save(organization);
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({ where: { slug } });
  }

  async findAll(): Promise<Organization[]> {
    return this.organizationRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getUserMemberships(userId: string): Promise<OrganizationMember[]> {
    return this.memberRepository.find({
      where: { userId },
      relations: { organization: true },
    });
  }

  async getPrimaryMembership(userId: string): Promise<OrganizationMember | null> {
    const memberships = await this.getUserMemberships(userId);
    return memberships.find((m) => m.organization?.isActive) ?? memberships[0] ?? null;
  }

  async addMember(
    organizationId: string,
    userId: string,
    role: OrganizationRole = OrganizationRole.TEACHER,
  ): Promise<OrganizationMember> {
    const organization = await this.findById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const existingMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    const member = this.memberRepository.create({
      organizationId,
      userId,
      role,
    });

    return this.memberRepository.save(member);
  }

  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    return this.memberRepository.find({
      where: { organizationId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getCreatorCount(organizationId: string): Promise<number> {
    return this.memberRepository.count({
      where: { organizationId },
    });
  }

  async getOrganizationAnalytics(
    organizationId: string,
    user: AuthenticatedUser,
  ): Promise<OrganizationAnalyticsResponseDto> {
    const org = await this.findById(organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const isAdmin = user.role === UserRole.ADMIN;
    if (!isAdmin) {
      const membership = await this.memberRepository.findOne({
        where: { organizationId, userId: user.userId },
      });
      if (!membership) {
        throw new ForbiddenException('You do not belong to this organization');
      }
    }

    const totalMembers = await this.memberRepository.count({
      where: { organizationId },
    });

    const quizzes = await this.dataSource.getRepository(Quiz).find({
      where: { organizationId },
    });

    const totalQuizzes = quizzes.length;
    const publishedQuizzes = quizzes.filter((q) => q.status === QuizStatus.PUBLISHED).length;

    let totalAttempts = 0;
    let completedAttempts = 0;
    let avgPercentage = 0;

    const topQuizzes: TopQuizAnalyticsDto[] = [];

    if (totalQuizzes > 0) {
      const quizIds = quizzes.map((q) => q.id);

      const attempts = await this.dataSource.getRepository(QuizAttempt).find({
        where: quizIds.map((id) => ({ quizId: id })),
      });

      totalAttempts = attempts.length;
      const completedList = attempts.filter(
        (a) => a.status === AttemptStatus.SUBMITTED || a.status === AttemptStatus.EXPIRED,
      );
      completedAttempts = completedList.length;

      if (completedAttempts > 0) {
        const sumPct = completedList.reduce((sum, a) => sum + Number(a.percentage ?? 0), 0);
        avgPercentage = Math.round((sumPct / completedAttempts) * 100) / 100;
      }

      for (const q of quizzes) {
        const qAttempts = attempts.filter((a) => a.quizId === q.id);
        const qCompleted = qAttempts.filter(
          (a) => a.status === AttemptStatus.SUBMITTED || a.status === AttemptStatus.EXPIRED,
        );
        let qAvgPct = 0;
        if (qCompleted.length > 0) {
          const qSum = qCompleted.reduce((sum, a) => sum + Number(a.percentage ?? 0), 0);
          qAvgPct = Math.round((qSum / qCompleted.length) * 100) / 100;
        }

        topQuizzes.push({
          quizId: q.id,
          title: q.title,
          attemptCount: qAttempts.length,
          avgPercentage: qAvgPct,
        });
      }

      topQuizzes.sort((a, b) => b.attemptCount - a.attemptCount || b.avgPercentage - a.avgPercentage);
    }

    return {
      organizationId: org.id,
      organizationName: org.name,
      totalQuizzes,
      publishedQuizzes,
      totalAttempts,
      completedAttempts,
      avgPercentage,
      totalMembers,
      topQuizzes: topQuizzes.slice(0, 5),
    };
  }

  async getOrganizationStudents(
    organizationId: string,
    user: AuthenticatedUser,
  ) {
    const org = await this.findById(organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const isPlatformAdmin = user.platformRole === 'platform_admin' || user.role === UserRole.ADMIN;
    if (!isPlatformAdmin) {
      const membership = await this.memberRepository.findOne({
        where: { organizationId, userId: user.userId },
      });
      if (!membership) {
        throw new ForbiddenException('You do not belong to this organization');
      }
    }

    const members = await this.memberRepository.find({
      where: { organizationId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    return members
      .filter(
        (m) =>
          m.isActive &&
          m.user &&
          m.user.isActive &&
          (m.role === OrganizationRole.STUDENT || m.user.role === UserRole.USER),
      )
      .map((m) => ({
        id: m.id,
        userId: m.user.id,
        username: m.user.username,
        email: m.user.email,
        role: m.role,
        joinedAt: m.createdAt,
      }));
  }

  async getOrganizationCreators(
    organizationId: string,
    user: AuthenticatedUser,
  ) {
    const org = await this.findById(organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const isPlatformAdmin = user.platformRole === 'platform_admin' || user.role === UserRole.ADMIN;
    if (!isPlatformAdmin) {
      const membership = await this.memberRepository.findOne({
        where: { organizationId, userId: user.userId },
      });
      if (!membership) {
        throw new ForbiddenException('You do not belong to this organization');
      }
    }

    const members = await this.memberRepository.find({
      where: { organizationId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    return {
      items: members
        .filter((m) => m.user)
        .map((m) => ({
          id: m.id,
          userId: m.user.id,
          username: m.user.username,
          name: m.user.username,
          email: m.user.email,
          isActive: m.user.isActive,
          role: m.role,
          createdAt: m.createdAt,
        })),
    };
  }

  async createOrgStudent(
    organizationId: string,
    dto: CreateOrgStudentDto,
    user: AuthenticatedUser,
  ) {
    const org = await this.findById(organizationId);
    if (!org) throw new NotFoundException('Organization not found');

    const isPlatformAdmin = user.platformRole === 'platform_admin' || user.role === UserRole.ADMIN;
    if (!isPlatformAdmin) {
      const membership = await this.memberRepository.findOne({
        where: { organizationId, userId: user.userId },
      });
      if (!membership) {
        throw new ForbiddenException('You do not belong to this organization');
      }
      const canCreateStudent =
        membership.role === OrganizationRole.ADMIN ||
        membership.role === OrganizationRole.TEACHER ||
        user.role === UserRole.CREATOR;
      if (!canCreateStudent) {
        throw new ForbiddenException('You do not have permission to create students in this organization');
      }
    }

    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();

    if (!dto.tempPassword || !dto.tempPassword.trim()) {
      throw new ConflictException('Password is required');
    }

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) throw new ConflictException('User email already exists');

    const passwordHash = await argon2.hash(dto.tempPassword.trim(), { type: argon2.argon2id });

    const newUser = await this.userService.create({
      email,
      username,
      passwordHash,
      role: UserRole.USER,
      mustChangePassword: true,
      isActive: true,
    });

    const member = await this.addMember(organizationId, newUser.id, OrganizationRole.STUDENT);

    return {
      id: member.id,
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: OrganizationRole.STUDENT,
      mustChangePassword: true,
    };
  }

  async createOrgTeacher(
    organizationId: string,
    dto: CreateOrgTeacherDto,
    user: AuthenticatedUser,
  ) {
    const org = await this.findById(organizationId);
    if (!org) throw new NotFoundException('Organization not found');

    const isPlatformAdmin = user.platformRole === 'platform_admin' || user.role === UserRole.ADMIN;
    if (!isPlatformAdmin) {
      const membership = await this.memberRepository.findOne({
        where: { organizationId, userId: user.userId },
      });
      if (!membership || membership.role !== OrganizationRole.ADMIN) {
        throw new ForbiddenException('Only organization admins can create teachers/creators in this organization');
      }
    }

    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();

    if (!dto.tempPassword || !dto.tempPassword.trim()) {
      throw new ConflictException('Password is required');
    }

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) throw new ConflictException('User email already exists');

    const passwordHash = await argon2.hash(dto.tempPassword.trim(), { type: argon2.argon2id });

    const newUser = await this.userService.create({
      email,
      username,
      passwordHash,
      role: UserRole.CREATOR,
      mustChangePassword: true,
      isActive: true,
    });

    const member = await this.addMember(organizationId, newUser.id, OrganizationRole.TEACHER);

    return {
      id: member.id,
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: OrganizationRole.TEACHER,
      mustChangePassword: true,
    };
  }
}
