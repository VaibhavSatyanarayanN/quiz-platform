import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GenerationStatus,
  QuestionType,
  type ReviewQuestionItem,
} from '../src/features/quizzes/types/quiz.types.ts';
import {
  validateReviewQuestion,
  validateReviewQuestionSet,
  reorderQuestions,
  areQuestionSetsEqual,
} from '../src/features/quizzes/utils/review-validation.ts';

describe('Frontend AI Review Validation & Workflow Utilities', () => {
  const validMcq: ReviewQuestionItem = {
    id: 'q-1',
    text: 'What is the time complexity of binary search?',
    questionType: QuestionType.SINGLE_CHOICE,
    marks: 2,
    order: 1,
    explanation: 'Halves the search space each step.',
    difficulty: 'easy',
    correctAnswer: 'A',
    options: [
      { id: 'A', text: 'O(log n)', isCorrect: true, order: 1 },
      { id: 'B', text: 'O(n)', isCorrect: false, order: 2 },
    ],
  };

  const validTrueFalse: ReviewQuestionItem = {
    id: 'q-2',
    text: 'HTTP is a stateless protocol by default.',
    questionType: QuestionType.TRUE_FALSE,
    marks: 1,
    order: 2,
    explanation: 'Each request is independent without cookies/sessions.',
    difficulty: 'easy',
    correctAnswer: 'true',
    options: [
      { id: 'True', text: 'True', isCorrect: true, order: 1 },
      { id: 'False', text: 'False', isCorrect: false, order: 2 },
    ],
  };

  it('validates a valid review question set as ready for apply', () => {
    const result = validateReviewQuestionSet([validMcq, validTrueFalse], true);
    assert.equal(result.isValid, true);
    assert.equal(result.globalError, null);
    assert.deepEqual(result.questionErrors, {});
  });

  it('rejects applying an empty question set when requireNonEmptyForApply is true', () => {
    const result = validateReviewQuestionSet([], true);
    assert.equal(result.isValid, false);
    assert.match(result.globalError ?? '', /At least one question is required/i);
  });

  it('detects empty question text, invalid marks, duplicate options, and missing correct option', () => {
    const invalidMcq: ReviewQuestionItem = {
      ...validMcq,
      id: 'q-bad',
      text: '   ',
      marks: 0,
      options: [
        { id: 'A', text: 'Duplicate', isCorrect: false, order: 1 },
        { id: 'B', text: 'duplicate', isCorrect: false, order: 2 },
      ],
    };

    const errors = validateReviewQuestion(invalidMcq, 0);
    assert.equal(errors.length >= 4, true);
    assert.equal(errors.some((e) => /Question text cannot be empty/i.test(e)), true);
    assert.equal(errors.some((e) => /Marks must be a whole number/i.test(e)), true);
    assert.equal(errors.some((e) => /Duplicate option text/i.test(e)), true);
    assert.equal(errors.some((e) => /exactly 1 correct option/i.test(e)), true);
  });

  it('rejects open-ended questions at the QuizVersion review validation boundary', () => {
    const openEndedQuestion: ReviewQuestionItem = {
      id: 'q-open',
      text: 'Explain eventual consistency.',
      questionType: 'open_ended' as QuestionType,
      marks: 5,
      order: 1,
      correctAnswer: 'Replicas converge over time.',
      options: [],
    };

    const errors = validateReviewQuestion(openEndedQuestion, 0);
    assert.equal(
      errors.some((e) => /Open-ended questions are not supported in QuizVersion/i.test(e)),
      true,
    );
  });

  it('aligns frontend GenerationStatus enum values with backend uppercase enum values', () => {
    assert.equal(GenerationStatus.PENDING, 'PENDING');
    assert.equal(GenerationStatus.PROCESSING, 'PROCESSING');
    assert.equal(GenerationStatus.COMPLETED, 'COMPLETED');
    assert.equal(GenerationStatus.FAILED, 'FAILED');
    assert.equal(GenerationStatus.CANCELLED, 'CANCELLED');
  });

  it('reorders questions and updates sequential 1-based order fields', () => {
    const reordered = reorderQuestions([validMcq, validTrueFalse], 0, 1);
    assert.equal(reordered[0].id, 'q-2');
    assert.equal(reordered[0].order, 1);
    assert.equal(reordered[1].id, 'q-1');
    assert.equal(reordered[1].order, 2);
  });

  it('detects unsaved changes accurately via areQuestionSetsEqual', () => {
    assert.equal(areQuestionSetsEqual([validMcq], [{ ...validMcq }]), true);
    assert.equal(
      areQuestionSetsEqual([validMcq], [{ ...validMcq, text: 'Edited question text' }]),
      false,
    );
  });
});
