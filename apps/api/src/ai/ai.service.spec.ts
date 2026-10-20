import 'reflect-metadata';
import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';

import { AiService } from './ai.service.js';
import { GenerateQuizDto } from './dto/generate-quiz.dto.js';

describe('AiService', () => {
  let service: AiService;
  let mockHttpService: {
    axiosRef: {
      post: ReturnType<typeof vi.fn>;
    };
  };
  let mockConfigService: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockHttpService = {
      axiosRef: {
        post: vi.fn(),
      },
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'AI_SERVICE_URL') return 'http://127.0.0.1:8000';
        if (key === 'AI_SERVICE_TIMEOUT_MS') return 180000;
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };

    service = new AiService(
      mockHttpService as unknown as HttpService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('Initialization and Configuration Validation', () => {
    it('should throw if AI_SERVICE_URL is invalid', () => {
      const invalidConfig = {
        get: vi.fn((key: string) => {
          if (key === 'AI_SERVICE_URL') return 'not-a-valid-url';
          if (key === 'AI_SERVICE_TIMEOUT_MS') return 180000;
          return undefined;
        }),
      };

      expect(
        () =>
          new AiService(
            mockHttpService as unknown as HttpService,
            invalidConfig as unknown as ConfigService,
          ),
      ).toThrow(/AI_SERVICE_URL is invalid/);
    });

    it('should throw if AI_SERVICE_URL is insecure in production for non-localhost', () => {
      const prodConfig = {
        get: vi.fn((key: string) => {
          if (key === 'AI_SERVICE_URL') return 'http://external-ai-service.com';
          if (key === 'AI_SERVICE_TIMEOUT_MS') return 180000;
          if (key === 'NODE_ENV') return 'production';
          return undefined;
        }),
      };

      expect(
        () =>
          new AiService(
            mockHttpService as unknown as HttpService,
            prodConfig as unknown as ConfigService,
          ),
      ).toThrow(/Insecure HTTP AI_SERVICE_URL is not allowed in production/);
    });

    it('should throw if AI_SERVICE_TIMEOUT_MS is negative or zero', () => {
      const invalidTimeoutConfig = {
        get: vi.fn((key: string) => {
          if (key === 'AI_SERVICE_URL') return 'http://127.0.0.1:8000';
          if (key === 'AI_SERVICE_TIMEOUT_MS') return -5;
          return undefined;
        }),
      };

      expect(
        () =>
          new AiService(
            mockHttpService as unknown as HttpService,
            invalidTimeoutConfig as unknown as ConfigService,
          ),
      ).toThrow(/AI_SERVICE_TIMEOUT_MS must be a positive finite number/);
    });
  });

  describe('generateQuiz', () => {
    it('should return data when upstream succeeds', async () => {
      const mockResult = {
        status: 'completed',
        question_set: { questions: [] },
      };
      mockHttpService.axiosRef.post.mockResolvedValueOnce({ data: mockResult });

      const request: GenerateQuizDto = {
        topic: 'TypeScript Generics',
        question_count: 5,
        question_types: [] as any,
        difficulty_distribution: {} as any,
        target_audience: 'Engineers',
        language: 'English',
        max_revision_attempts: 1,
      };

      const result = await service.generateQuiz(request);
      expect(result).toEqual(mockResult);
      expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/generate',
        request,
        expect.objectContaining({
          timeout: 180000,
        }),
      );
    });

    it('should map timeout (ECONNABORTED) to GatewayTimeoutException (504)', async () => {
      const axiosError = new AxiosError('timeout of 180000ms exceeded');
      axiosError.code = 'ECONNABORTED';
      mockHttpService.axiosRef.post.mockRejectedValueOnce(axiosError);

      await expect(
        service.generateQuiz({ topic: 'Python' } as any),
      ).rejects.toThrow(GatewayTimeoutException);
    });

    it('should map connection refused (ECONNREFUSED) to ServiceUnavailableException (503)', async () => {
      const axiosError = new AxiosError('connect ECONNREFUSED 127.0.0.1:8000');
      axiosError.code = 'ECONNREFUSED';
      mockHttpService.axiosRef.post.mockRejectedValueOnce(axiosError);

      await expect(
        service.generateQuiz({ topic: 'Python' } as any),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should map upstream 401/403 to BadGatewayException (502), not 401', async () => {
      const axiosError = new AxiosError('Unauthorized');
      axiosError.response = {
        status: 401,
        data: { detail: 'Invalid upstream API key' },
      } as any;
      mockHttpService.axiosRef.post.mockRejectedValueOnce(axiosError);

      await expect(
        service.generateQuiz({ topic: 'Python' } as any),
      ).rejects.toThrow(BadGatewayException);
    });

    it('should map upstream 429 to 429 HttpException', async () => {
      const axiosError = new AxiosError('Too Many Requests');
      axiosError.response = {
        status: 429,
        data: { detail: 'Rate limit exceeded' },
      } as any;
      mockHttpService.axiosRef.post.mockRejectedValueOnce(axiosError);

      try {
        await service.generateQuiz({ topic: 'Python' } as any);
        expect.fail('Should have thrown 429');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should map upstream 422 with sanitized detail string without system paths', async () => {
      const axiosError = new AxiosError('Unprocessable Entity');
      axiosError.response = {
        status: 422,
        data: {
          detail: 'Validation error in /home/app/user/models.py: invalid question_count',
        },
      } as any;
      mockHttpService.axiosRef.post.mockRejectedValueOnce(axiosError);

      try {
        await service.generateQuiz({ topic: 'Python' } as any);
        expect.fail('Should have thrown 422');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const res = err.getResponse();
        expect(res.message).not.toContain('/home/app/user');
        expect(res.message).toContain('[internal path]');
      }
    });

    it('should map upstream 500 to BadGatewayException (502)', async () => {
      const axiosError = new AxiosError('Internal Server Error');
      axiosError.response = {
        status: 500,
        data: { detail: 'Python traceback ...' },
      } as any;
      mockHttpService.axiosRef.post.mockRejectedValueOnce(axiosError);

      await expect(
        service.generateQuiz({ topic: 'Python' } as any),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('generateQuizFromPdf', () => {
    it('should forward multipart form data to /generate-from-pdf', async () => {
      const mockResult = { status: 'completed' };
      mockHttpService.axiosRef.post.mockResolvedValueOnce({ data: mockResult });

      const mockFile = {
        buffer: Buffer.from('%PDF-1.4 test content'),
        originalname: 'test.pdf',
        size: 21,
      } as Express.Multer.File;

      const result = await service.generateQuizFromPdf(mockFile, {
        question_count: 10,
      } as any);

      expect(result).toEqual(mockResult);
      expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/generate-from-pdf',
        expect.any(Object),
        expect.objectContaining({
          timeout: 180000,
          maxBodyLength: 15 * 1024 * 1024,
        }),
      );
    });
  });
});
