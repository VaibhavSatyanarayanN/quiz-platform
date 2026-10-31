import { Controller, Get } from '@nestjs/common';
import { StudentDashboardService } from './student-dashboard.service.js';
import { TeacherDashboardService } from './teacher-dashboard.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/enums/user-role.enum.js';

@Controller()
export class DashboardController {
  constructor(
    private readonly studentDashboardService: StudentDashboardService,
    private readonly teacherDashboardService: TeacherDashboardService,
  ) {}

  @Get('student/dashboard')
  getStudentDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.studentDashboardService.getStudentDashboard(user.userId);
  }

  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @Get('teacher/dashboard')
  getTeacherDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.teacherDashboardService.getTeacherDashboard(user);
  }
}
