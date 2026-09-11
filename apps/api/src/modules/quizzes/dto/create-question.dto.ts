import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Min,
    ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { QuestionType } from '../enums/question-type.enum.js';
import { CreateOptionDto } from './create-option.dto.js';

export class CreateQuestionDto {
    @IsOptional()
    @IsUUID()
    id?: string;

    @IsString()
    @Length(1, 5000)
    text: string;

    @IsEnum(QuestionType)
    questionType: QuestionType;

    @IsInt()
    @Min(1)
    order: number;

    @IsInt()
    @Min(1)
    marks: number;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateOptionDto)
    options: CreateOptionDto[];
}