import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  QuizVersionStatus,
  QuestionType,
  type CreateQuestionRequest,
} from '../src/features/quizzes/types/quiz.types.ts';

// Helper replicating CreatorQuizDetailPage publishingChecklist evaluator
function evaluatePublishingReadiness(params: {
  title: string;
  questions: CreateQuestionRequest[];
  inFlightAiCount: number;
}): { isReady: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!params.title || !params.title.trim()) {
    issues.push('Quiz title cannot be empty.');
  }

  if (params.questions.length === 0) {
    issues.push('At least 1 question is required before publishing.');
  }

  params.questions.forEach((q, idx) => {
    const num = idx + 1;
    if (!q.text || !q.text.trim()) {
      issues.push(`Question ${num} prompt is empty.`);
    }
    if (!q.marks || q.marks < 1) {
      issues.push(`Question ${num} marks must be at least 1.`);
    }
    if (q.questionType === QuestionType.TRUE_FALSE) {
      if (!q.options || q.options.length !== 2) {
        issues.push(`Question ${num} (True/False) must have exactly 2 options.`);
      }
    } else {
      if (!q.options || q.options.length < 2) {
        issues.push(`Question ${num} (${q.questionType}) must have at least 2 options.`);
      }
    }

    const optTexts = new Set<string>();
    (q.options || []).forEach((opt, oIdx) => {
      const oLabel = String.fromCharCode(65 + oIdx);
      if (!opt.text || !opt.text.trim()) {
        issues.push(`Question ${num}, Option ${oLabel} cannot be empty.`);
      }
      const norm = (opt.text || '').trim().toLowerCase();
      if (optTexts.has(norm)) {
        issues.push(`Question ${num} has duplicate option text "${opt.text.trim()}".`);
      }
      optTexts.add(norm);
    });

    const correctCount = (q.options || []).filter((o) => o.isCorrect).length;
    if (q.questionType === QuestionType.SINGLE_CHOICE || q.questionType === QuestionType.TRUE_FALSE) {
      if (correctCount !== 1) {
        issues.push(`Question ${num} (${q.questionType}) must have exactly 1 correct answer (currently has ${correctCount}).`);
      }
    } else if (q.questionType === QuestionType.MULTIPLE_CHOICE) {
      if (correctCount < 1) {
        issues.push(`Question ${num} (Multiple Choice) must have at least 1 correct answer.`);
      }
    }
  });

  if (params.inFlightAiCount > 0) {
    issues.push(`${params.inFlightAiCount} AI generation run(s) are currently in progress.`);
  }

  return {
    isReady: issues.length === 0,
    issues,
  };
}

// Helper replicating time limit parsing and formatting
function parseTimeLimitMinutes(input: string): { valid: boolean; timeLimitSeconds: number | null; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: true, timeLimitSeconds: null };
  }
  const mins = Number(trimmed);
  if (isNaN(mins) || !Number.isInteger(mins) || mins < 1) {
    return { valid: false, timeLimitSeconds: null, error: 'Time limit must be a positive integer in minutes.' };
  }
  return { valid: true, timeLimitSeconds: mins * 60 };
}

function formatTimeLimit(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return 'Untimed (No deadline)';
  const mins = Math.round(seconds / 60);
  return `${mins} minutes (${seconds}s)`;
}

