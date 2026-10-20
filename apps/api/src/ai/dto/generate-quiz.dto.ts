import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export enum SupportedQuestionType {
  MCQ = 'mcq',
  TRUE_FALSE = 'true_false',
  OPEN_ENDED = 'open_ended',
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export const ALLOWED_DIFFICULTIES: readonly DifficultyLevel[] = [
  'easy',
  'medium',
  'hard',
];

@ValidatorConstraint({ name: 'isValidDifficultyDistribution', async: false })
export class IsValidDifficultyDistributionConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const dist = value as Record<string, unknown>;
    const keys = Object.keys(dist);

    if (keys.length === 0) {
      return false;
    }

    // Only easy, medium, and hard are allowed
    for (const key of keys) {
      if (!ALLOWED_DIFFICULTIES.includes(key as DifficultyLevel)) {
        return false;
      }
      const count = dist[key];
      if (
        typeof count !== 'number' ||
        !Number.isFinite(count) ||
        !Number.isInteger(count) ||
        count < 0
      ) {
        return false;
      }
    }

    // Retrieve target question_count from the parent object (defaults to 10 if not specified)
    const parentObj = args.object as { question_count?: unknown };
    const targetCount =
      typeof parentObj?.question_count === 'number' &&
      Number.isInteger(parentObj.question_count) &&
      parentObj.question_count > 0
        ? parentObj.question_count
        : 10;

    const sum = keys.reduce(
      (acc, key) => acc + (typeof dist[key] === 'number' ? (dist[key] as number) : 0),
      0,
    );

    return sum === targetCount;
  }

  defaultMessage(args: ValidationArguments): string {
    const parentObj = args.object as { question_count?: unknown };
    const targetCount =
      typeof parentObj?.question_count === 'number' ? parentObj.question_count : 10;
    return `difficulty_distribution must contain only 'easy', 'medium', or 'hard' non-negative integers summing to question_count (${targetCount}).`;
  }
}

export class GenerateQuizDto {
  @ValidateIf((o: GenerateQuizDto) => !o.source_text || o.topic !== undefined)
  @IsNotEmpty({ message: 'topic is required when source_text is omitted.' })
  @IsString({ message: 'topic must be a string.' })
  @Length(2, 500, {
    message: 'topic must be between 2 and 500 characters.',
  })
  topic?: string;

  @IsOptional()
  @IsString({ message: 'source_text must be a string.' })
  @Length(1, 200_000, {
    message: 'source_text must be between 1 and 200,000 characters.',
  })
  source_text?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'question_count must be an integer.' })
  @Min(1, { message: 'question_count must be at least 1.' })
  @Max(100, { message: 'question_count must not exceed 100.' })
  question_count: number = 10;

  @IsOptional()
  @IsArray({ message: 'question_types must be an array.' })
  @ArrayNotEmpty({ message: 'question_types must not be empty.' })
  @ArrayUnique({ message: 'question_types must contain unique items.' })
  @IsEnum(SupportedQuestionType, {
    each: true,
    message:
      'Each question_type must be one of: mcq, true_false, open_ended.',
  })
  question_types: SupportedQuestionType[] = [SupportedQuestionType.MCQ];

  @IsOptional()
  @IsObject({ message: 'difficulty_distribution must be an object.' })
  @Validate(IsValidDifficultyDistributionConstraint)
  difficulty_distribution: Record<DifficultyLevel, number> = {
    easy: 3,
    medium: 5,
    hard: 2,
  };

  @IsOptional()
  @IsString({ message: 'target_audience must be a string.' })
  @Length(1, 200, {
    message: 'target_audience must be between 1 and 200 characters.',
  })
  target_audience: string = 'General learners';

  @IsOptional()
  @IsString({ message: 'language must be a string.' })
  @Length(1, 50, {
    message: 'language must be between 1 and 50 characters.',
  })
  language: string = 'English';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'max_revision_attempts must be an integer.' })
  @Min(0, { message: 'max_revision_attempts must be at least 0.' })
  @Max(2, { message: 'max_revision_attempts must not exceed 2.' })
  max_revision_attempts: number = 1;
}

export class GenerateFromPdfDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return 10;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!/^-?\d+$/.test(trimmed)) {
        return NaN; // Triggers @IsInt validation failure cleanly
      }
      return Number(trimmed);
    }
    return value;
  })
  @IsInt({ message: 'question_count must be an integer.' })
  @Min(1, { message: 'question_count must be at least 1.' })
  @Max(100, { message: 'question_count must not exceed 100.' })
  question_count: number = 10;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return [SupportedQuestionType.MCQ];
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return [SupportedQuestionType.MCQ];
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        throw new BadRequestException(
          'Invalid JSON for question_types. Must be a valid JSON array.',
        );
      }
    }
    return value;
  })
  @IsArray({ message: 'question_types must be an array.' })
  @ArrayNotEmpty({ message: 'question_types must not be empty.' })
  @ArrayUnique({ message: 'question_types must contain unique items.' })
  @IsEnum(SupportedQuestionType, {
    each: true,
    message:
      'Each question_type must be one of: mcq, true_false, open_ended.',
  })
  question_types: SupportedQuestionType[] = [SupportedQuestionType.MCQ];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return { easy: 3, medium: 5, hard: 2 };
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return { easy: 3, medium: 5, hard: 2 };
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        throw new BadRequestException(
          'Invalid JSON for difficulty_distribution. Must be a valid JSON object.',
        );
      }
    }
    return value;
  })
  @IsObject({ message: 'difficulty_distribution must be an object.' })
  @Validate(IsValidDifficultyDistributionConstraint)
  difficulty_distribution: Record<DifficultyLevel, number> = {
    easy: 3,
    medium: 5,
    hard: 2,
  };

  @IsOptional()
  @IsString({ message: 'target_audience must be a string.' })
  @Length(1, 200, {
    message: 'target_audience must be between 1 and 200 characters.',
  })
  target_audience: string = 'General learners';

  @IsOptional()
  @IsString({ message: 'language must be a string.' })
  @Length(1, 50, {
    message: 'language must be between 1 and 50 characters.',
  })
  language: string = 'English';

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return 1;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!/^-?\d+$/.test(trimmed)) {
        return NaN; // Triggers @IsInt validation failure cleanly
      }
      return Number(trimmed);
    }
    return value;
  })
  @IsInt({ message: 'max_revision_attempts must be an integer.' })
  @Min(0, { message: 'max_revision_attempts must be at least 0.' })
  @Max(2, { message: 'max_revision_attempts must not exceed 2.' })
  max_revision_attempts: number = 1;
}
