export enum GenerationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum GenerationLifecycleStage {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  CALLING_AI_SERVICE = 'calling_ai_service',
  VALIDATING_QUESTIONS = 'validating_questions',
  SAVING_QUESTIONS = 'saving_questions',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

