import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

import {
  GenerateFromPdfDto,
  GenerateQuizDto,
  SupportedQuestionType,
} from './generate-quiz.dto.js';

describe('GenerateQuizDto Validation', () => {
  it('should validate a valid standard generation request', async () => {
    const input = {
      topic: 'Python fundamentals',
      question_count: 5,
      question_types: ['mcq'],
      difficulty_distribution: {
        easy: 2,
        medium: 2,
        hard: 1,
      },
      target_audience: 'Beginner developers',
      language: 'English',
      max_revision_attempts: 1,
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate request with defaults when only topic is provided', async () => {
    const input = {
      topic: 'JavaScript Closures',
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.question_count).toBe(10);
    expect(dto.question_types).toEqual([SupportedQuestionType.MCQ]);
    expect(dto.difficulty_distribution).toEqual({
      easy: 3,
      medium: 5,
      hard: 2,
    });
  });

  it('should reject request when both topic and source_text are missing', async () => {
    const input = {
      question_count: 10,
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const topicError = errors.find((e) => e.property === 'topic');
    expect(topicError).toBeDefined();
  });

  it('should accept request with source_text when topic is omitted', async () => {
    const input = {
      source_text: 'Node.js is an open-source, cross-platform JavaScript runtime environment.',
      question_count: 10,
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject topic shorter than 2 characters', async () => {
    const input = {
      topic: 'A',
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    const topicError = errors.find((e) => e.property === 'topic');
    expect(topicError).toBeDefined();
  });

  it('should reject topic longer than 500 characters', async () => {
    const input = {
      topic: 'A'.repeat(501),
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    const topicError = errors.find((e) => e.property === 'topic');
    expect(topicError).toBeDefined();
  });

  it('should reject question_count below 1 or above 100', async () => {
    const lowInput = plainToInstance(GenerateQuizDto, {
      topic: 'Python',
      question_count: 0,
      difficulty_distribution: { easy: 0, medium: 0, hard: 0 },
    });
    const lowErrors = await validate(lowInput);
    expect(lowErrors.some((e) => e.property === 'question_count')).toBe(true);

    const highInput = plainToInstance(GenerateQuizDto, {
      topic: 'Python',
      question_count: 101,
      difficulty_distribution: { easy: 101, medium: 0, hard: 0 },
    });
    const highErrors = await validate(highInput);
    expect(highErrors.some((e) => e.property === 'question_count')).toBe(true);
  });

  it('should reject unsupported question types', async () => {
    const input = {
      topic: 'Python',
      question_types: ['unsupported_type'],
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    const typeError = errors.find((e) => e.property === 'question_types');
    expect(typeError).toBeDefined();
  });

  it('should reject duplicate question types', async () => {
    const input = {
      topic: 'Python',
      question_types: ['mcq', 'mcq'],
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    const typeError = errors.find((e) => e.property === 'question_types');
    expect(typeError).toBeDefined();
  });

  it('should reject difficulty_distribution when sum does not match question_count', async () => {
    const input = {
      topic: 'Python',
      question_count: 10,
      difficulty_distribution: {
        easy: 1,
        medium: 1,
        hard: 1, // Sum is 3, not 10
      },
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    const diffError = errors.find((e) => e.property === 'difficulty_distribution');
    expect(diffError).toBeDefined();
  });

  it('should reject difficulty_distribution with negative counts', async () => {
    const input = {
      topic: 'Python',
      question_count: 10,
      difficulty_distribution: {
        easy: 12,
        medium: -2,
        hard: 0,
      },
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    const diffError = errors.find((e) => e.property === 'difficulty_distribution');
    expect(diffError).toBeDefined();
  });

  it('should reject difficulty_distribution with unsupported keys', async () => {
    const input = {
      topic: 'Python',
      question_count: 10,
      difficulty_distribution: {
        easy: 5,
        medium: 5,
        impossible: 0,
      },
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    const diffError = errors.find((e) => e.property === 'difficulty_distribution');
    expect(diffError).toBeDefined();
  });

  it('should reject max_revision_attempts outside [0, 2]', async () => {
    const input = {
      topic: 'Python',
      max_revision_attempts: 3,
    };

    const dto = plainToInstance(GenerateQuizDto, input);
    const errors = await validate(dto);
    const revError = errors.find((e) => e.property === 'max_revision_attempts');
    expect(revError).toBeDefined();
  });
});

describe('GenerateFromPdfDto Transformation and Validation', () => {
  it('should parse valid JSON strings in multipart form fields', async () => {
    const rawMultipart = {
      question_count: '5',
      question_types: '["mcq", "true_false"]',
      difficulty_distribution: '{"easy": 2, "medium": 2, "hard": 1}',
      max_revision_attempts: '2',
      target_audience: 'Advanced Engineers',
      language: 'Spanish',
    };

    const dto = plainToInstance(GenerateFromPdfDto, rawMultipart);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.question_count).toBe(5);
    expect(dto.question_types).toEqual(['mcq', 'true_false']);
    expect(dto.difficulty_distribution).toEqual({
      easy: 2,
      medium: 2,
      hard: 1,
    });
    expect(dto.max_revision_attempts).toBe(2);
  });

  it('should throw BadRequestException on malformed question_types JSON', () => {
    const rawMultipart = {
      question_types: '{not-json',
    };

    expect(() => plainToInstance(GenerateFromPdfDto, rawMultipart)).toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException on malformed difficulty_distribution JSON', () => {
    expect(() =>
      plainToInstance(GenerateFromPdfDto, {
        difficulty_distribution: 'not-valid-json',
      }),
    ).toThrow(BadRequestException);
  });

  it('should reject non-numeric string for question_count', async () => {
    const rawMultipart = {
      question_count: 'ten',
    };

    const dto = plainToInstance(GenerateFromPdfDto, rawMultipart);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'question_count')).toBe(true);
  });
});
