import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QuestionType } from '../enums/question-type.enum.js';
import { DifficultyLevel } from '../enums/difficulty-level.enum.js';

export class GenerateQuestionsFromPdfDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return 10;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!/^\d+$/.test(trimmed)) {
        return NaN;
      }
      return Number(trimmed);
    }
    return value;
  })
  @IsInt()
  @Min(1)
  @Max(20)
  targetQuestionCount?: number = 10;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return [QuestionType.SINGLE_CHOICE];
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return [QuestionType.SINGLE_CHOICE];
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fallback: check if single enum string value was passed directly, e.g. "single_choice"
        if (Object.values(QuestionType).includes(trimmed as QuestionType)) {
          return [trimmed as QuestionType];
        }
        throw new BadRequestException('Invalid JSON for questionTypes in form data');
      }
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(QuestionType, { each: true })
  questionTypes?: QuestionType[] = [QuestionType.SINGLE_CHOICE];

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel = DifficultyLevel.MEDIUM;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bloomTaxonomyLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string = 'en';
}
