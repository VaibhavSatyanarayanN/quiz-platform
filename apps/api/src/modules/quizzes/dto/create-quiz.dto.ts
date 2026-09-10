import {
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @Length(3, 150)
  title: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;
}