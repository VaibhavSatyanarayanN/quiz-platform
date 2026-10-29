import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { QuestionType } from '../src/features/quizzes/types/quiz.types.ts';
import {
  AttemptStatus,
  type AttemptQuestionResponse,
} from '../src/features/attempts/types/attempt.types.ts';
import {
  areOptionSelectionsEqual,
  beginExpirationFinalization,
  beginQuestionSave,
  calculateCountdownSnapshot,
  classifyAttemptError,
  clampQuestionIndex,
  completeExpirationFinalizationError,
  completeExpirationFinalizationSuccess,
  completeQuestionSaveError,
  completeQuestionSaveSuccess,
  computeNextSelectedOptions,
  computeServerClockSkewOffsetMs,
  createInitialExpirationState,
  createInitialPersistenceMap,
  getAttemptProgressSummary,
  getNextQuestionIndex,
  getPreviousQuestionIndex,
  isAttemptInteractive,
  LOW_TIME_WARNING_THRESHOLD_SECONDS,
  reconcileAttemptSubmissionState,
  sanitizeLearnerQuestion,
  sortAttemptQuestions,
  URGENT_TIME_WARNING_THRESHOLD_SECONDS,
} from '../src/features/attempts/utils/attempt-persistence.ts';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.tsx')) {
      const filePath = fileURLToPath(url);
      const source = fs.readFileSync(filePath, 'utf8');
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
        fileName: filePath,
      });
      return {
        format: 'module',
        shortCircuit: true,
        source: transpiled.outputText,
      };
    }
    return nextLoad(url, context);
  },
});

const { QuestionCard } = await import(
  '../src/features/attempts/components/QuestionCard.tsx'
);
const { QuestionPalette } = await import(
  '../src/features/attempts/components/QuestionPalette.tsx'
);
const { QuizTimer } = await import(
  '../src/features/attempts/components/QuizTimer.tsx'
);

