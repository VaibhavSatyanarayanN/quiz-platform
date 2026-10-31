import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Classroom } from './entities/classroom.entity.js';
import { ClassroomTeacher } from './entities/classroom-teacher.entity.js';
import { ClassroomStudent } from './entities/classroom-student.entity.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { CreateClassroomDto } from './dto/create-classroom.dto.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { OrganizationRole } from '../organizations/enums/organization-role.enum.js';

@Injectable()
export class ClassroomService {
  constructor(
    @InjectRepository(Classroom)
    private readonly classroomRepository: Repository<Classroom>,

    @InjectRepository(ClassroomTeacher)
    private readonly classroomTeacherRepository: Repository<ClassroomTeacher>,

    @InjectRepository(ClassroomStudent)
    private readonly classroomStudentRepository: Repository<ClassroomStudent>,

    private readonly organizationService: OrganizationService,
  ) {}

  async createClassroom(dto: CreateClassroomDto, user: AuthenticatedUser): Promise<Classroom> {
    const isPlatformAdmin = user.platformRole === 'platform_admin' || user.role === UserRole.ADMIN;
    if (!isPlatformAdmin) {
      const membership = await this.organizationService.getUserMemberships(user.userId);
      const isMember = membership.some((m) => m.organizationId === dto.organizationId);
      if (!isMember) {
        throw new ForbiddenException('You do not belong to this organization');
      }
    }

    const classroom = this.classroomRepository.create({
      organizationId: dto.organizationId,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      createdBy: user.userId,
      isActive: true,
    });

    const saved = await this.classroomRepository.save(classroom);

    // Automatically add creator as a teacher in this classroom
    const teacherRecord = this.classroomTeacherRepository.create({
      classroomId: saved.id,
      teacherId: user.userId,
    });
    await this.classroomTeacherRepository.save(teacherRecord);

    return saved;
  }

  async getClassroomsForUser(user: AuthenticatedUser, organizationId?: string) {
    const query = this.classroomRepository.createQueryBuilder('c')
      .where('c.isActive = :active', { active: true });

    if (organizationId) {
      query.andWhere('c.organizationId = :organizationId', { organizationId });
    }

    const isPlatformAdmin = user.platformRole === 'platform_admin' || user.role === UserRole.ADMIN;
    if (!isPlatformAdmin) {
      const memberships = await this.organizationService.getUserMemberships(user.userId);
      const isOrgAdmin = memberships.some(
        (m) => m.role === OrganizationRole.ADMIN || (m.role as string) === 'admin',
      );

      if (!isOrgAdmin) {
        // Find classrooms where user is a teacher or enrolled student
        query.leftJoin(ClassroomTeacher, 'ct', 'ct.classroomId = c.id')
          .leftJoin(ClassroomStudent, 'cs', 'cs.classroomId = c.id')
          .andWhere('(ct.teacherId = :userId OR (cs.studentId = :userId AND cs.isActive = true))', {
            userId: user.userId,
          });
      }
    }

    const classrooms = await query.orderBy('c.createdAt', 'DESC').getMany();
    return classrooms;
  }

