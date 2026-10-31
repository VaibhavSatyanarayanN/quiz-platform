import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { QuizAssignment } from './entities/quiz-assignment.entity.js';
import { QuizAssignmentRecipient } from './entities/quiz-assignment-recipient.entity.js';
import { QuizVersion } from '../quizzes/entities/quiz-version.entity.js';
import { QuizVersionStatus } from '../quizzes/enums/quiz-version-status.enum.js';
import { ClassroomStudent } from '../classrooms/entities/classroom-student.entity.js';
import { ClassroomTeacher } from '../classrooms/entities/classroom-teacher.entity.js';
import { OrganizationMember } from '../organizations/entities/organization-member.entity.js';
import { OrganizationRole } from '../organizations/enums/organization-role.enum.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { CreateQuizAssignmentDto } from './dto/create-assignment.dto.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Injectable()
export class QuizAssignmentService {
  constructor(
    @InjectRepository(QuizAssignment)
    private readonly assignmentRepository: Repository<QuizAssignment>,

    @InjectRepository(QuizAssignmentRecipient)
    private readonly recipientRepository: Repository<QuizAssignmentRecipient>,

    @InjectRepository(QuizVersion)
    private readonly quizVersionRepository: Repository<QuizVersion>,

    private readonly dataSource: DataSource,
  ) {}

  async createAssignment(dto: CreateQuizAssignmentDto, user: AuthenticatedUser) {
    const version = await this.quizVersionRepository.findOne({
      where: { id: dto.quizVersionId, quizId: dto.quizId },
      relations: { quiz: true },
    });

    if (!version) {
      throw new NotFoundException('Quiz version not found');
    }

    if (version.status !== QuizVersionStatus.PUBLISHED) {
      throw new BadRequestException('Assignments must reference a published quiz version');
    }

    const isPlatformAdmin = user.platformRole === 'platform_admin' || user.role === UserRole.ADMIN;
    const isQuizCreator = version.quiz?.creatorId === user.userId;

    if (!isPlatformAdmin && !isQuizCreator) {
      let isAuthorized = false;
      if (dto.classroomId) {
        const teacherRec = await this.dataSource.getRepository(ClassroomTeacher).findOne({
          where: { classroomId: dto.classroomId, teacherId: user.userId },
        });
        if (teacherRec) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized && dto.organizationId) {
        const member = await this.dataSource.getRepository(OrganizationMember).findOne({
          where: { organizationId: dto.organizationId, userId: user.userId },
        });
        if (member && (member.role === OrganizationRole.ADMIN || (member.role as string) === 'admin')) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        throw new ForbiddenException('You do not have permission to assign this quiz');
      }
    }

    const assignment = this.assignmentRepository.create({
      quizId: dto.quizId,
      quizVersionId: dto.quizVersionId,
      organizationId: dto.organizationId,
      classroomId: dto.classroomId ?? null,
      assignedBy: user.userId,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      isActive: true,
    });

    const savedAssignment = await this.assignmentRepository.save(assignment);

    const recipientStudentIds = new Set<string>();

    if (dto.classroomId) {
      const classroomStudents = await this.dataSource
        .getRepository(ClassroomStudent)
        .find({
          where: { classroomId: dto.classroomId, isActive: true },
        });
      classroomStudents.forEach((cs) => recipientStudentIds.add(cs.studentId));
    }

    if (dto.studentIds && dto.studentIds.length > 0) {
      dto.studentIds.forEach((id) => recipientStudentIds.add(id));
    }

    if (recipientStudentIds.size > 0) {
      const recipientEntities = Array.from(recipientStudentIds).map((studentId) =>
        this.recipientRepository.create({
          assignmentId: savedAssignment.id,
          studentId,
        }),
      );
      await this.recipientRepository.save(recipientEntities);
    }

    return {
      ...savedAssignment,
      recipientCount: recipientStudentIds.size,
    };
  }

  async getAssignmentsForUser(user: AuthenticatedUser) {
    return this.assignmentRepository.find({
      where: { assignedBy: user.userId, isActive: true },
      relations: { classroom: true, quiz: true, quizVersion: true },
      order: { createdAt: 'DESC' },
    });
  }

  async isStudentAuthorizedForAttempt(
    studentId: string,
    quizId: string,
    quizVersionId: string,
  ): Promise<boolean> {
    const now = new Date();

    const recipients = await this.recipientRepository.find({
      where: { studentId },
      relations: { assignment: true },
    });

    const validRecipient = recipients.find((r) => {
      const a = r.assignment;
      if (!a || !a.isActive) return false;
      if (a.quizId !== quizId || a.quizVersionId !== quizVersionId) return false;
      if (a.startsAt && new Date(a.startsAt) > now) return false;
      if (a.dueAt && new Date(a.dueAt) < now) return false;
      return true;
    });

    return !!validRecipient;
  }
}