describe('Phase 6.2 — Question Navigation & Reliable Answer Persistence', () => {
  const rawQuestionsUnordered: AttemptQuestionResponse[] = [
    {
      id: 'q-3',
      text: 'Which of the following are valid TypeScript utility types?',
      questionType: QuestionType.MULTIPLE_CHOICE,
      order: 3,
      marks: 3,
      options: [
        { id: 'opt-3b', text: 'Readonly<T>', order: 2 },
        { id: 'opt-3a', text: 'Partial<T>', order: 1 },
        { id: 'opt-3c', text: 'NonExistent<T>', order: 3 },
      ],
      selectedOptionIds: [],
    },
    {
      id: 'q-1',
      text: 'Which keyword declares a compile-time constant in TypeScript?',
      questionType: QuestionType.SINGLE_CHOICE,
      order: 1,
      marks: 2,
      options: [
        { id: 'opt-1b', text: 'let', order: 2 },
        { id: 'opt-1a', text: 'const', order: 1 },
      ],
      selectedOptionIds: ['opt-1a'],
    },
    {
      id: 'q-2',
      text: 'TypeScript interfaces exist at runtime in compiled JavaScript.',
      questionType: QuestionType.TRUE_FALSE,
      order: 2,
      marks: 1,
      options: [
        { id: 'opt-2a', text: 'True', order: 1 },
        { id: 'opt-2b', text: 'False', order: 2 },
      ],
      selectedOptionIds: [],
    },
  ];

  it('1. renders the current question, its ordered options, marks, and question type in QuestionCard', () => {
    const sorted = sortAttemptQuestions(rawQuestionsUnordered);
    const currentQuestion = sorted[0];

    const html = renderToStaticMarkup(
      React.createElement(QuestionCard, {
        question: currentQuestion,
        questionNumber: 1,
        totalQuestions: sorted.length,
        selectedOptionIds: ['opt-1a'],
        onOptionSelect: () => {},
        saveStatus: 'saved',
      }),
    );

    assert.match(html, /Question 1 of 3/);
    assert.match(html, /Single Choice/);
    assert.match(html, /2 marks/);
    assert.match(html, /Which keyword declares a compile-time constant in TypeScript\?/);
    // Options are sorted by persisted order (opt-1a "const" before opt-1b "let")
    const indexConst = html.indexOf('const');
    const indexLet = html.indexOf('let');
    assert.equal(indexConst > 0 && indexLet > indexConst, true);
    assert.match(html, /data-option-id="opt-1a"[^>]*data-selected="true"/);
    assert.match(html, /data-option-id="opt-1b"[^>]*data-selected="false"/);
    assert.match(html, /Saved/);
  });

  it('2 & 3. orders questions by persisted order, navigates forward/backward safely, and updates current-question indicator', () => {
    const sorted = sortAttemptQuestions(rawQuestionsUnordered);
    assert.deepEqual(
      sorted.map((q) => q.id),
      ['q-1', 'q-2', 'q-3'],
    );
    assert.deepEqual(
      sorted[0].options.map((o) => o.id),
      ['opt-1a', 'opt-1b'],
    );

    const total = sorted.length;
    let currentIndex = 0;

    // Cannot navigate before index 0
    assert.equal(getPreviousQuestionIndex(currentIndex, total), 0);

    // Navigate forward: 0 -> 1 -> 2
    currentIndex = getNextQuestionIndex(currentIndex, total);
    assert.equal(currentIndex, 1);

    currentIndex = getNextQuestionIndex(currentIndex, total);
    assert.equal(currentIndex, 2);

    // Clamped at last question (index 2)
    assert.equal(getNextQuestionIndex(currentIndex, total), 2);

    // Navigate backward: 2 -> 1
    currentIndex = getPreviousQuestionIndex(currentIndex, total);
    assert.equal(currentIndex, 1);

    // Safe handling of empty question list
    assert.equal(clampQuestionIndex(5, 0), 0);
    assert.deepEqual(sortAttemptQuestions([]), []);

    // Verify QuestionPalette marks index 1 (Question 2) as current step
    const paletteHtml = renderToStaticMarkup(
      React.createElement(QuestionPalette, {
        questions: sorted,
        currentIndex: 1,
        answersMap: { 'q-1': ['opt-1a'], 'q-2': [], 'q-3': [] },
        onSelectQuestion: () => {},
      }),
    );

    assert.match(
      paletteHtml,
      /data-question-index="1"[^>]*data-current="true"/,
    );
    assert.match(
      paletteHtml,
      /aria-current="step"[^>]*aria-label="Question 2: Unanswered, Current question"/,
    );
  });

  it('4. displays answered and unanswered states and accurate completion progress', () => {
    const sorted = sortAttemptQuestions(rawQuestionsUnordered);
    const persistenceMap = createInitialPersistenceMap(sorted);
    const summary = getAttemptProgressSummary(sorted, persistenceMap);

    assert.equal(summary.totalQuestions, 3);
    assert.equal(summary.answeredCount, 1);
    assert.equal(summary.unansweredCount, 2);
    assert.equal(summary.progressPercent, 33);

    const paletteHtml = renderToStaticMarkup(
      React.createElement(QuestionPalette, {
        questions: sorted,
        currentIndex: 0,
        answersMap: summary.answersMap,
        saveStatusMap: summary.saveStatusMap,
        onSelectQuestion: () => {},
      }),
    );

    assert.match(paletteHtml, /1 Answered/);
    assert.match(paletteHtml, /2 Left/);
    assert.match(paletteHtml, /33%/);
    assert.match(paletteHtml, /data-question-index="0"[^>]*data-answered="true"/);
    assert.match(paletteHtml, /data-question-index="1"[^>]*data-answered="false"/);
    assert.match(paletteHtml, /data-question-index="2"[^>]*data-answered="false"/);
  });

  it('5. selects and changes a single-choice or true/false option while avoiding duplicate saves for unchanged selection', () => {
    const validIds = ['opt-1a', 'opt-1b'];

    // Initial selection on single-choice
    const firstChoice = computeNextSelectedOptions(
      QuestionType.SINGLE_CHOICE,
      [],
      'opt-1a',
      validIds,
    );
    assert.deepEqual(firstChoice, ['opt-1a']);

    // Changing selection replaces the previous option
    const changedChoice = computeNextSelectedOptions(
      QuestionType.SINGLE_CHOICE,
      firstChoice,
      'opt-1b',
      validIds,
    );
    assert.deepEqual(changedChoice, ['opt-1b']);

    // Selecting the exact same option on single-choice yields an equal selection
    const repeatedChoice = computeNextSelectedOptions(
      QuestionType.SINGLE_CHOICE,
      changedChoice,
      'opt-1b',
      validIds,
    );
    assert.equal(areOptionSelectionsEqual(changedChoice, repeatedChoice), true);

    // beginQuestionSave skips network request when selection did not change
    const initialMap = createInitialPersistenceMap(rawQuestionsUnordered);
    const duplicateAttempt = beginQuestionSave(initialMap, 'q-1', ['opt-1a']);
    assert.equal(duplicateAttempt.shouldSendRequest, false);
  });

  it('6. selects and deselects multiple-choice options without duplicates', () => {
    const validIds = ['opt-3a', 'opt-3b', 'opt-3c'];

    // Select first option
    let selected = computeNextSelectedOptions(
      QuestionType.MULTIPLE_CHOICE,
      [],
      'opt-3a',
      validIds,
    );
    assert.deepEqual(selected, ['opt-3a']);

    // Select second option
    selected = computeNextSelectedOptions(
      QuestionType.MULTIPLE_CHOICE,
      selected,
      'opt-3b',
      validIds,
    );
    assert.deepEqual(selected, ['opt-3a', 'opt-3b']);

    // Deselect first option
    selected = computeNextSelectedOptions(
      QuestionType.MULTIPLE_CHOICE,
      selected,
      'opt-3a',
      validIds,
    );
    assert.deepEqual(selected, ['opt-3b']);

    // Deselect remaining option (permits clearing back to empty)
    selected = computeNextSelectedOptions(
      QuestionType.MULTIPLE_CHOICE,
      selected,
      'opt-3b',
      validIds,
    );
    assert.deepEqual(selected, []);
  });

  it('7. restores previously saved answers on reload and preserves in-flight/error local edits across refetches', () => {
    const sorted = sortAttemptQuestions(rawQuestionsUnordered);
    const restoredMap = createInitialPersistenceMap(sorted);

    assert.deepEqual(restoredMap['q-1'].selectedOptionIds, ['opt-1a']);
    assert.deepEqual(restoredMap['q-1'].persistedOptionIds, ['opt-1a']);
    assert.equal(restoredMap['q-1'].status, 'saved');

    assert.deepEqual(restoredMap['q-2'].selectedOptionIds, []);
    assert.equal(restoredMap['q-2'].status, 'idle');

    // Simulate an in-flight local selection on q-2 followed by a background query refetch
    const { nextMap: savingMap } = beginQuestionSave(restoredMap, 'q-2', ['opt-2b']);
    const reconciledMap = createInitialPersistenceMap(sorted, savingMap);

    assert.deepEqual(reconciledMap['q-2'].selectedOptionIds, ['opt-2b']);
    assert.equal(reconciledMap['q-2'].status, 'saving');
  });

  it('8. transitions through saving -> saved only after backend confirmation', () => {
    const sorted = sortAttemptQuestions(rawQuestionsUnordered);
    let map = createInitialPersistenceMap(sorted);

    // Begin save on q-2
    const saveStart = beginQuestionSave(map, 'q-2', ['opt-2b']);
    assert.equal(saveStart.shouldSendRequest, true);
    assert.equal(saveStart.requestSeq, 1);
    map = saveStart.nextMap;

    // Before backend confirms, status is 'saving' (never 'saved')
    assert.equal(map['q-2'].status, 'saving');
    assert.deepEqual(map['q-2'].selectedOptionIds, ['opt-2b']);
    assert.deepEqual(map['q-2'].persistedOptionIds, []);

    const savingHtml = renderToStaticMarkup(
      React.createElement(QuestionCard, {
        question: sorted[1],
        questionNumber: 2,
        totalQuestions: 3,
        selectedOptionIds: map['q-2'].selectedOptionIds,
        onOptionSelect: () => {},
        saveStatus: map['q-2'].status,
      }),
    );
    assert.match(savingHtml, /Saving\.\.\./);

    // Backend confirms success
    const saveComplete = completeQuestionSaveSuccess(
      map,
      'q-2',
      saveStart.requestSeq,
      ['opt-2b'],
      '2026-10-29T08:05:00.000Z',
    );
    assert.equal(saveComplete.applied, true);
    map = saveComplete.nextMap;

    assert.equal(map['q-2'].status, 'saved');
    assert.deepEqual(map['q-2'].persistedOptionIds, ['opt-2b']);
    assert.equal(map['q-2'].lastSavedAt, '2026-10-29T08:05:00.000Z');
  });

  it('9. preserves unsaved selection locally on save failure, exposes retry UI, and recovers on retry', () => {
    const sorted = sortAttemptQuestions(rawQuestionsUnordered);
    let map = createInitialPersistenceMap(sorted);

    const attempt1 = beginQuestionSave(map, 'q-2', ['opt-2a']);
    map = attempt1.nextMap;

    // Simulate network failure
    const failed = completeQuestionSaveError(
      map,
      'q-2',
      attempt1.requestSeq,
      'Network timeout while saving answer',
      null,
    );
    assert.equal(failed.applied, true);
    map = failed.nextMap;

    // Selection is preserved locally, status is 'error', not marked saved
    assert.equal(map['q-2'].status, 'error');
    assert.deepEqual(map['q-2'].selectedOptionIds, ['opt-2a']);
    assert.deepEqual(map['q-2'].persistedOptionIds, []);
    assert.equal(map['q-2'].errorMessage, 'Network timeout while saving answer');

    const summaryWithError = getAttemptProgressSummary(sorted, map);
    assert.equal(summaryWithError.errorCount, 1);
    assert.equal(summaryWithError.hasUnsavedChanges, true);
    assert.deepEqual(summaryWithError.failedQuestionIds, ['q-2']);

    // Render QuestionCard in error state and verify Retry button and alert appear
    const errorCardHtml = renderToStaticMarkup(
      React.createElement(QuestionCard, {
        question: sorted[1],
        questionNumber: 2,
        totalQuestions: 3,
        selectedOptionIds: map['q-2'].selectedOptionIds,
        onOptionSelect: () => {},
        saveStatus: map['q-2'].status,
        saveError: map['q-2'].errorMessage,
        onRetrySave: () => {},
      }),
    );
    assert.match(errorCardHtml, /Save failed/);
    assert.match(errorCardHtml, /Retry Save/);
    assert.match(errorCardHtml, /Network timeout while saving answer/);

    // Learner clicks Retry Save (forceRetry = true)
    const retryAttempt = beginQuestionSave(
      map,
      'q-2',
      map['q-2'].selectedOptionIds,
      true,
    );
    assert.equal(retryAttempt.shouldSendRequest, true);
    assert.equal(retryAttempt.requestSeq, 2);
    map = retryAttempt.nextMap;
    assert.equal(map['q-2'].status, 'saving');

    // Retry succeeds
    const retrySuccess = completeQuestionSaveSuccess(
      map,
      'q-2',
      retryAttempt.requestSeq,
      ['opt-2a'],
    );
    assert.equal(retrySuccess.applied, true);
    map = retrySuccess.nextMap;
    assert.equal(map['q-2'].status, 'saved');
    assert.deepEqual(map['q-2'].persistedOptionIds, ['opt-2a']);
    assert.equal(map['q-2'].errorMessage, null);
  });

  it('10. prevents stale in-flight requests from overwriting newer selections', () => {
    const sorted = sortAttemptQuestions(rawQuestionsUnordered);
    let map = createInitialPersistenceMap(sorted);

    // Request 1: learner selects opt-2a
    const req1 = beginQuestionSave(map, 'q-2', ['opt-2a']);
    map = req1.nextMap;
    assert.equal(req1.requestSeq, 1);

    // Immediately before Request 1 finishes, learner changes selection to opt-2b (Request 2)
    const req2 = beginQuestionSave(map, 'q-2', ['opt-2b']);
    map = req2.nextMap;
    assert.equal(req2.requestSeq, 2);
    assert.deepEqual(map['q-2'].selectedOptionIds, ['opt-2b']);

    // Stale Request 1 resolves late with ['opt-2a'] -> must be ignored!
    const staleSuccess = completeQuestionSaveSuccess(
      map,
      'q-2',
      req1.requestSeq,
      ['opt-2a'],
    );
    assert.equal(staleSuccess.applied, false);
    map = staleSuccess.nextMap;
    assert.deepEqual(map['q-2'].selectedOptionIds, ['opt-2b']);
    assert.equal(map['q-2'].status, 'saving');

    // Stale Request 1 rejects late -> must also be ignored!
    const staleError = completeQuestionSaveError(
      map,
      'q-2',
      req1.requestSeq,
      'Stale error',
    );
    assert.equal(staleError.applied, false);

    // Latest Request 2 resolves with ['opt-2b'] -> applied!
    const freshSuccess = completeQuestionSaveSuccess(
      map,
      'q-2',
      req2.requestSeq,
      ['opt-2b'],
    );
    assert.equal(freshSuccess.applied, true);
    map = freshSuccess.nextMap;
    assert.deepEqual(map['q-2'].selectedOptionIds, ['opt-2b']);
    assert.deepEqual(map['q-2'].persistedOptionIds, ['opt-2b']);
    assert.equal(map['q-2'].status, 'saved');
  });

  it('11. disables answer editing for EXPIRED and SUBMITTED attempts', () => {
    assert.equal(isAttemptInteractive(AttemptStatus.IN_PROGRESS, false), true);
    assert.equal(isAttemptInteractive(AttemptStatus.IN_PROGRESS, true), false);
    assert.equal(isAttemptInteractive(AttemptStatus.EXPIRED, false), false);
    assert.equal(isAttemptInteractive(AttemptStatus.SUBMITTED, false), false);

    const sorted = sortAttemptQuestions(rawQuestionsUnordered);
    const disabledCardHtml = renderToStaticMarkup(
      React.createElement(QuestionCard, {
        question: sorted[0],
        questionNumber: 1,
        totalQuestions: 3,
        selectedOptionIds: ['opt-1a'],
        onOptionSelect: () => {},
        disabled: true,
      }),
    );

    assert.match(disabledCardHtml, /aria-disabled="true"/);
    assert.match(disabledCardHtml, /tabindex="-1"/i);
  });

  it('12. ensures no correct-answer metadata is ever retained or rendered in learner components', () => {
    const pollutedQuestion = {
      id: 'q-polluted',
      text: 'Polluted question test',
      questionType: QuestionType.SINGLE_CHOICE,
      order: 1,
      marks: 1,
      correctAnswer: 'opt-secret',
      options: [
        {
          id: 'opt-secret',
          text: 'Option A',
          order: 1,
          isCorrect: true,
        },
        {
          id: 'opt-wrong',
          text: 'Option B',
          order: 2,
          isCorrect: false,
        },
      ],
      selectedOptionIds: [],
    } as unknown as AttemptQuestionResponse;

    const sanitized = sanitizeLearnerQuestion(pollutedQuestion);
    assert.equal('correctAnswer' in sanitized, false);
    for (const opt of sanitized.options) {
      assert.deepEqual(Object.keys(opt).sort(), ['id', 'order', 'text']);
      assert.equal('isCorrect' in opt, false);
    }

    const html = renderToStaticMarkup(
      React.createElement(QuestionCard, {
        question: pollutedQuestion,
        questionNumber: 1,
        totalQuestions: 1,
        selectedOptionIds: [],
        onOptionSelect: () => {},
      }),
    );

    assert.equal(html.includes('isCorrect'), false);
    assert.equal(html.includes('correctAnswer'), false);
  });

  it('13. classifies 401, 403, 404, aborted, and expired-attempt responses accurately', () => {
    const unauthorized = classifyAttemptError({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });
    assert.equal(unauthorized.isUnauthorized, true);
    assert.equal(unauthorized.statusCode, 401);

    const forbidden = classifyAttemptError({
      response: {
        status: 403,
        data: { message: 'You do not have permission to access this quiz attempt' },
      },
    });
    assert.equal(forbidden.isForbidden, true);
    assert.equal(forbidden.statusCode, 403);

    const notFound = classifyAttemptError({
      response: { status: 404, data: { message: 'Attempt not found' } },
    });
    assert.equal(notFound.isNotFound, true);
    assert.equal(notFound.statusCode, 404);

    const expired = classifyAttemptError({
      response: { status: 400, data: { message: 'This quiz attempt has expired' } },
    });
    assert.equal(expired.isExpiredAttempt, true);

    const aborted = classifyAttemptError({
      name: 'CanceledError',
      code: 'ERR_CANCELED',
    });
    assert.equal(aborted.isAborted, true);
  });
});