  async getClassroomDetails(classroomId: string, user: AuthenticatedUser) {
    const classroom = await this.classroomRepository.findOne({
      where: { id: classroomId },
      relations: { organization: true },
    });

    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    await this.assertCanViewClassroom(classroom, user);

    const teachers = await this.classroomTeacherRepository.find({
      where: { classroomId },
      relations: { teacher: true },
    });

    const students = await this.classroomStudentRepository.find({
      where: { classroomId, isActive: true },
      relations: { student: true },
    });

    return {
      ...classroom,
      teachers: teachers.map((t) => ({
        id: t.id,
        teacherId: t.teacherId,
        username: t.teacher?.username,
        email: t.teacher?.email,
      })),
      students: students.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        username: s.student?.username,
        email: s.student?.email,
        joinedAt: s.joinedAt,
      })),
    };
  }

  async addTeacher(classroomId: string, teacherId: string, user: AuthenticatedUser) {
    const classroom = await this.classroomRepository.findOne({ where: { id: classroomId } });
    if (!classroom) throw new NotFoundException('Classroom not found');

    await this.assertCanManageClassroom(classroom, user);

    const existing = await this.classroomTeacherRepository.findOne({
      where: { classroomId, teacherId },
    });
    if (existing) throw new ConflictException('Teacher already assigned to classroom');

    const record = this.classroomTeacherRepository.create({ classroomId, teacherId });
    return this.classroomTeacherRepository.save(record);
  }

  async removeTeacher(classroomId: string, teacherId: string, user: AuthenticatedUser) {
    const classroom = await this.classroomRepository.findOne({ where: { id: classroomId } });
    if (!classroom) throw new NotFoundException('Classroom not found');

    await this.assertCanManageClassroom(classroom, user);

    const record = await this.classroomTeacherRepository.findOne({
      where: { classroomId, teacherId },
    });
    if (!record) throw new NotFoundException('Teacher assignment not found');
    await this.classroomTeacherRepository.remove(record);
    return { message: 'Teacher removed from classroom' };
  }

  async addStudent(classroomId: string, studentId: string, user: AuthenticatedUser) {
    const classroom = await this.classroomRepository.findOne({ where: { id: classroomId } });
    if (!classroom) throw new NotFoundException('Classroom not found');

    await this.assertCanManageClassroom(classroom, user);

    const existing = await this.classroomStudentRepository.findOne({
      where: { classroomId, studentId },
    });

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        return this.classroomStudentRepository.save(existing);
      }
      throw new ConflictException('Student already enrolled in classroom');
    }

    const record = this.classroomStudentRepository.create({ classroomId, studentId, isActive: true });
    return this.classroomStudentRepository.save(record);
  }

  async removeStudent(classroomId: string, studentId: string, user: AuthenticatedUser) {
    const classroom = await this.classroomRepository.findOne({ where: { id: classroomId } });
    if (!classroom) throw new NotFoundException('Classroom not found');

    await this.assertCanManageClassroom(classroom, user);

    const record = await this.classroomStudentRepository.findOne({
      where: { classroomId, studentId },
    });
    if (!record) throw new NotFoundException('Student enrollment not found');
    record.isActive = false;
    await this.classroomStudentRepository.save(record);
    return { message: 'Student removed from classroom' };
  }

  private async assertCanManageClassroom(classroom: Classroom, user: AuthenticatedUser): Promise<void> {
    const isPlatformAdmin = user.platformRole === 'platform_admin' || user.role === UserRole.ADMIN;
    if (isPlatformAdmin || classroom.createdBy === user.userId) {
      return;
    }

    const isTeacher = await this.classroomTeacherRepository.findOne({
      where: { classroomId: classroom.id, teacherId: user.userId },
    });
    if (isTeacher) {
      return;
    }

    const memberships = await this.organizationService.getUserMemberships(user.userId);
    const isOrgAdmin = memberships.some(
      (m) =>
        m.organizationId === classroom.organizationId &&
        (m.role === OrganizationRole.ADMIN || (m.role as string) === 'admin'),
    );
    if (isOrgAdmin) {
      return;
    }

    throw new ForbiddenException('You do not have permission to manage this classroom');
  }

  private async assertCanViewClassroom(classroom: Classroom, user: AuthenticatedUser): Promise<void> {
    const isPlatformAdmin = user.platformRole === 'platform_admin' || user.role === UserRole.ADMIN;
    if (isPlatformAdmin || classroom.createdBy === user.userId) {
      return;
    }

    const isTeacher = await this.classroomTeacherRepository.findOne({
      where: { classroomId: classroom.id, teacherId: user.userId },
    });
    if (isTeacher) {
      return;
    }

    const isStudent = await this.classroomStudentRepository.findOne({
      where: { classroomId: classroom.id, studentId: user.userId, isActive: true },
    });
    if (isStudent) {
      return;
    }

    const memberships = await this.organizationService.getUserMemberships(user.userId);
    const isOrgAdmin = memberships.some(
      (m) =>
        m.organizationId === classroom.organizationId &&
        (m.role === OrganizationRole.ADMIN || (m.role as string) === 'admin'),
    );
    if (isOrgAdmin) {
      return;
    }

    throw new ForbiddenException('You do not have permission to access this classroom');
  }
}
