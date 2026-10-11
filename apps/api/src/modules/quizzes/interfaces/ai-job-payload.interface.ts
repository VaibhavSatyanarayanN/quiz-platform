export interface AiQuestionGenerationJobPayload {
  generationId: string;
  quizId: string;
  targetVersionId: string;
  creatorId: string;
  organizationId: string | null;
  promptParams: {
    topic: string;
    targetQuestionCount: number;
    questionTypes: string[];
    difficulty: string;
    bloomTaxonomyLevel?: string;
    customInstructions?: string;
    language?: string;
  };
}
