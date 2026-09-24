import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateQuizAssignmentDto {
  @IsUUID()
  @IsNotEmpty()
  quizId: string;

  @IsUUID()
  @IsNotEmpty()
  quizVersionId: string;

  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @IsUUID()
  @IsOptional()
  classroomId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  studentIds?: string[];

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  dueAt?: string;
}
