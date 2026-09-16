import {
    IsOptional,
    IsString,
    Length,
} from 'class-validator';

export class UpdateQuizDto {
    @IsOptional()
    @IsString()
    @Length(1, 200)
    title?: string;

    @IsOptional()
    @IsString()
    @Length(0, 5000)
    description?: string | null;
}