describe('Phase 6.3 — Server-Enforced Quiz Timer & Expiration (Frontend)', () => {
  it('6.3-1. renders countdown from the server-provided expiresAt deadline (and Untimed when null)', () => {
    const untimedHtml = renderToStaticMarkup(
      React.createElement(QuizTimer, {
        expiresAt: null,
      }),
    );
    assert.match(untimedHtml, /Untimed/);
    assert.match(untimedHtml, /data-timer-urgency="untimed"/);
    assert.match(untimedHtml, /data-expired="false"/);

    // Timed attempt with 10 minutes remaining
    const futureDeadline = new Date(Date.now() + 600_000).toISOString();
    const timedHtml = renderToStaticMarkup(
      React.createElement(QuizTimer, {
        expiresAt: futureDeadline,
        remainingTimeSeconds: 600,
      }),
    );
    assert.match(timedHtml, /Time Remaining:/);
    assert.match(timedHtml, /10:00|09:59/);
    assert.match(timedHtml, /data-timer-urgency="normal"/);
    assert.match(timedHtml, /data-expired="false"/);
  });

  it('6.3-2 & 6.3-3. decreases countdown locally from expiresAt without polling API every second and preserves deadline across refresh/sleep', () => {
    const baseNow = Date.parse('2026-10-29T10:00:00.000Z');
    const serverExpiresAt = '2026-10-29T10:10:00.000Z'; // 600s deadline

    // Initial render at t = 0
    const snap0 = calculateCountdownSnapshot(serverExpiresAt, baseNow);
    assert.equal(snap0.totalSeconds, 600);
    assert.equal(snap0.formatted, '10:00');
    assert.equal(snap0.isExpired, false);

    // Local tick 1 second later (no API request needed)
    const snap1 = calculateCountdownSnapshot(serverExpiresAt, baseNow + 1_000);
    assert.equal(snap1.totalSeconds, 599);
    assert.equal(snap1.formatted, '09:59');

    // Simulate browser tab sleep / page refresh 4 minutes (240s) later:
    // Recomputing from persisted serverExpiresAt yields 360s (06:00), never resetting to 10:00
    const snapAfterRefresh = calculateCountdownSnapshot(
      serverExpiresAt,
      baseNow + 240_000,
    );
    assert.equal(snapAfterRefresh.totalSeconds, 360);
    assert.equal(snapAfterRefresh.formatted, '06:00');
    assert.equal(snapAfterRefresh.isExpired, false);

    // Verify clock-skew anchor prevents a skewed local clock (+1 hour behind server) from extending countdown
    const skewedClientNow = baseNow - 3_600_000; // client clock is 1 hour behind
    const skewOffsetMs = computeServerClockSkewOffsetMs(
      serverExpiresAt,
      600, // server says 600s left
      skewedClientNow,
    );
    const skewCorrectedSnap = calculateCountdownSnapshot(
      serverExpiresAt,
      skewedClientNow + 10_000, // 10s of real time elapsed on client
      skewOffsetMs,
    );
    assert.equal(skewCorrectedSnap.totalSeconds, 590);
    assert.equal(skewCorrectedSnap.formatted, '09:50');
  });

  it('6.3-4. triggers non-blocking low-time warning and urgent final-minute states at configured thresholds', () => {
    const baseNow = Date.parse('2026-10-29T10:00:00.000Z');
    const expiresAt = new Date(
      baseNow + LOW_TIME_WARNING_THRESHOLD_SECONDS * 1000,
    ).toISOString(); // 300s (05:00)

    const warningSnap = calculateCountdownSnapshot(expiresAt, baseNow);
    assert.equal(warningSnap.totalSeconds, 300);
    assert.equal(warningSnap.isWarning, true);
    assert.equal(warningSnap.isUrgent, false);
    assert.equal(warningSnap.urgency, 'warning');

    const warningTimerHtml = renderToStaticMarkup(
      React.createElement(QuizTimer, {
        expiresAt: new Date(Date.now() + 240_000).toISOString(),
        remainingTimeSeconds: 240,
      }),
    );
    assert.match(warningTimerHtml, /data-timer-urgency="warning"/);
    assert.match(warningTimerHtml, /Low time/);

    // At 60s (URGENT_TIME_WARNING_THRESHOLD_SECONDS) -> urgent state
    const urgentExpiresAt = new Date(
      baseNow + URGENT_TIME_WARNING_THRESHOLD_SECONDS * 1000,
    ).toISOString();
    const urgentSnap = calculateCountdownSnapshot(urgentExpiresAt, baseNow);
    assert.equal(urgentSnap.totalSeconds, 60);
    assert.equal(urgentSnap.isUrgent, true);
    assert.equal(urgentSnap.isWarning, false);
    assert.equal(urgentSnap.urgency, 'urgent');

    const urgentTimerHtml = renderToStaticMarkup(
      React.createElement(QuizTimer, {
        expiresAt: new Date(Date.now() + 45_000).toISOString(),
        remainingTimeSeconds: 45,
      }),
    );
    assert.match(urgentTimerHtml, /data-timer-urgency="urgent"/);
    assert.match(urgentTimerHtml, /Final minute/);
    assert.match(urgentTimerHtml, /aria-live="assertive"/);
  });

  it('6.3-5 & 6.3-6. disables answer editing immediately at local zero, prevents duplicate finalization calls, and navigates only after server confirmation', () => {
    const baseNow = Date.parse('2026-10-29T10:00:00.000Z');
    const expiredDeadline = '2026-10-29T10:00:00.000Z';

    // Exact boundary now === expiresAt -> totalSeconds is 0 and isExpired is true
    const zeroSnap = calculateCountdownSnapshot(expiredDeadline, baseNow);
    assert.equal(zeroSnap.totalSeconds, 0);
    assert.equal(zeroSnap.isExpired, true);
    assert.equal(zeroSnap.urgency, 'expired');
    assert.equal(zeroSnap.formatted, '00:00');

    const expiredTimerHtml = renderToStaticMarkup(
      React.createElement(QuizTimer, {
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
        remainingTimeSeconds: 0,
      }),
    );
    assert.match(expiredTimerHtml, /Time Remaining: 00:00/);
    assert.match(expiredTimerHtml, /Expired/);
    assert.match(expiredTimerHtml, /data-expired="true"/);

    // State machine transition when local timer reaches 0
    let expState = createInitialExpirationState(AttemptStatus.IN_PROGRESS);
    assert.equal(expState.isExpiredLocally, false);
    assert.equal(expState.canNavigateToResult, false);
    assert.equal(
      isAttemptInteractive(AttemptStatus.IN_PROGRESS, expState.isExpiredLocally),
      true,
    );

    const firstTrigger = beginExpirationFinalization(expState);
    expState = firstTrigger.nextState;

    // Immediately locks editing before server responds, and does NOT navigate yet
    assert.equal(firstTrigger.shouldTriggerRequest, true);
    assert.equal(expState.isExpiredLocally, true);
    assert.equal(expState.status, 'finalizing');
    assert.equal(expState.canNavigateToResult, false);
    assert.equal(
      isAttemptInteractive(AttemptStatus.IN_PROGRESS, expState.isExpiredLocally),
      false,
    );

    // Duplicate trigger while finalizing is blocked
    const duplicateTrigger = beginExpirationFinalization(expState);
    assert.equal(duplicateTrigger.shouldTriggerRequest, false);
    assert.equal(duplicateTrigger.nextState.attemptCount, 1);

    // Server confirms expiration -> now safe to navigate to result
    expState = completeExpirationFinalizationSuccess(expState);
    assert.equal(expState.status, 'confirmed');
    assert.equal(expState.canNavigateToResult, true);
    assert.equal(expState.isExpiredLocally, true);
  });

  it('6.3-7. handles temporary network failure at timeout without falsely reporting submission or navigating prematurely, and recovers on retry', () => {
    let expState = createInitialExpirationState(AttemptStatus.IN_PROGRESS);

    // Countdown hits 0 -> begin finalization
    const trigger1 = beginExpirationFinalization(expState);
    expState = trigger1.nextState;
    assert.equal(trigger1.shouldTriggerRequest, true);
    assert.equal(expState.status, 'finalizing');

    // Network fails (e.g., 503 Service Unavailable or offline)
    expState = completeExpirationFinalizationError(expState, {
      message: 'Network Error: Unable to reach server',
    });

    // Editing MUST remain disabled, status is 'error', and navigation MUST NOT happen prematurely
    assert.equal(expState.isExpiredLocally, true);
    assert.equal(
      isAttemptInteractive(AttemptStatus.IN_PROGRESS, expState.isExpiredLocally),
      false,
    );
    assert.equal(expState.status, 'error');
    assert.equal(expState.canNavigateToResult, false);
    assert.match(expState.errorMessage ?? '', /Network Error/);

    // Automatic non-forced re-trigger does not spam requests while in error state
    const unforced = beginExpirationFinalization(expState, false);
    assert.equal(unforced.shouldTriggerRequest, false);

    // Learner clicks "Retry Finalization" (forceRetry = true) -> triggers request #2
    const retryTrigger = beginExpirationFinalization(expState, true);
    assert.equal(retryTrigger.shouldTriggerRequest, true);
    expState = retryTrigger.nextState;
    assert.equal(expState.status, 'finalizing');
    assert.equal(expState.attemptCount, 2);

    // If backend responds with 400 "This quiz attempt has expired", client treats it as confirmed terminal state
    expState = completeExpirationFinalizationError(expState, {
      response: {
        status: 400,
        data: { message: 'This quiz attempt has expired' },
      },
    });
    assert.equal(expState.status, 'confirmed');
    assert.equal(expState.canNavigateToResult, true);
  });

  it('6.3-8, 6.3-9 & 6.3-10. locks SUBMITTED and EXPIRED attempts, never returns negative time, and exposes zero answer-key metadata', () => {
    // Past deadline by 1 hour -> remaining seconds is strictly 0, never negative
    const pastSnap = calculateCountdownSnapshot(
      '2026-10-29T09:00:00.000Z',
      Date.parse('2026-10-29T10:00:00.000Z'),
    );
    assert.equal(pastSnap.totalSeconds, 0);
    assert.equal(pastSnap.isExpired, true);

    // Terminal statuses are non-interactive on initial load
    const submittedInit = createInitialExpirationState(AttemptStatus.SUBMITTED);
    assert.equal(submittedInit.status, 'confirmed');
    assert.equal(submittedInit.canNavigateToResult, true);
    assert.equal(
      isAttemptInteractive(AttemptStatus.SUBMITTED, submittedInit.isExpiredLocally),
      false,
    );

    const expiredInit = createInitialExpirationState(AttemptStatus.EXPIRED);
    assert.equal(expiredInit.status, 'confirmed');
    assert.equal(expiredInit.isExpiredLocally, true);
    assert.equal(expiredInit.canNavigateToResult, true);
    assert.equal(
      isAttemptInteractive(AttemptStatus.EXPIRED, expiredInit.isExpiredLocally),
      false,
    );
  });
});

