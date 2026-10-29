import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  GenerationLifecycleStage,
  GenerationReviewStatus,
  GenerationStatus,
} from '../enums/generation-status.enum.js';
import { QuestionType } from '../enums/question-type.enum.js';
import { QuizVersionStatus } from '../enums/quiz-version-status.enum.js';

export class ReviewOptionInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text: string;

  @IsBoolean()
  isCorrect: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}

export class ReviewQuestionInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text: string;

  @IsString()
  @IsNotEmpty()
  questionType: QuestionType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  marks?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  explanation?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  difficulty?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cognitiveLevel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  learningObjectiveId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correctAnswer?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewOptionInputDto)
  options?: ReviewOptionInputDto[];
}

export class UpdateGenerationReviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewQuestionInputDto)
  questions: ReviewQuestionInputDto[];
}

export class ApplyGeneratedQuestionsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewQuestionInputDto)
  questions?: ReviewQuestionInputDto[];

  @IsOptional()
  @IsString()
  targetVersionId?: string;
}

export class ReviewOptionResponseDto {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export class ReviewQuestionResponseDto {
  id: string;
  text: string;
  questionType: QuestionType;
  marks: number;
  order: number;
  explanation: string | null;
  difficulty: string | null;
  cognitiveLevel: string | null;
  learningObjectiveId: string | null;
  correctAnswer: string | null;
  validationFeedback: Record<string, any> | null;
  pedagogyFeedback: Record<string, any> | null;
  options: ReviewOptionResponseDto[];
}

export class GenerationReviewResponseDto {
  generationId: string;
  jobId: string;
  quizId: string;
  targetVersionId: string;
  targetVersionStatus: QuizVersionStatus | null;
  targetVersionExistingQuestionCount: number;
  status: GenerationStatus;
  stage: GenerationLifecycleStage;
  stageDescription: string;
  reviewStatus: GenerationReviewStatus;
  isReadyForReview: boolean;
  isApplied: boolean;
  hasCreatorEdits: boolean;
  editedAt: string | null;
  appliedAt: string | null;
  appliedQuestionsCount: number | null;
  appliedQuestionIds: string[];
  promptParams: Record<string, any>;
  questions: ReviewQuestionResponseDto[];
  errorMessage: string | null;
  tokensUsed: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export class ApplyGeneratedQuestionsResponseDto {
  generationId: string;
  quizId: string;
  targetVersionId: string;
  reviewStatus: GenerationReviewStatus;
  isApplied: boolean;
  appliedAt: string;
  appliedQuestionsCount: number;
  appliedQuestionIds: string[];
  applyStrategy: 'append';
  questions: ReviewQuestionResponseDto[];
}
