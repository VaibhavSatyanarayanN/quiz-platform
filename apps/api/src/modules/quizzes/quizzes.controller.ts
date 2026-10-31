import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { QuizService } from './quizzes.service.js';
import { QuizGenerationService } from './quiz-generation.service.js';
import { CreateQuizDto } from './dto/create-quiz.dto.js';
import { BulkSaveQuestionsDto } from './dto/bulk-save-questions.dto.js';
import { GenerateQuestionsDto } from './dto/generate-questions.dto.js';
import { GenerateQuestionsFromPdfDto } from './dto/generate-questions-from-pdf.dto.js';
import {
  ApplyGeneratedQuestionsDto,
  UpdateGenerationReviewDto,
} from './dto/generation-review.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { SaveAnswerDto } from './entities/save-answer.dto.js';
import { AttemptHistoryQueryDto } from './dto/attempt-history-query.dto.js';
import { CreatorQuizQueryDto } from './dto/creator-quiz-query.dto.js';
import { PublishedQuizQueryDto } from './dto/published-quiz-list.dto.js';
import { UpdateQuizDto } from './dto/update-quiz.dto.js';
import { UpdateQuizVersionDto } from './dto/update-quiz-version.dto.js';
import { SubmitAttemptDto } from './dto/submit-attempt.dto.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('quizzes')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly quizGenerationService: QuizGenerationService,
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
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
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
      user,
    );
  }

  @Patch(':quizId/versions/:quizVersionId')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  updateQuizVersion(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @Body() dto: UpdateQuizVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.updateQuizVersion(
      quizId,
      quizVersionId,
      user,
      dto,
    );
  }

  @Patch(':quizId/versions/:quizVersionId/publish')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  publishVersion(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.publishVersion(
      quizId,
      quizVersionId,
      user,
    );
  }

  @Post(':quizId/versions')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  createNewVersion(
    @Param('quizId') quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.createNewVersion(
      quizId,
      user,
    );
  }

  @Post([
    ':quizId/versions/:quizVersionId/attempts',
    ':quizId/attempts',
  ])
  startAttempt(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionIdOrUser?: string | AuthenticatedUser,
    @CurrentUser() userOrQuizVersionId?: AuthenticatedUser | string,
  ) {
    let actualVersionId: string | undefined;
    let actualUser: AuthenticatedUser;

    if (typeof quizVersionIdOrUser === 'string') {
      actualVersionId = quizVersionIdOrUser;
      actualUser = userOrQuizVersionId as AuthenticatedUser;
    } else {
      actualVersionId = typeof userOrQuizVersionId === 'string' ? userOrQuizVersionId : undefined;
      actualUser = quizVersionIdOrUser as AuthenticatedUser;
    }

    return this.quizService.startAttempt(
      quizId,
      actualVersionId,
      actualUser,
    );
  }

  @Put([
    'attempts/:attemptId/answers/:questionId',
    'attempts/:attemptId/questions/:questionId/answers',
  ])
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
      user,
    );
  }

  @Post('attempts/:attemptId/questions/:questionId/answers')
  @HttpCode(HttpStatus.OK)
  saveAnswerViaPost(
    @Param('attemptId') attemptId: string,
    @Param('questionId') questionId: string,
    @Body() dto: SaveAnswerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.saveAnswer(
      attemptId,
      questionId,
      dto,
      user,
    );
  }

  @Post('attempts/:attemptId/submit')
  submitAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() _dto?: SubmitAttemptDto,
  ) {
    return this.quizService.submitAttempt(
      attemptId,
      user,
    );
  }

  @Get('attempts/:attemptId')
  getAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getAttempt(
      attemptId,
      user,
    );
  }

  @Get(':quizId/attempts/:attemptId')
  getAttemptForQuiz(
    @Param('quizId') quizId: string,
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getAttempt(
      attemptId,
      user,
      quizId,
    );
  }

  @Get('attempts/:attemptId/result')
  getAttemptResult(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getAttemptResult(
      attemptId,
      user,
    );
  }

  @Get('attempts')
  getMyAttemptHistory(
    @Query() query: AttemptHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getAttemptHistory(
      user.userId,
      query,
    );
  }

  @Get(':quizId/attempts')
  getAttemptHistory(
    @Param('quizId') quizId: string,
    @Query() query: AttemptHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getAttemptHistory(
      user.userId,
      { ...query, quizId },
    );
  }

  @Get()
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  getCreatorQuizzes(
    @Query() query: CreatorQuizQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getCreatorQuizzes(
      user,
      query,
    );
  }

  @Get('published')
  getPublishedQuizzes(
    @Query() query: PublishedQuizQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.quizService.getPublishedQuizzes(query, user);
  }

  @Get(':quizId')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  getCreatorQuizDetails(
    @Param('quizId') quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getCreatorQuizDetails(
      quizId,
      user,
    );
  }

  @Patch(':quizId')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  updateQuiz(
    @Param('quizId') quizId: string,
    @Body() dto: UpdateQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.updateQuiz(
      quizId,
      user,
      dto,
    );
  }

  @Patch(
    ':quizId/versions/:quizVersionId/discard',
  )
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  discardVersion(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.discardVersion(
      quizId,
      quizVersionId,
      user,
    );
  }

  @Get(':quizId/published')
  getLatestPublishedQuizVersion(
    @Param('quizId') quizId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.quizService.getLatestPublishedQuizVersion(quizId, user);
  }

  @Get(
    ':quizId/versions/:quizVersionId',
  )
  getPublishedQuizVersion(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.quizService.getPublishedQuizVersion(
      quizId,
      quizVersionId,
      user,
    );
  }

  @Get([
    ':quizId/analytics',
    ':quizId/versions/:quizVersionId/analytics',
  ])
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  getQuizAnalytics(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') pathVersionId: string | undefined,
    @Query('versionId') queryVersionId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const versionId = pathVersionId || queryVersionId;
    return this.quizService.getQuizAnalytics(
      quizId,
      versionId,
      user,
    );
  }

  @Post(':quizId/versions/:quizVersionId/ai-generate')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  generateQuestions(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @Body() dto: GenerateQuestionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.createGeneration(
      quizId,
      quizVersionId,
      dto,
      user,
    );
  }

  @Post(':quizId/versions/:quizVersionId/ai-generate-from-pdf')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
        files: 1,
      },
      fileFilter: (_request, file, callback) => {
        const originalName = file.originalname || '';
        const hasPdfExtension = /\.pdf$/i.test(originalName);
        const validMimeType =
          !file.mimetype ||
          file.mimetype === 'application/pdf' ||
          file.mimetype === 'application/octet-stream';

        if (!hasPdfExtension || !validMimeType) {
          return callback(
            new BadRequestException(
              'Please upload a valid PDF file with a .pdf extension.',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  generateQuestionsFromPdf(
    @Param('quizId') quizId: string,
    @Param('quizVersionId') quizVersionId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: GenerateQuestionsFromPdfDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.createGenerationFromPdf(
      quizId,
      quizVersionId,
      file,
      dto,
      user,
    );
  }

  @Get([
    ':quizId/ai-generations/:generationId/status',
    ':quizId/ai-generations/:generationId',
  ])
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  getGenerationStatus(
    @Param('quizId') quizId: string,
    @Param('generationId') generationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.getGenerationStatus(
      quizId,
      generationId,
      user,
    );
  }

  @Patch(':quizId/ai-generations/:generationId/cancel')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  cancelGeneration(
    @Param('quizId') quizId: string,
    @Param('generationId') generationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.cancelGeneration(
      quizId,
      generationId,
      user,
    );
  }

  @Post(':quizId/ai-generations/:generationId/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  cancelGenerationViaPost(
    @Param('quizId') quizId: string,
    @Param('generationId') generationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.cancelGeneration(
      quizId,
      generationId,
      user,
    );
  }

  @Get(':quizId/ai-generations')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  listGenerations(
    @Param('quizId') quizId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.listGenerations(
      quizId,
      user,
    );
  }

  @Get(':quizId/ai-generations/:generationId/review')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  getGenerationForReview(
    @Param('quizId') quizId: string,
    @Param('generationId') generationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.getGenerationForReview(
      quizId,
      generationId,
      user,
    );
  }

  @Put(':quizId/ai-generations/:generationId/review')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  saveReviewDraft(
    @Param('quizId') quizId: string,
    @Param('generationId') generationId: string,
    @Body() dto: UpdateGenerationReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.saveReviewDraft(
      quizId,
      generationId,
      dto,
      user,
    );
  }

  @Patch(':quizId/ai-generations/:generationId/review')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  saveReviewDraftViaPatch(
    @Param('quizId') quizId: string,
    @Param('generationId') generationId: string,
    @Body() dto: UpdateGenerationReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.saveReviewDraft(
      quizId,
      generationId,
      dto,
      user,
    );
  }

  @Post(':quizId/ai-generations/:generationId/reset-review')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  resetReviewDraft(
    @Param('quizId') quizId: string,
    @Param('generationId') generationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.resetReviewDraftToOriginal(
      quizId,
      generationId,
      user,
    );
  }

  @Post(':quizId/ai-generations/:generationId/apply')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  applyGeneratedQuestions(
    @Param('quizId') quizId: string,
    @Param('generationId') generationId: string,
    @Body() dto: ApplyGeneratedQuestionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizGenerationService.applyGeneratedQuestions(
      quizId,
      generationId,
      dto,
      user,
    );
  }
}
