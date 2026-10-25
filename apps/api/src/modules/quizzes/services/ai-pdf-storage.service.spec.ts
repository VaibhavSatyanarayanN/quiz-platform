import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigService } from '@nestjs/config';

import { AiPdfStorageService } from './ai-pdf-storage.service.js';

describe('AiPdfStorageService', () => {
  let service: AiPdfStorageService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `ai-test-${Date.now()}`);
    const mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'AI_PDF_STORAGE_DIR') return tempDir;
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new AiPdfStorageService(mockConfigService);
  });

  afterEach(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it('should save uploaded PDF to disk and verify existence', async () => {
    const mockFile = {
      buffer: Buffer.from('%PDF-1.4 test content'),
      originalname: 'document.pdf',
      size: 21,
    } as Express.Multer.File;

    const savedPath = await service.saveUploadedPdf('gen-uuid-1', mockFile);
    expect(savedPath).toContain('gen-uuid-1.pdf');
    expect(await service.exists(savedPath)).toBe(true);

    const buffer = await service.readPdfFile(savedPath);
    expect(buffer.toString('ascii')).toBe('%PDF-1.4 test content');
  });

  it('should safely delete PDF file after use', async () => {
    const mockFile = {
      buffer: Buffer.from('%PDF-1.4 test content'),
      originalname: 'document.pdf',
      size: 21,
    } as Express.Multer.File;

    const savedPath = await service.saveUploadedPdf('gen-uuid-2', mockFile);
    expect(await service.exists(savedPath)).toBe(true);

    await service.deletePdfFile(savedPath);
    expect(await service.exists(savedPath)).toBe(false);

    // Deleting already deleted file should not throw
    await expect(service.deletePdfFile(savedPath)).resolves.not.toThrow();
  });
});
