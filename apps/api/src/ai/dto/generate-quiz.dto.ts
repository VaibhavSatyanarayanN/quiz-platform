
export interface GenerateQuizDto {
    topic: string;
    source_text?: string | null;
    question_count: number;
    question_types: string[];
    difficulty_distribution: Record<string, number>;
    target_audience: string;
    language: string;
    max_revision_attempts: number;
}

export interface GenerateFromPdfDto {
    question_count?: number | string;
    question_types?: string[] | string;
    difficulty_distribution?: Record<string, number> | string;
    target_audience?: string;
    language?: string;
    max_revision_attempts?: number | string;
}
