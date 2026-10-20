import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { ROLES_KEY } from '../modules/auth/decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../modules/auth/decorators/public.decorator.js';
import { UserRole } from '../modules/users/enums/user-role.enum.js';
import type { AuthenticatedUser } from '../modules/auth/types/authenticated-user.type.js';

describe('AiController', () => {
  let controller: AiController;
  let mockAiService: {
    generateQuiz: ReturnType<typeof vi.fn>;
    generateQuizFromPdf: ReturnType<typeof vi.fn>;
  };
  const reflector = new Reflector();

  const mockUser: AuthenticatedUser = {
    userId: 'user-123',
    email: 'creator@example.com',
    role: UserRole.CREATOR,
  };

  beforeEach(() => {
    mockAiService = {
      generateQuiz: vi.fn(),
      generateQuizFromPdf: vi.fn(),
    };

    controller = new AiController(mockAiService as unknown as AiService);
  });

  describe('Security and Route Metadata', () => {
    it('should NOT have @Public() metadata on generate or generateFromPdf (auth required)', () => {
      const isGeneratePublic = reflector.get(
        IS_PUBLIC_KEY,
        controller.generate,
      );
      const isGenerateFromPdfPublic = reflector.get(
        IS_PUBLIC_KEY,
        controller.generateFromPdf,
      );

      expect(isGeneratePublic).toBeUndefined();
      expect(isGenerateFromPdfPublic).toBeUndefined();
    });

    it('should enforce @Roles(CREATOR, ADMIN) on both endpoints', () => {
      const generateRoles = reflector.get(ROLES_KEY, controller.generate);
      const pdfRoles = reflector.get(ROLES_KEY, controller.generateFromPdf);

      expect(generateRoles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
      expect(pdfRoles).toEqual([UserRole.CREATOR, UserRole.ADMIN]);
    });
  });

  describe('generate', () => {
    it('should forward request to AiService.generateQuiz with user and correlationId', async () => {
      const body = {
        topic: 'Python Asyncio',
        question_count: 5,
        question_types: [] as any,
        difficulty_distribution: {} as any,
        target_audience: 'Engineers',
        language: 'English',
        max_revision_attempts: 1,
      };
      mockAiService.generateQuiz.mockResolvedValueOnce({ status: 'completed' });

      const result = await controller.generate(body, mockUser, 'req-abc');
      expect(result).toEqual({ status: 'completed' });
      expect(mockAiService.generateQuiz).toHaveBeenCalledWith(
        body,
        mockUser,
        'req-abc',
      );
    });
  });

  describe('generateFromPdf', () => {
    const validBody = {
      question_count: 5,
      question_types: [] as any,
      difficulty_distribution: {} as any,
      target_audience: 'Engineers',
      language: 'English',
      max_revision_attempts: 1,
    };

    it('should throw BadRequestException if file is missing', async () => {
      await expect(
        controller.generateFromPdf(undefined, validBody, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file buffer is empty', async () => {
      const file = {
        buffer: Buffer.alloc(0),
        originalname: 'empty.pdf',
        size: 0,
      } as Express.Multer.File;

      await expect(
        controller.generateFromPdf(file, validBody, mockUser),
      ).rejects.toThrow('The uploaded PDF file is empty.');
    });

    it('should throw BadRequestException if file buffer is less than 5 bytes', async () => {
      const file = {
        buffer: Buffer.from('%PD'),
        originalname: 'short.pdf',
        size: 3,
      } as Express.Multer.File;

      await expect(
        controller.generateFromPdf(file, validBody, mockUser),
      ).rejects.toThrow('The uploaded file is not a valid PDF.');
    });

    it('should throw BadRequestException if magic bytes are not %PDF-', async () => {
      const file = {
        buffer: Buffer.from('NOTAPDF_HEADER_EXTRA_BYTES'),
        originalname: 'fake.pdf',
        size: 26,
      } as Express.Multer.File;

      await expect(
        controller.generateFromPdf(file, validBody, mockUser),
      ).rejects.toThrow('The uploaded file is not a valid PDF (invalid signature).');
    });

    it('should forward to AiService if PDF magic bytes are %PDF-', async () => {
      const file = {
        buffer: Buffer.from('%PDF-1.7 actual content here'),
        originalname: 'document.pdf',
        size: 28,
      } as Express.Multer.File;
      mockAiService.generateQuizFromPdf.mockResolvedValueOnce({
        status: 'completed',
      });

      const result = await controller.generateFromPdf(
        file,
        validBody,
        mockUser,
        'req-xyz',
      );
      expect(result).toEqual({ status: 'completed' });
      expect(mockAiService.generateQuizFromPdf).toHaveBeenCalledWith(
        file,
        validBody,
        mockUser,
        'req-xyz',
      );
    });
  });
});
