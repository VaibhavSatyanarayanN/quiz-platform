import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AiService } from './ai.service.js';
import {
  GenerateFromPdfDto,
  GenerateQuizDto,
} from './dto/generate-quiz.dto.js';
import { Roles } from '../modules/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../modules/auth/decorators/current-user.decorator.js';
import { UserRole } from '../modules/users/enums/user-role.enum.js';
import type { AuthenticatedUser } from '../modules/auth/types/authenticated-user.type.js';
import { AiThrottlerGuard } from './guards/ai-throttler.guard.js';
import { MulterExceptionFilter } from './filters/multer-exception.filter.js';

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

@Controller('ai')
@UseGuards(AiThrottlerGuard)
@UseFilters(MulterExceptionFilter)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body() body: GenerateQuizDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-request-id') correlationId?: string,
  ) {
    return this.aiService.generateQuiz(body, user, correlationId);
  }

  @Post('generate-from-pdf')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_PDF_BYTES,
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
  async generateFromPdf(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: GenerateFromPdfDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-request-id') correlationId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('A PDF file is required.');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('The uploaded PDF file is empty.');
    }

    if (file.buffer.length < 5) {
      throw new BadRequestException('The uploaded file is not a valid PDF.');
    }

    // Verify PDF magic bytes '%PDF-'
    const pdfSignature = file.buffer.subarray(0, 5).toString('ascii');
    if (pdfSignature !== '%PDF-') {
      throw new BadRequestException(
        'The uploaded file is not a valid PDF (invalid signature).',
      );
    }

    return this.aiService.generateQuizFromPdf(file, body, user, correlationId);
  }
}
