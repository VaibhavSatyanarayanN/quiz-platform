import {
  GenerationLifecycleStage,
  GenerationStatus,
} from '../enums/generation-status.enum.js';

export class GenerationStatusResponseDto {
  generationId: string;
  jobId: string;
  quizId: string;
  targetVersionId: string;
  status: GenerationStatus;
  stage: GenerationLifecycleStage;
  stageDescription: string;
  isTerminal: boolean;
  canCancel: boolean;
  promptParams: Record<string, any>;
  generatedQuestions: Record<string, any>[] | null;
  errorMessage: string | null;
  tokensUsed: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

