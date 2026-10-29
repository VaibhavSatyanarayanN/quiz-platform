import {
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateQuizVersionDto {
  @IsOptional()
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  timeLimitSeconds?: number | null;
}
