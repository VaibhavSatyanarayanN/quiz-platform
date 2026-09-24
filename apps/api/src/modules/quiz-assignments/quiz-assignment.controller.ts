import { Body, Controller, Get, Post } from '@nestjs/common';
import { QuizAssignmentService } from './quiz-assignment.service.js';
import { CreateQuizAssignmentDto } from './dto/create-assignment.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('quiz-assignments')
export class QuizAssignmentController {
  constructor(private readonly assignmentService: QuizAssignmentService) {}

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
