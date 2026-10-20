import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import FormData from 'form-data';

import type {
  GenerateFromPdfDto,
  GenerateQuizDto,
} from './dto/generate-quiz.dto.js';
import type { AuthenticatedUser } from '../modules/auth/types/authenticated-user.type.js';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const rawUrl =
      this.configService.get<string>('AI_SERVICE_URL') ??
      'http://127.0.0.1:8000';
    this.baseUrl = this.validateAndNormalizeUrl(rawUrl);

    const timeoutConfig = Number(
      this.configService.get<string | number>('AI_SERVICE_TIMEOUT_MS') ?? 180000,
    );
    if (!Number.isFinite(timeoutConfig) || timeoutConfig <= 0) {
      throw new Error('AI_SERVICE_TIMEOUT_MS must be a positive finite number.');
    }
    this.timeoutMs = timeoutConfig;

    this.logger.log(
      `AiService initialized. Target: ${this.baseUrl}, Timeout: ${this.timeoutMs}ms`,
    );
  }

  private validateAndNormalizeUrl(rawUrl: string): string {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(
        `AI_SERVICE_URL is invalid: "${rawUrl}". Must be a valid absolute URL.`,
      );
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(
        `AI_SERVICE_URL protocol must be http: or https:, got "${parsed.protocol}"`,
      );
    }

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'ai'; // Docker internal service name

    if (isProduction && parsed.protocol === 'http:' && !isLocalhost) {
      throw new Error(
        'Insecure HTTP AI_SERVICE_URL is not allowed in production unless host is localhost or internal container.',
      );
    }

    return rawUrl.replace(/\/+$/, '');
  }

  private serializeJsonField(value: unknown, fallback: unknown): string {
    if (value === undefined || value === null || value === '') {
      return JSON.stringify(fallback);
    }

    if (typeof value === 'string') {
      try {
        JSON.parse(value);
        return value;
      } catch {
        return JSON.stringify(fallback);
      }
    }

    return JSON.stringify(value);
  }

  async generateQuiz(
    request: GenerateQuizDto,
    user?: AuthenticatedUser,
    correlationId?: string,
  ): Promise<unknown> {
    const requestId = correlationId || randomUUID();
    const startTime = Date.now();

    this.logger.log({
      message: 'AI quiz generation initiated',
      requestId,
      action: 'generateQuiz',
      userId: user?.userId ?? 'anonymous',
      questionCount: request.question_count,
      topicLength: request.topic?.length,
      hasSourceText: Boolean(request.source_text),
    });

    try {
      const response = await this.httpService.axiosRef.post(
        `${this.baseUrl}/generate`,
        request,
        {
          timeout: this.timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
          },
        },
      );

      const durationMs = Date.now() - startTime;
      this.logger.log({
        message: 'AI quiz generation completed successfully',
        requestId,
        action: 'generateQuiz',
        durationMs,
        status: 'success',
      });

      return response.data;
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      this.handleUpstreamError(error, requestId, durationMs, 'generateQuiz');
    }
  }

  async generateQuizFromPdf(
    file: Express.Multer.File,
    options: GenerateFromPdfDto,
    user?: AuthenticatedUser,
    correlationId?: string,
  ): Promise<unknown> {
    const requestId = correlationId || randomUUID();
    const startTime = Date.now();

    this.logger.log({
      message: 'AI PDF quiz generation initiated',
      requestId,
      action: 'generateQuizFromPdf',
      userId: user?.userId ?? 'anonymous',
      filename: file.originalname,
      fileSize: file.size,
      questionCount: options.question_count,
    });

    const form = new FormData();

    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: 'application/pdf',
    });

    form.append('question_count', String(options.question_count ?? 10));
    form.append(
      'question_types',
      this.serializeJsonField(options.question_types, ['mcq']),
    );
    form.append(
      'difficulty_distribution',
      this.serializeJsonField(options.difficulty_distribution, {
        easy: 3,
        medium: 5,
        hard: 2,
      }),
    );
    form.append(
      'target_audience',
      options.target_audience ?? 'General learners',
    );
    form.append('language', options.language ?? 'English');
    form.append(
      'max_revision_attempts',
      String(options.max_revision_attempts ?? 1),
    );

    try {
      const response = await this.httpService.axiosRef.post(
        `${this.baseUrl}/generate-from-pdf`,
        form,
        {
          timeout: this.timeoutMs,
          headers: {
            ...form.getHeaders(),
            'X-Request-Id': requestId,
          },
          // 15 MB to account for multipart overhead with a 10 MB payload limit
          maxBodyLength: 15 * 1024 * 1024,
          maxContentLength: 15 * 1024 * 1024,
        },
      );

      const durationMs = Date.now() - startTime;
      this.logger.log({
        message: 'AI PDF quiz generation completed successfully',
        requestId,
        action: 'generateQuizFromPdf',
        durationMs,
        status: 'success',
      });

      return response.data;
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      this.handleUpstreamError(
        error,
        requestId,
        durationMs,
        'generateQuizFromPdf',
      );
    }
  }

  private handleUpstreamError(
    error: unknown,
    requestId: string,
    durationMs: number,
    action: string,
  ): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const responseData = error.response?.data as
        | { detail?: unknown }
        | undefined;

      this.logger.error({
        message: 'AI upstream service error',
        requestId,
        action,
        durationMs,
        status,
        errorCode: error.code,
        errorMessage: error.message,
      });

      // 1. Upstream 400 Bad Request or 422 Unprocessable Entity
      if (status === HttpStatus.BAD_REQUEST || status === HttpStatus.UNPROCESSABLE_ENTITY) {
        let sanitizedMessage =
          'The AI service rejected the generation request due to invalid parameters.';

        if (typeof responseData?.detail === 'string') {
          // Exclude internal file paths or tracebacks from the detail string
          sanitizedMessage = responseData.detail
            .replace(/\/[^ ]+\/[^ ]+/g, '[internal path]')
            .slice(0, 300);
        } else if (Array.isArray(responseData?.detail)) {
          // Pydantic validation error list - summarize field issues without raw paths
          const fields = responseData.detail
            .map((err: { loc?: unknown[]; msg?: string }) => {
              const field = Array.isArray(err.loc) ? err.loc.join('.') : 'field';
              return `${field}: ${err.msg || 'invalid value'}`;
            })
            .join('; ');
          sanitizedMessage = `Validation error in AI service: ${fields}`;
        }

        throw new HttpException(
          {
            statusCode: status,
            message: sanitizedMessage,
            error:
              status === HttpStatus.BAD_REQUEST
                ? 'Bad Request'
                : 'Unprocessable Entity',
          },
          status,
        );
      }

      // 2. Upstream 401 Unauthorized or 403 Forbidden
      // This is an internal configuration/service-token issue; do not pass 401 to client
      if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
        throw new BadGatewayException(
          'AI service upstream authentication or authorization failed.',
        );
      }

      // 3. Upstream 429 Too Many Requests (upstream quota/capacity exceeded)
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'The AI service is temporarily experiencing high load. Please try again later.',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 4. Timeout (client aborted, socket timeout, or 504)
      if (
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        status === HttpStatus.GATEWAY_TIMEOUT
      ) {
        throw new GatewayTimeoutException(
          'The AI service timed out while generating the quiz.',
        );
      }

      // 5. Connection refused or service offline (503, ECONNREFUSED, ENOTFOUND)
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'EHOSTUNREACH' ||
        status === HttpStatus.SERVICE_UNAVAILABLE
      ) {
        throw new ServiceUnavailableException(
          'The AI service is currently unavailable.',
        );
      }

      // 6. Upstream 500 or 502
      if (status && status >= 500) {
        throw new BadGatewayException(
          'The AI service encountered an upstream processing error.',
        );
      }
    }

    this.logger.error({
      message: 'Unexpected internal error in AiService',
      requestId,
      action,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new InternalServerErrorException(
      'An unexpected error occurred while communicating with the AI service.',
    );
  }
}
