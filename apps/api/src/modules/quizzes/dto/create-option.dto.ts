import {
  IsBoolean,
  IsInt,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateOptionDto {
  @IsString()
  @Length(1, 1000)
  text: string;

  @IsBoolean()
  isCorrect: boolean;

  @IsInt()
  @Min(1)
  order: number;
}