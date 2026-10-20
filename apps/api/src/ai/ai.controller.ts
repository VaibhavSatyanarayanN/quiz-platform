
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AiService } from './ai.service.js';
import type {
  GenerateFromPdfDto,
  GenerateQuizDto,
} from './dto/generate-quiz.dto.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) { }

  @Post('generate')
  @Public()
  @HttpCode(HttpStatus.OK)
  async generate(@Body() body: GenerateQuizDto) {
    return this.aiService.generateQuiz(body);
  }

  @Post('generate-from-pdf')
  @HttpCode(HttpStatus.OK)
  @Public()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PDF_BYTES },
      fileFilter: (_request, file, callback) => {
        const hasPdfExtension = /\.pdf$/i.test(file.originalname);
        const validMimeType =
          !file.mimetype ||
          file.mimetype === 'application/pdf' ||
          file.mimetype === 'application/octet-stream';

        if (!hasPdfExtension || !validMimeType) {
          return callback(
            new BadRequestException('Please upload a PDF file.'),
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
  ) {
    if (!file) {
      throw new BadRequestException('A PDF file is required.');
    }

    // Check the actual file signature, not just its filename or MIME type.
    const pdfSignature = file.buffer.subarray(0, 5).toString('ascii');

    if (pdfSignature !== '%PDF-') {
      throw new BadRequestException('The uploaded file is not a valid PDF.');
    }

    return this.aiService.generateQuizFromPdf(file, body);
  }
}
