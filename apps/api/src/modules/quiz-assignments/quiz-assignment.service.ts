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
    });

    if (!version) {
      throw new NotFoundException('Quiz version not found');
    }

    if (version.status !== QuizVersionStatus.PUBLISHED) {
      throw new BadRequestException('Assignments must reference a published quiz version');
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
