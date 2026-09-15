import {
  Body,
  Controller,
  Get,
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
import { SaveAnswerDto } from './entities/save-answer.dto.js';

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

  @Post(':quizId/versions/:quizVersionId/attempts')
  startAttempt(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.startAttempt(
      quizId,
      quizVersionId,
      user.userId,
    );
  }

  @Put('attempts/:attemptId/answers/:questionId')
  saveAnswer(
    @Param('attemptId') attemptId: string,
    @Param('questionId') questionId: string,
    @Body() dto: SaveAnswerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.saveAnswer(
      attemptId,
      questionId,
      dto,
      user.userId,
    );
  }

  @Post('attempts/:attemptId/submit')
  submitAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.submitAttempt(
      attemptId,
      user.userId,
    );
  }

  @Get('attempts/:attemptId')
  getAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getAttempt(
      attemptId,
      user.userId,
    );
  }

  @Get('attempts/:attemptId/result')
  getAttemptResult(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getAttemptResult(
      attemptId,
      user.userId,
    );
  }
}