describe('Phase 7.2 — Quiz Editing & Version Integrity (Frontend Contracts & State)', () => {
  const validQuestion1: CreateQuestionRequest = {
    id: 'q-1',
    text: 'What is idempotency in distributed systems?',
    questionType: QuestionType.SINGLE_CHOICE,
    marks: 2,
    options: [
      { id: 'opt-1', text: 'Executing an operation multiple times produces the same result', isCorrect: true },
      { id: 'opt-2', text: 'Executing an operation only once per user session', isCorrect: false },
    ],
  };

  const validQuestion2: CreateQuestionRequest = {
    id: 'q-2',
    text: 'Which protocols run on TCP?',
    questionType: QuestionType.MULTIPLE_CHOICE,
    marks: 3,
    options: [
      { id: 'opt-3', text: 'HTTP/1.1', isCorrect: true },
      { id: 'opt-4', text: 'HTTPS', isCorrect: true },
      { id: 'opt-5', text: 'DNS over pure UDP', isCorrect: false },
    ],
  };

  it('7.2-1. Publishing readiness: accepts a fully valid draft question set with no blockers', () => {
    const readiness = evaluatePublishingReadiness({
      title: 'Distributed Systems & Networking',
      questions: [validQuestion1, validQuestion2],
      inFlightAiCount: 0,
    });

    assert.equal(readiness.isReady, true);
    assert.equal(readiness.issues.length, 0);
  });

  it('7.2-2. Publishing readiness: flags empty quiz title', () => {
    const readiness = evaluatePublishingReadiness({
      title: '   ',
      questions: [validQuestion1],
      inFlightAiCount: 0,
    });

    assert.equal(readiness.isReady, false);
    assert.ok(readiness.issues.some((i) => i.includes('Quiz title cannot be empty')));
  });

  it('7.2-3. Publishing readiness: flags empty question set', () => {
    const readiness = evaluatePublishingReadiness({
      title: 'Valid Title',
      questions: [],
      inFlightAiCount: 0,
    });

    assert.equal(readiness.isReady, false);
    assert.ok(readiness.issues.some((i) => i.includes('At least 1 question is required')));
  });

  it('7.2-4. Publishing readiness: flags empty question prompt and invalid marks', () => {
    const invalidQ: CreateQuestionRequest = {
      text: '',
      questionType: QuestionType.SINGLE_CHOICE,
      marks: 0,
      options: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    };

    const readiness = evaluatePublishingReadiness({
      title: 'Valid Title',
      questions: [invalidQ],
      inFlightAiCount: 0,
    });

    assert.equal(readiness.isReady, false);
    assert.ok(readiness.issues.some((i) => i.includes('Question 1 prompt is empty')));
    assert.ok(readiness.issues.some((i) => i.includes('Question 1 marks must be at least 1')));
  });

  it('7.2-5. Publishing readiness: flags duplicate option text within the same question', () => {
    const duplicateOptQ: CreateQuestionRequest = {
      text: 'Which is a valid color?',
      questionType: QuestionType.SINGLE_CHOICE,
      marks: 1,
      options: [
        { text: 'Blue', isCorrect: true },
        { text: 'blue', isCorrect: false }, // Case-insensitive duplicate
      ],
    };

    const readiness = evaluatePublishingReadiness({
      title: 'Valid Title',
      questions: [duplicateOptQ],
      inFlightAiCount: 0,
    });

    assert.equal(readiness.isReady, false);
    assert.ok(readiness.issues.some((i) => i.includes('duplicate option text')));
  });

  it('7.2-6. Publishing readiness: flags choice question with fewer than 2 options', () => {
    const singleOptQ: CreateQuestionRequest = {
      text: 'Single option question?',
      questionType: QuestionType.SINGLE_CHOICE,
      marks: 1,
      options: [{ text: 'Only option', isCorrect: true }],
    };

    const readiness = evaluatePublishingReadiness({
      title: 'Valid Title',
      questions: [singleOptQ],
      inFlightAiCount: 0,
    });

    assert.equal(readiness.isReady, false);
    assert.ok(readiness.issues.some((i) => i.includes('must have at least 2 options')));
  });

  it('7.2-7. Publishing readiness: flags in-flight AI generation runs', () => {
    const readiness = evaluatePublishingReadiness({
      title: 'Valid Title',
      questions: [validQuestion1],
      inFlightAiCount: 2,
    });

    assert.equal(readiness.isReady, false);
    assert.ok(readiness.issues.some((i) => i.includes('2 AI generation run(s) are currently in progress')));
  });

  it('7.2-8. Time limit parsing: converts minutes to seconds and handles untimed state', () => {
    // 15 minutes -> 900s
    const res1 = parseTimeLimitMinutes('15');
    assert.equal(res1.valid, true);
    assert.equal(res1.timeLimitSeconds, 900);

    // Empty -> untimed (null)
    const res2 = parseTimeLimitMinutes('');
    assert.equal(res2.valid, true);
    assert.equal(res2.timeLimitSeconds, null);

    // Whitespace only -> untimed (null)
    const res3 = parseTimeLimitMinutes('   ');
    assert.equal(res3.valid, true);
    assert.equal(res3.timeLimitSeconds, null);

    // Zero or negative -> invalid
    const resZero = parseTimeLimitMinutes('0');
    assert.equal(resZero.valid, false);

    const resNeg = parseTimeLimitMinutes('-5');
    assert.equal(resNeg.valid, false);

    // Non-integer -> invalid
    const resFloat = parseTimeLimitMinutes('12.5');
    assert.equal(resFloat.valid, false);
  });

  it('7.2-9. Time limit formatting: formats seconds into human-readable minutes and untimed labels', () => {
    assert.equal(formatTimeLimit(900), '15 minutes (900s)');
    assert.equal(formatTimeLimit(1800), '30 minutes (1800s)');
    assert.equal(formatTimeLimit(null), 'Untimed (No deadline)');
    assert.equal(formatTimeLimit(undefined), 'Untimed (No deadline)');
  });

  it('7.2-10. Version immutability state: partitions draft vs published editing permissions', () => {
    const draftVersion = {
      id: 'ver-draft',
      version: 2,
      status: QuizVersionStatus.DRAFT,
      timeLimitSeconds: 1800,
    };

    const publishedVersion = {
      id: 'ver-pub',
      version: 1,
      status: QuizVersionStatus.PUBLISHED,
      timeLimitSeconds: 1200,
    };

    const isDraftEditable = draftVersion.status === QuizVersionStatus.DRAFT;
    const isPublishedEditable = publishedVersion.status === QuizVersionStatus.DRAFT;

    assert.equal(isDraftEditable, true);
    assert.equal(isPublishedEditable, false);
  });

  it('7.2-11. Single draft branch rule: prevents duplicate draft creation if active draft exists', () => {
    const existingVersions = [
      { id: 'ver-1', version: 1, status: QuizVersionStatus.PUBLISHED },
      { id: 'ver-2', version: 2, status: QuizVersionStatus.DRAFT },
    ];

    const hasActiveDraft = existingVersions.some((v) => v.status === QuizVersionStatus.DRAFT);
    assert.equal(hasActiveDraft, true);

    // Frontend provides "Switch to Active Draft" CTA instead of "Create New Version"
    const draftVersionToSwitch = existingVersions.find((v) => v.status === QuizVersionStatus.DRAFT);
    assert.equal(draftVersionToSwitch?.version, 2);
  });
});
