import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QuestionType } from '../enums/question-type.enum.js';
import { DifficultyLevel } from '../enums/difficulty-level.enum.js';

export class GenerateQuestionsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  topic: string;

  @IsInt()
  @Min(1)
  @Max(20)
  targetQuestionCount: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(QuestionType, { each: true })
  questionTypes: QuestionType[];

  @IsEnum(DifficultyLevel)
  difficulty: DifficultyLevel;

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
