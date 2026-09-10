import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { QuizService } from './quizzes.service.js';
import { CreateQuizDto } from './dto/create-quiz.dto.js';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('quizzes')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
  ) {}

  @Post()
  createQuiz(
    @Body() createQuizDto: CreateQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.createQuiz(
      createQuizDto.title,
      createQuizDto.description ?? null,
      user.userId,
    );
  }
}