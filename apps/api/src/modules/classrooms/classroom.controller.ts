import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ClassroomService } from './classroom.service.js';
import { CreateClassroomDto } from './dto/create-classroom.dto.js';
import { AddClassroomTeacherDto } from './dto/add-classroom-teacher.dto.js';
import { AddClassroomStudentDto } from './dto/add-classroom-student.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/enums/user-role.enum.js';

@Controller('classrooms')
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @Post()
  createClassroom(
    @Body() dto: CreateClassroomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.createClassroom(dto, user);
  }

  @Get()
  getClassrooms(
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.getClassroomsForUser(user, organizationId);
  }

  @Get(':classroomId')
  getClassroomDetails(
    @Param('classroomId') classroomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.getClassroomDetails(classroomId, user);
  }

  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @Post(':classroomId/teachers')
  addTeacher(
    @Param('classroomId') classroomId: string,
    @Body() dto: AddClassroomTeacherDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.addTeacher(classroomId, dto.teacherId, user);
  }

  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @Delete(':classroomId/teachers/:teacherId')
  removeTeacher(
    @Param('classroomId') classroomId: string,
    @Param('teacherId') teacherId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.removeTeacher(classroomId, teacherId, user);
  }

  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @Post(':classroomId/students')
  addStudent(
    @Param('classroomId') classroomId: string,
    @Body() dto: AddClassroomStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.addStudent(classroomId, dto.studentId, user);
  }

  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @Delete(':classroomId/students/:studentId')
  removeStudent(
    @Param('classroomId') classroomId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.removeStudent(classroomId, studentId, user);
  }
}
