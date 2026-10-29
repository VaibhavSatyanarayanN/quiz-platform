import { QuizStatus } from '../enums/quiz-status.enum.js';
import { QuizVersionStatus } from '../enums/quiz-version-status.enum.js';

export class CreatorQuizListItemDto {
    id: string;
    title: string;
    description: string | null;
    status: QuizStatus;
    publishedVersionsCount: number;
    hasDraft: boolean;
    latestVersion?: number;
    latestVersionId?: string | null;
    latestVersionStatus?: QuizVersionStatus | null;
    createdAt: Date;
    updatedAt: Date;
}

export class CreatorQuizListResponseDto {
    items: CreatorQuizListItemDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
