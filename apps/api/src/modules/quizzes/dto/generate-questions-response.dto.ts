import {
  GenerationLifecycleStage,
  GenerationStatus,
} from '../enums/generation-status.enum.js';

export class GenerateQuestionsResponseDto {
  generationId: string;
  jobId: string;
  status: GenerationStatus;
  stage?: GenerationLifecycleStage;
  createdAt: Date;
  estimatedProcessingTimeSeconds: number;
}

