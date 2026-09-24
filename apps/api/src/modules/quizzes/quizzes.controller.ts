import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { QuizService } from './quizzes.service.js';
import { CreateQuizDto } from './dto/create-quiz.dto.js';
import { BulkSaveQuestionsDto } from './dto/bulk-save-questions.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { SaveAnswerDto } from './entities/save-answer.dto.js';
import { AttemptHistoryQueryDto } from './dto/attempt-history-query.dto.js';
import { UpdateQuizDto } from './dto/update-quiz.dto.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('quizzes')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
  ) { }

  @Post()
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  createQuiz(
    @Body() dto: CreateQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.createQuiz(
      dto.title,
      dto.description ?? null,
      dto.timeLimitSeconds ?? null,
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

  @Get(':quizId/attempts')
  getAttemptHistory(
    @Param('quizId') quizId: string,
    @Query() query: AttemptHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getAttemptHistory(
      quizId,
      user.userId,
      query,
    );
  }

  @Get()
  getCreatorQuizzes(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getCreatorQuizzes(
      user.userId,
    );
  }

  @Get(':quizId')
  getCreatorQuizDetails(
    @Param('quizId') quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getCreatorQuizDetails(
      quizId,
      user.userId,
    );
  }

  @Patch(':quizId')
  updateQuiz(
    @Param('quizId') quizId: string,
    @Body() dto: UpdateQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.updateQuiz(
      quizId,
      user.userId,
      dto,
    );
  }

  @Patch(
    ':quizId/versions/:quizVersionId/discard',
  )
  discardVersion(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.discardVersion(
      quizId,
      quizVersionId,
      user.userId,
    );
  }

  @Get(
    ':quizId/versions/:quizVersionId',
  )
  getPublishedQuizVersion(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
  ) {
    return this.quizService.getPublishedQuizVersion(
      quizId,
      quizVersionId,
    );
  }

  @Get(':quizId/analytics')
  getQuizAnalytics(
    @Param('quizId') quizId: string,
    @Query('versionId') versionId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getQuizAnalytics(
      quizId,
      versionId,
      user,
    );
  }
}