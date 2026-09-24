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

@Controller('classrooms')
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

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

  @Post(':classroomId/teachers')
  addTeacher(
    @Param('classroomId') classroomId: string,
    @Body() dto: AddClassroomTeacherDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.addTeacher(classroomId, dto.teacherId, user);
  }

  @Delete(':classroomId/teachers/:teacherId')
  removeTeacher(
    @Param('classroomId') classroomId: string,
    @Param('teacherId') teacherId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.removeTeacher(classroomId, teacherId, user);
  }

  @Post(':classroomId/students')
  addStudent(
    @Param('classroomId') classroomId: string,
    @Body() dto: AddClassroomStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.addStudent(classroomId, dto.studentId, user);
  }

  @Delete(':classroomId/students/:studentId')
  removeStudent(
    @Param('classroomId') classroomId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroomService.removeStudent(classroomId, studentId, user);
  }
}
