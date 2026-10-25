import fs from 'node:fs';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service for managing temporary source PDF uploads during asynchronous AI generation.
 *
 * NOTE ON MULTI-INSTANCE DURABILITY:
 * This implementation uses the local filesystem for single-instance / development setups.
 * In a distributed, multi-pod Kubernetes or clustered deployment, workers running on separate
 * nodes will not share the local filesystem. For production multi-instance setups, this service
 * should be backed by shared storage (such as AWS S3, Google Cloud Storage, or an NFS/EFS mount).
 */
@Injectable()
export class AiPdfStorageService {
  private readonly logger = new Logger(AiPdfStorageService.name);
  private readonly storageDir: string;

  constructor(private readonly configService: ConfigService) {
    const configuredDir = this.configService.get<string>('AI_PDF_STORAGE_DIR');
    this.storageDir = configuredDir
      ? path.resolve(configuredDir)
      : path.resolve(process.cwd(), 'uploads', 'ai-source-pdfs');

    this.ensureStorageDirExists();
  }

  private ensureStorageDirExists(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.logger.log(`Initialized PDF storage directory at: ${this.storageDir}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create PDF storage directory: ${this.storageDir}`, error);
    }
  }

  async saveUploadedPdf(
    generationId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    this.ensureStorageDirExists();

    // Sanitized, deterministic filename based on the unique generation UUID
    const sanitizedFilename = `${generationId}.pdf`;
    const destinationPath = path.join(this.storageDir, sanitizedFilename);

    await fs.promises.writeFile(destinationPath, file.buffer);
    this.logger.log(
      `Saved source PDF for generation [${generationId}] to ${destinationPath} (${file.size} bytes)`,
    );

    return destinationPath;
  }

  async readPdfFile(filePath: string): Promise<Buffer> {
    return fs.promises.readFile(filePath);
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async deletePdfFile(filePath: string): Promise<void> {
    try {
      if (await this.exists(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`Cleaned up temporary source PDF at ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to clean up temporary PDF at ${filePath}: ${error}`);
    }
  }
}