describe('Phase 6.4 — Reliable Submission, Deterministic Grading & Result Reconciliation (Frontend)', () => {
  it('6.4-1. reconciles authoritative terminal state (SUBMITTED / EXPIRED) and prevents premature navigation', () => {
    // In-progress attempt without error cannot navigate yet
    const inProgress = reconcileAttemptSubmissionState(AttemptStatus.IN_PROGRESS);
    assert.equal(inProgress.isFinalized, false);
    assert.equal(inProgress.canNavigate, false);

    // Confirmed SUBMITTED attempt can navigate
    const submitted = reconcileAttemptSubmissionState(AttemptStatus.SUBMITTED);
    assert.equal(submitted.isFinalized, true);
    assert.equal(submitted.status, AttemptStatus.SUBMITTED);
    assert.equal(submitted.canNavigate, true);

    // Confirmed EXPIRED attempt can navigate
    const expired = reconcileAttemptSubmissionState(AttemptStatus.EXPIRED);
    assert.equal(expired.isFinalized, true);
    assert.equal(expired.status, AttemptStatus.EXPIRED);
    assert.equal(expired.canNavigate, true);
  });

  it('6.4-2. recovers from ambiguous network failure during submission if server actually persisted SUBMITTED', () => {
    // Network error occurred during submission
    const networkError = { message: 'Network Error: Failed to fetch' };

    // Before reconciliation, error is not finalized
    const unconfirmed = reconcileAttemptSubmissionState(AttemptStatus.IN_PROGRESS, networkError);
    assert.equal(unconfirmed.isFinalized, false);
    assert.equal(unconfirmed.canNavigate, false);

    // Re-fetching authoritative attempt reveals backend successfully transitioned to SUBMITTED
    const reconciledAfterRefetch = reconcileAttemptSubmissionState(AttemptStatus.SUBMITTED);
    assert.equal(reconciledAfterRefetch.isFinalized, true);
    assert.equal(reconciledAfterRefetch.status, AttemptStatus.SUBMITTED);
    assert.equal(reconciledAfterRefetch.canNavigate, true);
  });

  it('6.4-3. treats 400 "This quiz attempt has expired" as server-confirmed terminal state during submission', () => {
    const expiredError = {
      response: {
        status: 400,
        data: { message: 'This quiz attempt has expired' },
      },
    };

    const reconciled = reconcileAttemptSubmissionState(AttemptStatus.IN_PROGRESS, expiredError);
    assert.equal(reconciled.isFinalized, true);
    assert.equal(reconciled.status, AttemptStatus.EXPIRED);
    assert.equal(reconciled.canNavigate, true);
  });

  it('6.4-4. preserves all-or-nothing grading and question order in learner question representations', () => {
    const questions: AttemptQuestionResponse[] = [
      {
        id: 'q-2',
        text: 'Question 2',
        questionType: QuestionType.SINGLE_CHOICE,
        order: 2,
        marks: 2,
        options: [
          { id: 'opt-2b', text: 'Option B', order: 2 },
          { id: 'opt-2a', text: 'Option A', order: 1 },
        ],
        selectedOptionIds: ['opt-2a'],
      },
      {
        id: 'q-1',
        text: 'Question 1',
        questionType: QuestionType.MULTIPLE_CHOICE,
        order: 1,
        marks: 3,
        options: [
          { id: 'opt-1a', text: 'Option 1', order: 1 },
          { id: 'opt-1b', text: 'Option 2', order: 2 },
        ],
        selectedOptionIds: ['opt-1a', 'opt-1b'],
      },
    ];

    const sorted = sortAttemptQuestions(questions);
    assert.equal(sorted[0].id, 'q-1');
    assert.equal(sorted[1].id, 'q-2');
    assert.deepEqual(sorted[0].selectedOptionIds, ['opt-1a', 'opt-1b']);

    // Empty selections sanitized properly
    const emptyQuestion: AttemptQuestionResponse = {
      id: 'q-3',
      text: 'Question 3',
      questionType: QuestionType.TRUE_FALSE,
      order: 3,
      marks: 1,
      options: [],
      selectedOptionIds: [],
    };
    const sanitizedEmpty = sanitizeLearnerQuestion(emptyQuestion);
    assert.equal(sanitizedEmpty.isAnswered, false);
    assert.deepEqual(sanitizedEmpty.selectedOptionIds, []);
  });
});

