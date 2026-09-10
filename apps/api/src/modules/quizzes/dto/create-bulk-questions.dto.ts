import {
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { CreateQuestionDto } from './create-question.dto.js';

export class CreateBulkQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)    
  questions: CreateQuestionDto[];
}