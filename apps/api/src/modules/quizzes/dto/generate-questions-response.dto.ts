import { GenerationStatus } from '../enums/generation-status.enum.js';

export class GenerateQuestionsResponseDto {
  generationId: string;
  jobId: string;
  status: GenerationStatus;
  createdAt: Date;
  estimatedProcessingTimeSeconds: number;
}
