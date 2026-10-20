import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isMulterError =
      (exception instanceof Error && exception.name === 'MulterError') ||
      (typeof exception === 'object' &&
        exception !== null &&
        (exception as { name?: string }).name === 'MulterError');

    if (isMulterError) {
      const multerErr = exception as { code?: string; message?: string };
      this.logger.warn(`Multer upload error: ${multerErr.code} - ${multerErr.message}`);

      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: 'The uploaded file exceeds the 10 MB limit.',
          error: 'Payload Too Large',
        });
        return;
      }

      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: multerErr.message || 'File upload error.',
        error: 'Bad Request',
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      response.status(status).json(
        typeof res === 'object' && res !== null
          ? res
          : { statusCode: status, message: res },
      );
      return;
    }

    this.logger.error('Unhandled exception in AI endpoint', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error.',
      error: 'Internal Server Error',
    });
  }
}
