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

  @Post(':organizationId/students')
  createOrgStudent(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateOrgStudentDto,
  ) {
    return this.organizationService.createOrgStudent(organizationId, dto);
  }

  @Post(':organizationId/teachers')
  createOrgTeacher(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateOrgTeacherDto,
  ) {
    return this.organizationService.createOrgTeacher(organizationId, dto);
  }
}
