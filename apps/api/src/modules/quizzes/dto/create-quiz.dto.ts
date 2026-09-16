import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitSeconds?: number;
}