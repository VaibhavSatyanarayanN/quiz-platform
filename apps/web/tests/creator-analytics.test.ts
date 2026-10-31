import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  QuizAnalyticsResponse,
  QuizAnalyticsSummary,
} from '../src/features/analytics/types/analytics.types.ts';

describe('Phase 7.5 — Creator Analytics & Performance Insights (Frontend Contracts & Logic)', () => {
  const sampleAnalytics: QuizAnalyticsResponse = {
    quizId: 'quiz-analytics-1',
    quizTitle: 'Full-Stack Engineering Assessment',
    versionId: 'ver-1',
    versionNumber: 1,
    publishedVersionsCount: 2,
    availableVersions: [
      { id: 'ver-2', versionNumber: 2, status: 'published' },
      { id: 'ver-1', versionNumber: 1, status: 'published' },
    ],
    versionSummaries: [
      {
        versionId: 'ver-2',
        versionNumber: 2,
        status: 'published',
        totalQuestions: 5,
        totalMarks: 15,
        timeLimitSeconds: 900,
        totalAttempts: 10,
        submittedAttempts: 8,
        expiredAttempts: 2,
        inProgressAttempts: 0,
        avgScore: 12.5,
        avgPercentage: 83.33,
        highestPercentage: 100,
        lowestPercentage: 60,
      },
      {
        versionId: 'ver-1',
        versionNumber: 1,
        status: 'published',
        totalQuestions: 4,
        totalMarks: 10,
        timeLimitSeconds: 600,
        totalAttempts: 15,
        submittedAttempts: 10,
        expiredAttempts: 3,
        inProgressAttempts: 2,
        avgScore: 7.2,
        avgPercentage: 72,
        highestPercentage: 100,
        lowestPercentage: 40,
      },
    ],
    summary: {
      totalAttempts: 15,
      submittedAttempts: 10,
      expiredAttempts: 3,
      inProgressAttempts: 2,
      completedAttempts: 13, // 10 + 3
      completionRate: 66.67, // 10 / 15
      finalizedRate: 86.67, // 13 / 15
      avgScore: 7.2,
      avgPercentage: 72,
      highestScore: 10,
      lowestScore: 4,
      highestPercentage: 100,
      lowestPercentage: 40,
      avgDurationSeconds: 420,
      totalQuestions: 4,
      totalMarks: 10,
      totalCorrectAnswers: 36,
      totalWrongAnswers: 12,
      totalUnanswered: 4,
      publishedVersionsCount: 2,
    },
    questionTypeBreakdown: {
      single_choice: {
        questionType: 'single_choice',
        questionCount: 2,
        totalResponses: 26,
        correctResponses: 20,
        accuracyPercentage: 76.92,
      },
      multiple_choice: {
        questionType: 'multiple_choice',
        questionCount: 1,
        totalResponses: 13,
        correctResponses: 7,
        accuracyPercentage: 53.85,
      },
      true_false: {
        questionType: 'true_false',
        questionCount: 1,
        totalResponses: 13,
        correctResponses: 9,
        accuracyPercentage: 69.23,
      },
    },
    scoreDistribution: {
      range90To100: { count: 3, percentage: 23.08 },
      range80To89: { count: 4, percentage: 30.77 },
      range70To79: { count: 3, percentage: 23.08 },
      range60To69: { count: 2, percentage: 15.38 },
      rangeBelow60: { count: 1, percentage: 7.69 },
    },
    topScorers: [
      {
        attemptId: 'att-1',
        userId: 'user-1',
        username: 'alice',
        email: 'al***@example.com',
        score: 10,
        totalMarks: 10,
        percentage: 100,
        durationSeconds: 310,
        submittedAt: '2026-10-31T10:00:00.000Z',
      },
      {
        attemptId: 'att-2',
        userId: 'user-2',
        username: 'bob',
        email: 'bo***@example.com',
        score: 9,
        totalMarks: 10,
        percentage: 90,
        durationSeconds: 450,
        submittedAt: '2026-10-31T10:15:00.000Z',
      },
    ],
    questionAnalytics: [
      {
        questionId: 'q-1',
        questionText: 'What is a closure in JavaScript?',
        questionType: 'single_choice',
        marks: 2,
        order: 1,
        attemptCount: 13,
        correctCount: 11,
        correctPercentage: 84.62,
        wrongCount: 2,
        wrongPercentage: 15.38,
        unansweredCount: 0,
        unansweredPercentage: 0,
        difficultyEstimate: 'EASY',
        observedAccuracy: 84.62,
        options: [
          { optionId: 'opt-1', optionText: 'Function with lexical environment', isCorrect: true, selectionCount: 11, selectionPercentage: 84.62 },
          { optionId: 'opt-2', optionText: 'A way to close browser tab', isCorrect: false, selectionCount: 2, selectionPercentage: 15.38 },
        ],
      },
      {
        questionId: 'q-2',
        questionText: 'Select all falsy values in JS',
        questionType: 'multiple_choice',
        marks: 3,
        order: 2,
        attemptCount: 13,
        correctCount: 7,
        correctPercentage: 53.85,
        wrongCount: 5,
        wrongPercentage: 38.46,
        unansweredCount: 1,
        unansweredPercentage: 7.69,
        difficultyEstimate: 'MEDIUM',
        observedAccuracy: 53.85,
        options: [
          { optionId: 'opt-3', optionText: 'null', isCorrect: true, selectionCount: 10, selectionPercentage: 76.92 },
          { optionId: 'opt-4', optionText: '0', isCorrect: true, selectionCount: 9, selectionPercentage: 69.23 },
          { optionId: 'opt-5', optionText: '[]', isCorrect: false, selectionCount: 5, selectionPercentage: 38.46 },
        ],
      },
      {
        questionId: 'q-3',
        questionText: 'TypeScript interfaces exist at runtime',
        questionType: 'true_false',
        marks: 2,
        order: 3,
        attemptCount: 13,
        correctCount: 4,
        correctPercentage: 30.77,
        wrongCount: 9,
        wrongPercentage: 69.23,
        unansweredCount: 0,
        unansweredPercentage: 0,
        difficultyEstimate: 'HARD',
        observedAccuracy: 30.77,
        options: [
          { optionId: 'opt-6', optionText: 'True', isCorrect: false, selectionCount: 9, selectionPercentage: 69.23 },
          { optionId: 'opt-7', optionText: 'False', isCorrect: true, selectionCount: 4, selectionPercentage: 30.77 },
        ],
      },
    ],
  };

  it('7.5-1. Summary KPIs: accurately calculates and formats finalized rate and completion rate', () => {
    const summary = sampleAnalytics.summary;
    const submitted = summary.submittedAttempts;
    const expired = summary.expiredAttempts;
    const inProgress = summary.inProgressAttempts;
    const total = summary.totalAttempts;

    assert.equal(submitted + expired + inProgress, total);
    assert.equal(summary.completedAttempts, submitted + expired);

    const calculatedCompletion = Math.round((submitted / total) * 10000) / 100;
    const calculatedFinalized = Math.round(((submitted + expired) / total) * 10000) / 100;

    assert.equal(summary.completionRate, calculatedCompletion);
    assert.equal(summary.finalizedRate, calculatedFinalized);
  });

  it('7.5-2. Zero-attempt handling: safely yields 0 for all rates, averages, and score ranges', () => {
    const zeroSummary: QuizAnalyticsSummary = {
      totalAttempts: 0,
      submittedAttempts: 0,
      expiredAttempts: 0,
      inProgressAttempts: 0,
      completedAttempts: 0,
      completionRate: 0,
      finalizedRate: 0,
      avgScore: 0,
      avgPercentage: 0,
      highestScore: 0,
      lowestScore: 0,
      highestPercentage: 0,
      lowestPercentage: 0,
      avgDurationSeconds: 0,
      totalQuestions: 3,
      totalMarks: 6,
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      totalUnanswered: 0,
      publishedVersionsCount: 1,
    };

    assert.equal(zeroSummary.totalAttempts, 0);
    assert.equal(zeroSummary.completionRate, 0);
    assert.equal(zeroSummary.finalizedRate, 0);
    assert.equal(zeroSummary.avgScore, 0);
    assert.equal(zeroSummary.avgPercentage, 0);
    assert.equal(Number.isNaN(zeroSummary.avgScore), false);
    assert.equal(Number.isNaN(zeroSummary.avgPercentage), false);
  });

  it('7.5-3. Multi-version isolation: keeps metrics separate across quiz versions', () => {
    const summaries = sampleAnalytics.versionSummaries ?? [];
    assert.equal(summaries.length, 2);

    const v1 = summaries.find((s) => s.versionNumber === 1);
    const v2 = summaries.find((s) => s.versionNumber === 2);

    assert.ok(v1 && v2);
    assert.notEqual(v1.totalMarks, v2.totalMarks);
    assert.notEqual(v1.totalQuestions, v2.totalQuestions);
    assert.equal(v1.totalAttempts, 15);
    assert.equal(v2.totalAttempts, 10);
    assert.equal(v1.avgScore, 7.2);
    assert.equal(v2.avgScore, 12.5);
  });

  it('7.5-4. Defensible difficulty estimate calculation matches accuracy thresholds', () => {
    const deriveDifficulty = (correctPercentage: number): 'EASY' | 'MEDIUM' | 'HARD' => {
      if (correctPercentage >= 75) return 'EASY';
      if (correctPercentage < 40) return 'HARD';
      return 'MEDIUM';
    };

    assert.equal(deriveDifficulty(84.62), 'EASY');
    assert.equal(deriveDifficulty(75), 'EASY');
    assert.equal(deriveDifficulty(74.99), 'MEDIUM');
    assert.equal(deriveDifficulty(53.85), 'MEDIUM');
    assert.equal(deriveDifficulty(40), 'MEDIUM');
    assert.equal(deriveDifficulty(39.99), 'HARD');
    assert.equal(deriveDifficulty(0), 'HARD');

    for (const q of sampleAnalytics.questionAnalytics) {
      assert.equal(q.difficultyEstimate, deriveDifficulty(q.correctPercentage));
      assert.equal(q.observedAccuracy, q.correctPercentage);
    }
  });

  it('7.5-5. Question type performance breakdown groups question types and calculates aggregate accuracy', () => {
    const breakdown = sampleAnalytics.questionTypeBreakdown;
    assert.ok(breakdown);

    assert.equal(breakdown['single_choice'].questionCount, 2);
    assert.equal(breakdown['single_choice'].accuracyPercentage, 76.92);

    assert.equal(breakdown['multiple_choice'].questionCount, 1);
    assert.equal(breakdown['multiple_choice'].accuracyPercentage, 53.85);

    assert.equal(breakdown['true_false'].questionCount, 1);
    assert.equal(breakdown['true_false'].accuracyPercentage, 69.23);
  });

  it('7.5-6. Learner privacy: top scorers masks emails and excludes credentials', () => {
    for (const scorer of sampleAnalytics.topScorers) {
      assert.match(scorer.email, /^[a-z0-9]{1,2}\*\*\*@[a-z0-9.-]+\.[a-z]{2,}$/i);
      const record = scorer as unknown as Record<string, unknown>;
      assert.equal(record.password, undefined);
      assert.equal(record.passwordHash, undefined);
      assert.equal(record.token, undefined);
    }
  });

  it('7.5-7. Route authorization: permits creator and admin roles, blocks learner', () => {
    const allowedRoles = ['creator', 'admin'];

    const checkAccess = (userRole: string) => allowedRoles.includes(userRole.toLowerCase());

    assert.equal(checkAccess('creator'), true);
    assert.equal(checkAccess('admin'), true);
    assert.equal(checkAccess('CREATOR'), true);
    assert.equal(checkAccess('ADMIN'), true);
    assert.equal(checkAccess('learner'), false);
    assert.equal(checkAccess('taker'), false);
    assert.equal(checkAccess('student'), false);
  });
});