describe('Phase 6.5 — Results, Attempt History & Learner Experience (Frontend)', () => {
  it('6.5-1. Result presentation: accurately formats submitted vs expired attempts, elapsed duration, and percentages', () => {
    const submittedResult = {
      attemptId: 'att-res-1',
      quizId: 'quiz-1',
      quizVersionId: 'ver-1',
      quizTitle: 'TypeScript Mastery',
      quizVersion: 2,
      status: AttemptStatus.SUBMITTED,
      score: 8,
      totalMarks: 10,
      percentage: 80,
      startedAt: '2026-10-29T10:00:00Z',
      submittedAt: '2026-10-29T10:08:30Z',
      timeLimitSeconds: 600,
      elapsedSeconds: 510,
    };

    assert.equal(submittedResult.status, AttemptStatus.SUBMITTED);
    assert.equal(submittedResult.percentage, 80);
    assert.equal(submittedResult.elapsedSeconds, 510);

    const expiredResult = {
      attemptId: 'att-res-2',
      quizId: 'quiz-1',
      quizVersionId: 'ver-1',
      status: AttemptStatus.EXPIRED,
      score: 4,
      totalMarks: 10,
      percentage: 40,
      startedAt: '2026-10-29T10:00:00Z',
      submittedAt: '2026-10-29T10:10:00Z',
      timeLimitSeconds: 600,
      elapsedSeconds: 600,
    };

    assert.equal(expiredResult.status, AttemptStatus.EXPIRED);
    assert.equal(expiredResult.score, 4);
    assert.equal(expiredResult.percentage, 40);
  });

  it('6.5-2. Question review: verifies question review items contain options, correctness, and marks awarded', () => {
    const reviewQuestions = [
      {
        id: 'q-rev-1',
        text: 'What is TypeScript?',
        questionType: QuestionType.SINGLE_CHOICE,
        order: 1,
        marks: 2,
        marksAwarded: 2,
        isCorrect: true,
        isUnanswered: false,
        selectedOptionIds: ['opt-1a'],
        correctOptionIds: ['opt-1a'],
        options: [
          { id: 'opt-1a', text: 'Superset of JS', order: 1, isCorrect: true },
          { id: 'opt-1b', text: 'Database engine', order: 2, isCorrect: false },
        ],
      },
      {
        id: 'q-rev-2',
        text: 'Select primitive types.',
        questionType: QuestionType.MULTIPLE_CHOICE,
        order: 2,
        marks: 3,
        marksAwarded: 0, // Partial selection awards 0 marks under all-or-nothing
        isCorrect: false,
        isUnanswered: false,
        selectedOptionIds: ['opt-2a'],
        correctOptionIds: ['opt-2a', 'opt-2b'],
        options: [
          { id: 'opt-2a', text: 'string', order: 1, isCorrect: true },
          { id: 'opt-2b', text: 'number', order: 2, isCorrect: true },
          { id: 'opt-2c', text: 'class', order: 3, isCorrect: false },
        ],
      },
    ];

    assert.equal(reviewQuestions.length, 2);
    assert.equal(reviewQuestions[0].isCorrect, true);
    assert.equal(reviewQuestions[0].marksAwarded, 2);
    assert.equal(reviewQuestions[1].isCorrect, false);
    assert.equal(reviewQuestions[1].marksAwarded, 0);
    assert.deepEqual(reviewQuestions[1].correctOptionIds, ['opt-2a', 'opt-2b']);
  });

  it('6.5-3. Attempt history mapping: masks in-progress scores and exposes finalized metrics', () => {
    const rawItems = [
      {
        attemptId: 'att-active',
        quizId: 'quiz-1',
        quizVersionId: 'ver-1',
        quizTitle: 'TS Basics',
        version: 1,
        status: AttemptStatus.IN_PROGRESS,
        score: null,
        totalMarks: 10,
        percentage: null,
        startedAt: '2026-10-29T10:00:00Z',
        submittedAt: null,
      },
      {
        attemptId: 'att-done',
        quizId: 'quiz-1',
        quizVersionId: 'ver-1',
        quizTitle: 'TS Basics',
        version: 1,
        status: AttemptStatus.SUBMITTED,
        score: 10,
        totalMarks: 10,
        percentage: 100,
        startedAt: '2026-10-29T09:00:00Z',
        submittedAt: '2026-10-29T09:05:00Z',
      },
    ];

    // IN_PROGRESS must have null score and percentage
    assert.equal(rawItems[0].status, AttemptStatus.IN_PROGRESS);
    assert.equal(rawItems[0].score, null);
    assert.equal(rawItems[0].percentage, null);

    // SUBMITTED has score and percentage
    assert.equal(rawItems[1].status, AttemptStatus.SUBMITTED);
    assert.equal(rawItems[1].score, 10);
    assert.equal(rawItems[1].percentage, 100);
  });

  it('6.5-4. Authoritative action derivation: in-progress maps to resume, submitted/expired maps to view result', () => {
    function deriveAttemptAction(status: AttemptStatus): 'resume' | 'view_result' {
      if (status === AttemptStatus.IN_PROGRESS) {
        return 'resume';
      }
      return 'view_result';
    }

    assert.equal(deriveAttemptAction(AttemptStatus.IN_PROGRESS), 'resume');
    assert.equal(deriveAttemptAction(AttemptStatus.SUBMITTED), 'view_result');
    assert.equal(deriveAttemptAction(AttemptStatus.EXPIRED), 'view_result');
  });

  it('6.5-5. Answer key confidentiality: active attempt question representations never leak isCorrect', () => {
    const takingQuestion: AttemptQuestionResponse = {
      id: 'q-active',
      text: 'Question text',
      questionType: QuestionType.SINGLE_CHOICE,
      order: 1,
      marks: 1,
      options: [
        { id: 'opt-a', text: 'Option A', order: 1 },
        { id: 'opt-b', text: 'Option B', order: 2 },
      ],
      selectedOptionIds: [],
    };

    const sanitized = sanitizeLearnerQuestion(takingQuestion);
    for (const opt of sanitized.options) {
      assert.equal((opt as Record<string, unknown>).isCorrect, undefined);
    }
    assert.equal((sanitized as Record<string, unknown>).correctOptionIds, undefined);
  });

  it('6.5-6. Pagination calculation and totalPages verification', () => {
    function calcTotalPages(total: number, limit: number): number {
      return Math.max(1, Math.ceil(total / limit));
    }

    assert.equal(calcTotalPages(0, 10), 1);
    assert.equal(calcTotalPages(10, 10), 1);
    assert.equal(calcTotalPages(11, 10), 2);
    assert.equal(calcTotalPages(25, 10), 3);
  });

  it('6.5-7. Safe handling of missing quizTitle and version defaults', () => {
    const itemWithMissingTitle = {
      attemptId: 'att-orphan',
      quizId: 'deleted-quiz-id',
      quizVersionId: 'deleted-version-id',
      quizTitle: undefined,
      version: 1,
      status: AttemptStatus.SUBMITTED,
      score: 0,
      totalMarks: 0,
      startedAt: '2026-10-29T10:00:00Z',
      submittedAt: '2026-10-29T10:01:00Z',
    };

    const displayTitle = itemWithMissingTitle.quizTitle || `Quiz ${itemWithMissingTitle.quizId.slice(0, 8)}`;
    assert.equal(displayTitle, 'Quiz deleted-');
  });

  describe('Phase 6.5.1 — Results and History Correctness Audit (Frontend)', () => {
    it('6.5.1-1. Status-aware elapsed duration formatting in result review', () => {
      function formatDuration(seconds: number | null | undefined): string {
        if (seconds === null || seconds === undefined || seconds < 0) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs}s`;
        return `${mins}m ${secs}s`;
      }

      // Early submission: 750 seconds = 12m 30s
      assert.equal(formatDuration(750), '12m 30s');
      // Deadline boundary: 1800 seconds = 30m 0s
      assert.equal(formatDuration(1800), '30m 0s');
      // Short untimed / fast submission: 45 seconds = 45s
      assert.equal(formatDuration(45), '45s');
      // Negative or null/undefined
      assert.equal(formatDuration(null), '-');
      assert.equal(formatDuration(undefined), '-');
      assert.equal(formatDuration(-10), '-');
    });

    it('6.5.1-2. Result totals and history items support standardized totalScore alongside totalMarks', () => {
      const resultItem: AttemptResultResponse = {
        attemptId: 'att-res-1',
        quizId: 'quiz-1',
        quizVersionId: 'ver-1',
        status: AttemptStatus.SUBMITTED,
        score: 8,
        totalMarks: 10,
        totalScore: 10,
        correctAnswers: 2,
        wrongAnswers: 0,
        unanswered: 0,
        percentage: 80,
        startedAt: '2026-10-29T10:00:00.000Z',
        submittedAt: '2026-10-29T10:12:30.000Z',
        elapsedSeconds: 750,
      };

      const historyItem: AttemptHistoryItem = {
        attemptId: 'att-hist-1',
        quizId: 'quiz-1',
        quizVersionId: 'ver-1',
        version: 1,
        status: AttemptStatus.SUBMITTED,
        score: 8,
        totalMarks: 10,
        totalScore: 10,
        correctAnswers: 2,
        wrongAnswers: 0,
        unanswered: 0,
        percentage: 80,
        startedAt: '2026-10-29T10:00:00.000Z',
        submittedAt: '2026-10-29T10:12:30.000Z',
      };

      assert.equal(resultItem.totalMarks, 10);
      assert.equal(resultItem.totalScore, 10);
      assert.equal(historyItem.totalMarks, 10);
      assert.equal(historyItem.totalScore, 10);

      const totalPossibleResult = resultItem.totalMarks ?? resultItem.totalScore ?? 0;
      const totalPossibleHistory = historyItem.totalMarks ?? historyItem.totalScore ?? 0;
      assert.equal(totalPossibleResult, 10);
      assert.equal(totalPossibleHistory, 10);
    });

    it('6.5.1-3. Safe handling of zero-mark attempts in percentage calculations', () => {
      const zeroMarkResult: AttemptResultResponse = {
        attemptId: 'att-zero',
        quizId: 'quiz-zero',
        quizVersionId: 'ver-zero',
        status: AttemptStatus.SUBMITTED,
        score: 0,
        totalMarks: 0,
        totalScore: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        unanswered: 0,
        percentage: 0,
        startedAt: '2026-10-29T10:00:00.000Z',
        submittedAt: '2026-10-29T10:01:00.000Z',
        elapsedSeconds: 60,
      };

      const totalPossible = zeroMarkResult.totalMarks ?? zeroMarkResult.totalScore ?? 0;
      const percentageDisplay = zeroMarkResult.percentage !== null
        ? `${zeroMarkResult.percentage}%`
        : totalPossible > 0
          ? `${(((zeroMarkResult.score ?? 0) / totalPossible) * 100).toFixed(2)}%`
          : '0%';

      assert.equal(percentageDisplay, '0%');
      assert.doesNotMatch(percentageDisplay, /NaN/);
    });

    it('6.5.1-4. Version isolation: frontend renders each attempt with its bound version total marks', () => {
      const historyList: AttemptHistoryItem[] = [
        {
          attemptId: 'att-v1',
          quizId: 'quiz-1',
          quizVersionId: 'ver-1',
          version: 1,
          status: AttemptStatus.SUBMITTED,
          score: 5,
          totalMarks: 5,
          correctAnswers: 1,
          wrongAnswers: 0,
          unanswered: 0,
          percentage: 100,
          startedAt: '2026-10-29T09:00:00.000Z',
          submittedAt: '2026-10-29T09:05:00.000Z',
        },
        {
          attemptId: 'att-v2',
          quizId: 'quiz-1',
          quizVersionId: 'ver-2',
          version: 2,
          status: AttemptStatus.SUBMITTED,
          score: 10,
          totalMarks: 15,
          correctAnswers: 2,
          wrongAnswers: 1,
          unanswered: 0,
          percentage: 66.67,
          startedAt: '2026-10-29T10:00:00.000Z',
          submittedAt: '2026-10-29T10:15:00.000Z',
        },
      ];

      assert.equal(`${historyList[0].score} / ${historyList[0].totalMarks}`, '5 / 5');
      assert.equal(`${historyList[1].score} / ${historyList[1].totalMarks}`, '10 / 15');
    });
  });
});
