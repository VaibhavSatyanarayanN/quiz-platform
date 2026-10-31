import { Body, Controller, Get, Post } from '@nestjs/common';
import { QuizAssignmentService } from './quiz-assignment.service.js';
import { CreateQuizAssignmentDto } from './dto/create-assignment.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/enums/user-role.enum.js';

@Controller('quiz-assignments')
export class QuizAssignmentController {
  constructor(private readonly assignmentService: QuizAssignmentService) {}

  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @Post()
  createAssignment(
    @Body() dto: CreateQuizAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentService.createAssignment(dto, user);
  }

  @Get()
  getAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.assignmentService.getAssignmentsForUser(user);
  }
}
