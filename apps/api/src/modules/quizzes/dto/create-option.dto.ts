import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateOptionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @Length(1, 1000)
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}