import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PublishedQuizQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'timed', 'untimed'])
  timing?: 'all' | 'timed' | 'untimed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class PublishedQuizListItemDto {
  id: string;
  title: string;
  description: string | null;
  organizationId?: string | null;
  latestPublishedVersionId: string;
  latestPublishedVersionNumber: number;
  timeLimitSeconds: number | null;
  totalQuestions: number;
  totalMarks: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

export class PublishedQuizListResponseDto {
  items: PublishedQuizListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
