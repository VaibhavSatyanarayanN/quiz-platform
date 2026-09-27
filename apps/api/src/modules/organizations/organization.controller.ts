import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrganizationService } from './organization.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { CreateOrgStudentDto } from './dto/create-student.dto.js';
import { CreateOrgTeacherDto } from './dto/create-teacher.dto.js';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get(':organizationId/analytics')
  getOrganizationAnalytics(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.getOrganizationAnalytics(organizationId, user);
  }

  @Get(':organizationId/students')
  getOrganizationStudents(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.getOrganizationStudents(organizationId, user);
  }

  @Get(':organizationId/creators')
  getOrganizationCreators(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.getOrganizationCreators(organizationId, user);
  }

  @Post(':organizationId/students')
  createOrgStudent(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateOrgStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.createOrgStudent(organizationId, dto, user);
  }

  @Post(':organizationId/teachers')
  createOrgTeacher(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateOrgTeacherDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.createOrgTeacher(organizationId, dto, user);
  }
}
