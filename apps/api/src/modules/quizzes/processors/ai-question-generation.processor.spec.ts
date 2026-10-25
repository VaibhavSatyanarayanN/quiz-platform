import 'reflect-metadata';
import { Repository } from 'typeorm';
import { Job, UnrecoverableError } from 'bullmq';

import { AiQuestionGenerationProcessor } from './ai-question-generation.processor.js';
import { QuizQuestionGeneration } from '../entities/quiz-question-generation.entity.js';
import { GenerationStatus } from '../enums/generation-status.enum.js';
import { Quiz } from '../entities/quiz.entity.js';
import { QuizVersion } from '../entities/quiz-version.entity.js';
import { QuizVersionStatus } from '../enums/quiz-version-status.enum.js';
import { QuizGenerationService } from '../quiz-generation.service.js';
import { AiService } from '../../../ai/ai.service.js';
import { AiPdfStorageService } from '../services/ai-pdf-storage.service.js';
import type { AiQuestionGenerationJobPayload } from '../interfaces/ai-job-payload.interface.js';

describe('AiQuestionGenerationProcessor', () => {
  let processor: AiQuestionGenerationProcessor;

  let mockGenerationRepo: Partial<Repository<QuizQuestionGeneration>>;
  let mockQuizRepo: Partial<Repository<Quiz>>;
  let mockQuizVersionRepo: Partial<Repository<QuizVersion>>;
  let mockQuizGenerationService: Partial<QuizGenerationService>;
  let mockAiService: Partial<AiService>;
  let mockPdfStorage: Partial<AiPdfStorageService>;

  const sampleGeneration = {
    id: 'gen-uuid-1',
    quizId: 'quiz-1',
    targetVersionId: 'ver-1',
    creatorId: 'user-1',
    status: GenerationStatus.PENDING,
    promptParams: {
      topic: 'Data Structures',
      targetQuestionCount: 2,
      questionTypes: ['single_choice'],
      difficulty: 'medium',
    },
  } as QuizQuestionGeneration;

  const validAiResponse = {
    status: 'completed',
    question_set: {
      questions: [
        {
          question_id: 'q1',
          question_type: 'mcq',
          question_text: 'What is a binary search tree?',
          options: [
            { option_id: 'A', text: 'A tree data structure' },
            { option_id: 'B', text: 'A linear list' },
          ],
          correct_answer: 'A',
          explanation: 'It is a tree structure.',
          difficulty: 'medium',
          cognitive_level: 'understand',
          learning_objective_id: 'lo1',
        },
        {
          question_id: 'q2',
          question_type: 'true_false',
          question_text: 'Is quicksort an in-place sorting algorithm?',
          correct_answer: 'true',
          explanation: 'Quicksort sorts in place.',
          difficulty: 'easy',
          cognitive_level: 'remember',
          learning_objective_id: 'lo2',
        },
      ],
    },
    tokens_used: { prompt_tokens: 100, completion_tokens: 50 },
  };

  function createMockJob(
    attemptsMade = 0,
    attemptsTotal = 3,
    customPayload?: Partial<AiQuestionGenerationJobPayload>,
  ): Job<AiQuestionGenerationJobPayload> {
    return {
      id: 'job_gen-uuid-1',
      attemptsMade,
      opts: { attempts: attemptsTotal },
      data: {
        generationId: 'gen-uuid-1',
        quizId: 'quiz-1',
        targetVersionId: 'ver-1',
        creatorId: 'user-1',
        organizationId: null,
        promptParams: {
          topic: 'Data Structures',
          targetQuestionCount: 2,
          questionTypes: ['single_choice'],
          difficulty: 'medium',
        },
        ...customPayload,
      },
    } as unknown as Job<AiQuestionGenerationJobPayload>;
  }

  beforeEach(() => {
    mockGenerationRepo = {
      findOne: vi.fn().mockResolvedValue({ ...sampleGeneration }),
      update: vi.fn().mockResolvedValue({ affected: 1 } as any),
      save: vi.fn(async (entity) => entity as any),
    };

    mockQuizRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 'quiz-1', creatorId: 'user-1' } as Quiz),
    };

    mockQuizVersionRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 'ver-1',
        quizId: 'quiz-1',
        status: QuizVersionStatus.DRAFT,
      } as QuizVersion),
    };

    mockQuizGenerationService = {
      persistGeneratedQuestionsTransactionally: vi.fn().mockResolvedValue({} as any),
    };

    mockAiService = {
      generateQuiz: vi.fn().mockResolvedValue(validAiResponse),
      generateQuizFromPdf: vi.fn().mockResolvedValue(validAiResponse),
    };

    mockPdfStorage = {
      exists: vi.fn().mockResolvedValue(true),
      readPdfFile: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test')),
      deletePdfFile: vi.fn().mockResolvedValue(undefined),
    };

    processor = new AiQuestionGenerationProcessor(
      mockGenerationRepo as Repository<QuizQuestionGeneration>,
      mockQuizRepo as Repository<Quiz>,
      mockQuizVersionRepo as Repository<QuizVersion>,
      mockQuizGenerationService as QuizGenerationService,
      mockAiService as AiService,
      mockPdfStorage as AiPdfStorageService,
    );
  });

  describe('Lifecycle and Idempotency', () => {
    it('should return safely if generation record is missing', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValue(null);
      const job = createMockJob();

      await expect(processor.process(job)).resolves.not.toThrow();
      expect(mockAiService.generateQuiz).not.toHaveBeenCalled();
    });

    it('should return safely without executing if generation was CANCELLED', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValue({
        ...sampleGeneration,
        status: GenerationStatus.CANCELLED,
      });
      const job = createMockJob();

      await expect(processor.process(job)).resolves.not.toThrow();
      expect(mockAiService.generateQuiz).not.toHaveBeenCalled();
    });

    it('should exit idempotently without re-inserting if already COMPLETED', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValue({
        ...sampleGeneration,
        status: GenerationStatus.COMPLETED,
      });
      const job = createMockJob();

      await expect(processor.process(job)).resolves.not.toThrow();
      expect(mockAiService.generateQuiz).not.toHaveBeenCalled();
      expect(mockQuizGenerationService.persistGeneratedQuestionsTransactionally).not.toHaveBeenCalled();
    });

    it('should throw UnrecoverableError and mark FAILED if target version is not DRAFT', async () => {
      mockQuizVersionRepo.findOne = vi.fn().mockResolvedValue({
        id: 'ver-1',
        quizId: 'quiz-1',
        status: QuizVersionStatus.PUBLISHED,
      });
      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow(UnrecoverableError);
      expect(mockGenerationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GenerationStatus.FAILED,
          errorMessage: expect.stringContaining('Only DRAFT versions can receive AI questions'),
        }),
      );
    });
  });

  describe('Successful Execution Paths', () => {
    it('should successfully process standard text generation and persist questions', async () => {
      const job = createMockJob();

      await processor.process(job);

      // Transitions to PROCESSING
      expect(mockGenerationRepo.update).toHaveBeenCalledWith(
        { id: 'gen-uuid-1', status: GenerationStatus.PENDING },
        expect.objectContaining({ status: GenerationStatus.PROCESSING }),
      );

      // Calls AI Service
      expect(mockAiService.generateQuiz).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'Data Structures', question_count: 2 }),
        expect.any(Object),
        'job_gen-uuid-1',
      );

      // Persists questions transactionally
      expect(mockQuizGenerationService.persistGeneratedQuestionsTransactionally).toHaveBeenCalledWith(
        'gen-uuid-1',
        'quiz-1',
        'ver-1',
        expect.arrayContaining([
          expect.objectContaining({ text: 'What is a binary search tree?' }),
          expect.objectContaining({ text: 'Is quicksort an in-place sorting algorithm?' }),
        ]),
        expect.any(Object),
      );
    });

    it('should successfully process PDF generation, read from storage, and clean up file', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValue({
        ...sampleGeneration,
        promptParams: {
          ...sampleGeneration.promptParams,
          sourcePdfPath: '/uploads/gen-uuid-1.pdf',
          originalFilename: 'notes.pdf',
        },
      });

      const job = createMockJob(0, 3, {
        promptParams: {
          ...sampleGeneration.promptParams,
          sourcePdfPath: '/uploads/gen-uuid-1.pdf',
          originalFilename: 'notes.pdf',
        },
      });

      await processor.process(job);

      expect(mockPdfStorage.exists).toHaveBeenCalledWith('/uploads/gen-uuid-1.pdf');
      expect(mockPdfStorage.readPdfFile).toHaveBeenCalledWith('/uploads/gen-uuid-1.pdf');
      expect(mockAiService.generateQuizFromPdf).toHaveBeenCalled();

      // Cleaned up PDF file after execution
      expect(mockPdfStorage.deletePdfFile).toHaveBeenCalledWith('/uploads/gen-uuid-1.pdf');
    });
  });

  describe('Validation & Error Handling', () => {
    it('should throw UnrecoverableError and mark FAILED if AI response is malformed', async () => {
      mockAiService.generateQuiz = vi.fn().mockResolvedValue({
        status: 'completed',
        question_set: { questions: [] }, // Empty questions list!
      });
      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow(UnrecoverableError);
      expect(mockGenerationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GenerationStatus.FAILED,
          errorMessage: expect.stringContaining('empty or invalid question_set'),
        }),
      );
    });

    it('should throw UnrecoverableError if MCQ correct_answer does not match option IDs', async () => {
      mockAiService.generateQuiz = vi.fn().mockResolvedValue({
        status: 'completed',
        question_set: {
          questions: [
            {
              question_id: 'q1',
              question_type: 'mcq',
              question_text: 'Sample question?',
              options: [
                { option_id: 'A', text: 'Option A' },
                { option_id: 'B', text: 'Option B' },
              ],
              correct_answer: 'Z', // Mismatch!
            },
          ],
        },
      });
      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow(UnrecoverableError);
      expect(mockGenerationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GenerationStatus.FAILED,
          errorMessage: expect.stringContaining('does not match any option ID'),
        }),
      );
    });

    it('should allow BullMQ retry on transient error when attempts remain', async () => {
      mockAiService.generateQuiz = vi.fn().mockRejectedValue(new Error('Gateway timeout'));
      const job = createMockJob(0, 3); // Attempt 1 of 3

      await expect(processor.process(job)).rejects.toThrow('Gateway timeout');

      // Should NOT be marked FAILED yet
      expect(mockGenerationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: expect.stringContaining('Transient failure on attempt 1'),
        }),
      );
    });

    it('should mark generation FAILED when retries are exhausted', async () => {
      mockAiService.generateQuiz = vi.fn().mockRejectedValue(new Error('Gateway timeout'));
      const job = createMockJob(2, 3); // Attempt 3 of 3 (exhausted)

      await expect(processor.process(job)).rejects.toThrow('Gateway timeout');

      // Should be marked FAILED
      expect(mockGenerationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GenerationStatus.FAILED,
          errorMessage: expect.stringContaining('Gateway timeout'),
        }),
      );
    });

    it('should throw UnrecoverableError if source PDF is missing from disk', async () => {
      mockGenerationRepo.findOne = vi.fn().mockResolvedValue({
        ...sampleGeneration,
        promptParams: {
          ...sampleGeneration.promptParams,
          sourcePdfPath: '/uploads/missing.pdf',
        },
      });
      mockPdfStorage.exists = vi.fn().mockResolvedValue(false); // Missing!

      const job = createMockJob();

      await expect(processor.process(job)).rejects.toThrow(UnrecoverableError);
      expect(mockGenerationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GenerationStatus.FAILED,
          errorMessage: expect.stringContaining('Source PDF file not found'),
        }),
      );
    });
  });
});
