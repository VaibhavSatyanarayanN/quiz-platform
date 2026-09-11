import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';

import { QuizService } from './quizzes.service.js';
import { CreateQuizDto } from './dto/create-quiz.dto.js';
import { BulkSaveQuestionsDto } from './dto/bulk-save-questions.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('quizzes')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
  ) { }

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

  @Put(':quizId/versions/:quizVersionId/questions/bulk')
  createQuestionsBulk(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @Body() dto: BulkSaveQuestionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.saveQuestionsBulk(
      quizId,
      quizVersionId,
      dto,
      user.userId,
    );
  }

  @Patch(':quizId/versions/:quizVersionId/publish')
  publishVersion(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.publishVersion(
      quizId,
      quizVersionId,
      user.userId,
    );
  }

  @Post(':quizId/versions')
  createNewVersion(
    @Param('quizId') quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.createNewVersion(
      quizId,
      user.userId,
    );
  }
}