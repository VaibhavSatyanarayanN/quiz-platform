import {
    IsInt,
    IsOptional,
    Min,
} from 'class-validator';

export class UpdateQuizVersionDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    timeLimitSeconds?: number | null;
}