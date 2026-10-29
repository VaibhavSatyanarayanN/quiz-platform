import { QuestionType } from '../../quizzes/types/quiz.types.ts';
import {
  AttemptStatus,
  type AttemptOptionResponse,
  type AttemptQuestionResponse,
  type QuestionPersistenceState,
  type QuestionSaveStatus,
} from '../types/attempt.types.ts';

/**
 * Deduplicates an array of option IDs while preserving selection order.
 */
export function normalizeOptionIds(optionIds: readonly string[] | undefined | null): string[] {
  if (!Array.isArray(optionIds)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawId of optionIds) {
    if (typeof rawId === 'string' && rawId.trim().length > 0 && !seen.has(rawId)) {
      seen.add(rawId);
      result.push(rawId);
    }
  }
  return result;
}

/**
 * Compares two option-ID selections as sets (order-independent, deduplicated).
 */
export function areOptionSelectionsEqual(
  first: readonly string[] | undefined | null,
  second: readonly string[] | undefined | null,
): boolean {
  const normA = normalizeOptionIds(first);
  const normB = normalizeOptionIds(second);
  if (normA.length !== normB.length) {
    return false;
  }
  const setB = new Set(normB);
  return normA.every((id) => setB.has(id));
}

/**
 * Sanitizes a learner-facing question and its options:
 * - Sorts options deterministically by persisted `order` ASC (tie-breaking by `id`).
 * - Strips any non-learner fields (such as `isCorrect` or `correctAnswer`) if ever present.
 */
export function sanitizeLearnerQuestion(
  question: AttemptQuestionResponse,
): AttemptQuestionResponse {
  const rawOptions = Array.isArray(question.options) ? question.options : [];
  const sortedOptions: AttemptOptionResponse[] = [...rawOptions]
    .sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      return orderDiff !== 0 ? orderDiff : String(a.id).localeCompare(String(b.id));
    })
    .map((opt) => ({
      id: opt.id,
      text: opt.text,
      order: opt.order,
    }));

  const validOptionIds = new Set(sortedOptions.map((opt) => opt.id));
  const selectedOptionIds = normalizeOptionIds(question.selectedOptionIds).filter(
    (id) => validOptionIds.size === 0 || validOptionIds.has(id),
  );

  return {
    id: question.id,
    text: question.text,
    questionType: question.questionType,
    order: question.order,
    marks: question.marks,
    options: sortedOptions,
    selectedOptionIds,
    isAnswered: selectedOptionIds.length > 0,
  };
}

/**
 * Sorts attempt questions deterministically by persisted `order` ASC (tie-breaking by `id`)
 * and sanitizes all nested option objects.
 */
export function sortAttemptQuestions(
  questions: readonly AttemptQuestionResponse[] | undefined | null,
): AttemptQuestionResponse[] {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  return [...questions]
    .sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      return orderDiff !== 0 ? orderDiff : String(a.id).localeCompare(String(b.id));
    })
    .map(sanitizeLearnerQuestion);
}

/**
 * Clamps a question index into valid bounds `[0, Math.max(0, totalQuestions - 1)]`.
 */
export function clampQuestionIndex(index: number, totalQuestions: number): number {
  if (!Number.isFinite(index) || totalQuestions <= 0) {
    return 0;
  }
  return Math.min(Math.max(0, Math.trunc(index)), totalQuestions - 1);
}

export function getNextQuestionIndex(currentIndex: number, totalQuestions: number): number {
  return clampQuestionIndex(currentIndex + 1, totalQuestions);
}

export function getPreviousQuestionIndex(currentIndex: number, totalQuestions: number): number {
  return clampQuestionIndex(currentIndex - 1, totalQuestions);
}

/**
 * Computes the next selected option IDs for a question based on its `QuestionType`:
 * - `single_choice` and `true_false`: selects `[toggledOptionId]` (replacing any previous choice).
 * - `multiple_choice`: toggles `toggledOptionId` without duplicates, permitting removal of a previously selected option.
 */
export function computeNextSelectedOptions(
  questionType: QuestionType,
  currentSelectedIds: readonly string[],
  toggledOptionId: string,
  validOptionIds?: readonly string[],
): string[] {
  if (!toggledOptionId || typeof toggledOptionId !== 'string') {
    return normalizeOptionIds(currentSelectedIds);
  }

  if (Array.isArray(validOptionIds) && validOptionIds.length > 0) {
    if (!validOptionIds.includes(toggledOptionId)) {
      return normalizeOptionIds(currentSelectedIds);
    }
  }

  const normalizedCurrent = normalizeOptionIds(currentSelectedIds);

  if (
    questionType === QuestionType.SINGLE_CHOICE ||
    questionType === QuestionType.TRUE_FALSE
  ) {
    return [toggledOptionId];
  }

  if (questionType === QuestionType.MULTIPLE_CHOICE) {
    if (normalizedCurrent.includes(toggledOptionId)) {
      return normalizedCurrent.filter((id) => id !== toggledOptionId);
    }
    return [...normalizedCurrent, toggledOptionId];
  }

  return [toggledOptionId];
}

/**
 * Determines whether an attempt allows interactive answer selection and saving.
 */
export function isAttemptInteractive(
  status: AttemptStatus | string | undefined | null,
  isExpiredLocally = false,
): boolean {
  return status === AttemptStatus.IN_PROGRESS && !isExpiredLocally;
}

/**
 * Initializes or reconciles the per-question persistence map from loaded attempt questions.
 * Preserves in-flight (`saving`) or unsaved (`error`) local selections if a background refetch occurs.
 */
export function createInitialPersistenceMap(
  questions: readonly AttemptQuestionResponse[] | undefined | null,
  previousMap?: Record<string, QuestionPersistenceState>,
): Record<string, QuestionPersistenceState> {
  const sorted = sortAttemptQuestions(questions);
  const nextMap: Record<string, QuestionPersistenceState> = {};

  for (const q of sorted) {
    const serverSelected = normalizeOptionIds(q.selectedOptionIds);
    const existing = previousMap?.[q.id];

    if (
      existing &&
      (existing.status === 'saving' || existing.status === 'error')
    ) {
      nextMap[q.id] = {
        ...existing,
        persistedOptionIds: serverSelected,
      };
      continue;
    }

    nextMap[q.id] = {
      status: serverSelected.length > 0 ? 'saved' : 'idle',
      selectedOptionIds: serverSelected,
      persistedOptionIds: serverSelected,
      requestSeq: existing?.requestSeq ?? 0,
      errorMessage: null,
      errorCode: null,
      lastSavedAt: existing?.lastSavedAt ?? null,
    };
  }

  return nextMap;
}

/**
 * Transitions a question into the `saving` state with a monotonically incremented `requestSeq`.
 * If the selection is identical to the current selection and not retrying an error, returns `shouldSendRequest: false`.
 */
export function beginQuestionSave(
  map: Record<string, QuestionPersistenceState>,
  questionId: string,
  nextOptionIds: readonly string[],
  forceRetry = false,
): {
  nextMap: Record<string, QuestionPersistenceState>;
  requestSeq: number;
  shouldSendRequest: boolean;
} {
  const normalizedNext = normalizeOptionIds(nextOptionIds);
  const current: QuestionPersistenceState = map[questionId] ?? {
    status: 'idle',
    selectedOptionIds: [],
    persistedOptionIds: [],
    requestSeq: 0,
    errorMessage: null,
    errorCode: null,
    lastSavedAt: null,
  };

  if (
    !forceRetry &&
    current.status !== 'error' &&
    areOptionSelectionsEqual(normalizedNext, current.selectedOptionIds)
  ) {
    return {
      nextMap: map,
      requestSeq: current.requestSeq,
      shouldSendRequest: false,
    };
  }

  const nextSeq = current.requestSeq + 1;
  const nextState: QuestionPersistenceState = {
    status: 'saving',
    selectedOptionIds: normalizedNext,
    persistedOptionIds: current.persistedOptionIds,
    requestSeq: nextSeq,
    errorMessage: null,
    errorCode: null,
    lastSavedAt: current.lastSavedAt,
  };

  return {
    nextMap: {
      ...map,
      [questionId]: nextState,
    },
    requestSeq: nextSeq,
    shouldSendRequest: true,
  };
}

/**
 * Marks a question save request as `saved` ONLY if `requestSeq` matches the latest request for that question.
 * Stale responses (`requestSeq < current.requestSeq`) are ignored so they can never overwrite newer selections.
 */
export function completeQuestionSaveSuccess(
  map: Record<string, QuestionPersistenceState>,
  questionId: string,
  requestSeq: number,
  confirmedOptionIds?: readonly string[],
  savedAt?: string | null,
): {
  nextMap: Record<string, QuestionPersistenceState>;
  applied: boolean;
} {
  const current = map[questionId];
  if (!current || current.requestSeq !== requestSeq) {
    return { nextMap: map, applied: false };
  }

  const persisted =
    confirmedOptionIds !== undefined
      ? normalizeOptionIds(confirmedOptionIds)
      : current.selectedOptionIds;

  const nextStatus: QuestionSaveStatus =
    persisted.length > 0 ? 'saved' : 'idle';

  return {
    nextMap: {
      ...map,
      [questionId]: {
        ...current,
        status: nextStatus,
        selectedOptionIds: persisted,
        persistedOptionIds: persisted,
        errorMessage: null,
        errorCode: null,
        lastSavedAt: savedAt ?? new Date().toISOString(),
      },
    },
    applied: true,
  };
}

/**
 * Marks a question save request as `error` ONLY if `requestSeq` matches the latest request for that question.
 * Preserves the learner's unsaved `selectedOptionIds` locally so they can retry without losing work.
 */
export function completeQuestionSaveError(
  map: Record<string, QuestionPersistenceState>,
  questionId: string,
  requestSeq: number,
  errorMessage: string,
  errorCode: number | null = null,
): {
  nextMap: Record<string, QuestionPersistenceState>;
  applied: boolean;
} {
  const current = map[questionId];
  if (!current || current.requestSeq !== requestSeq) {
    return { nextMap: map, applied: false };
  }

  return {
    nextMap: {
      ...map,
      [questionId]: {
        ...current,
        status: 'error',
        errorMessage: errorMessage || 'Failed to save answer. Please retry.',
        errorCode,
      },
    },
    applied: true,
  };
}

export interface AttemptProgressSummary {
  totalQuestions: number;
  answeredCount: number;
  persistedAnsweredCount: number;
  unansweredCount: number;
  progressPercent: number;
  savingCount: number;
  errorCount: number;
  hasUnsavedChanges: boolean;
  failedQuestionIds: string[];
  savingQuestionIds: string[];
  answersMap: Record<string, string[]>;
  saveStatusMap: Record<string, QuestionSaveStatus>;
}

/**
 * Computes aggregate progress and persistence status across all questions in the attempt.
 */
export function getAttemptProgressSummary(
  questions: readonly AttemptQuestionResponse[],
  persistenceMap: Record<string, QuestionPersistenceState>,
): AttemptProgressSummary {
  const totalQuestions = questions.length;
  let answeredCount = 0;
  let persistedAnsweredCount = 0;
  const failedQuestionIds: string[] = [];
  const savingQuestionIds: string[] = [];
  const answersMap: Record<string, string[]> = {};
  const saveStatusMap: Record<string, QuestionSaveStatus> = {};

  for (const q of questions) {
    const state = persistenceMap[q.id];
    const selected = state
      ? state.selectedOptionIds
      : normalizeOptionIds(q.selectedOptionIds);
    const persisted = state
      ? state.persistedOptionIds
      : normalizeOptionIds(q.selectedOptionIds);
    const status: QuestionSaveStatus = state
      ? state.status
      : selected.length > 0
        ? 'saved'
        : 'idle';

    answersMap[q.id] = selected;
    saveStatusMap[q.id] = status;

    if (selected.length > 0) {
      answeredCount++;
    }
    if (persisted.length > 0) {
      persistedAnsweredCount++;
    }
    if (status === 'error') {
      failedQuestionIds.push(q.id);
    } else if (status === 'saving') {
      savingQuestionIds.push(q.id);
    }
  }

  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const progressPercent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return {
    totalQuestions,
    answeredCount,
    persistedAnsweredCount,
    unansweredCount,
    progressPercent,
    savingCount: savingQuestionIds.length,
    errorCount: failedQuestionIds.length,
    hasUnsavedChanges:
      failedQuestionIds.length > 0 || savingQuestionIds.length > 0,
    failedQuestionIds,
    savingQuestionIds,
    answersMap,
    saveStatusMap,
  };
}

export interface ClassifiedAttemptError {
  statusCode: number | null;
  message: string;
  isAborted: boolean;
  isUnauthorized: boolean;
  isForbidden: boolean;
  isNotFound: boolean;
  isExpiredAttempt: boolean;
}

/**
 * Extracts structured HTTP status and lifecycle error classifications from API errors.
 */
export function classifyAttemptError(error: unknown): ClassifiedAttemptError {
  if (!error) {
    return {
      statusCode: null,
      message: 'An unexpected error occurred.',
      isAborted: false,
      isUnauthorized: false,
      isForbidden: false,
      isNotFound: false,
      isExpiredAttempt: false,
    };
  }

  const errObj = error as {
    name?: string;
    code?: string;
    statusCode?: number;
    message?: string;
    response?: {
      status?: number;
      data?: {
        statusCode?: number;
        message?: string | string[];
      };
    };
  };

  const isAborted =
    errObj.name === 'AbortError' ||
    errObj.name === 'CanceledError' ||
    errObj.code === 'ERR_CANCELED';

  const statusCode =
    errObj.response?.status ??
    errObj.response?.data?.statusCode ??
    errObj.statusCode ??
    null;

  let message = 'An unexpected error occurred. Please try again.';
  const rawServerMessage = errObj.response?.data?.message;
  if (Array.isArray(rawServerMessage)) {
    message = rawServerMessage.join(', ');
  } else if (typeof rawServerMessage === 'string' && rawServerMessage.trim()) {
    message = rawServerMessage;
  } else if (typeof errObj.message === 'string' && errObj.message.trim()) {
    message = errObj.message;
  }

  const isUnauthorized = statusCode === 401;
  const isForbidden = statusCode === 403;
  const isNotFound = statusCode === 404;
  const isExpiredAttempt =
    (statusCode === 400 || statusCode === 409 || statusCode === null) &&
    /expired|no longer active/i.test(message);

  return {
    statusCode,
    message,
    isAborted,
    isUnauthorized,
    isForbidden,
    isNotFound,
    isExpiredAttempt,
  };
}

/**
 * Low-time warning threshold (5 minutes = 300 seconds) and urgent final-minute threshold (60 seconds).
 */
export const LOW_TIME_WARNING_THRESHOLD_SECONDS = 300;
export const URGENT_TIME_WARNING_THRESHOLD_SECONDS = 60;

export type TimerUrgencyLevel =
  | 'untimed'
  | 'normal'
  | 'warning'
  | 'urgent'
  | 'expired';

export interface CountdownResult {
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  isWarning: boolean;
  isUrgent: boolean;
  urgency: TimerUrgencyLevel;
  formatted: string;
}

/**
 * Computes the clock-skew offset (in milliseconds) between the client's local clock
 * and the server's authoritative remaining time at synchronization.
 * Returns 0 when clocks are aligned within 2 seconds so millisecond precision from `expiresAt` is preserved.
 */
export function computeServerClockSkewOffsetMs(
  expiresAt: string | null | undefined,
  serverRemainingTimeSeconds?: number | null,
  clientNowMs: number = Date.now(),
): number {
  if (
    !expiresAt ||
    serverRemainingTimeSeconds === null ||
    serverRemainingTimeSeconds === undefined ||
    !Number.isFinite(serverRemainingTimeSeconds)
  ) {
    return 0;
  }

  const deadlineMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(deadlineMs)) {
    return 0;
  }

  const impliedServerNowMs =
    deadlineMs - Math.max(0, serverRemainingTimeSeconds) * 1000;
  const skewMs = impliedServerNowMs - clientNowMs;

  return Math.abs(skewMs) > 2000 ? skewMs : 0;
}

/**
 * Pure, deterministic calculation of remaining time and warning urgency from the server-provided `expiresAt` deadline.
 * Never returns negative values and aligns with the backend boundary (`now >= expiresAt` -> `0`).
 */
export function calculateCountdownSnapshot(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
  clockSkewOffsetMs = 0,
): CountdownResult {
  if (!expiresAt) {
    return {
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: false,
      isWarning: false,
      isUrgent: false,
      urgency: 'untimed',
      formatted: '--:--',
    };
  }

  const deadlineMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(deadlineMs)) {
    return {
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: false,
      isWarning: false,
      isUrgent: false,
      urgency: 'untimed',
      formatted: '--:--',
    };
  }

  const effectiveNowMs = nowMs + clockSkewOffsetMs;
  const diffMs = deadlineMs - effectiveNowMs;
  const totalSeconds =
    diffMs <= 0 ? 0 : Math.max(0, Math.ceil(diffMs / 1000));
  const isExpired = totalSeconds <= 0;
  const isUrgent =
    !isExpired && totalSeconds <= URGENT_TIME_WARNING_THRESHOLD_SECONDS;
  const isWarning =
    !isExpired &&
    !isUrgent &&
    totalSeconds <= LOW_TIME_WARNING_THRESHOLD_SECONDS;

  const urgency: TimerUrgencyLevel = isExpired
    ? 'expired'
    : isUrgent
      ? 'urgent'
      : isWarning
        ? 'warning'
        : 'normal';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    minutes,
    seconds,
    totalSeconds,
    isExpired,
    isWarning,
    isUrgent,
    urgency,
    formatted: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
}

export type ExpirationFinalizationStatus =
  | 'idle'
  | 'finalizing'
  | 'confirmed'
  | 'error';

export interface ExpirationFinalizationState {
  isExpiredLocally: boolean;
  status: ExpirationFinalizationStatus;
  errorMessage: string | null;
  attemptCount: number;
  canNavigateToResult: boolean;
}

export function createInitialExpirationState(
  attemptStatus?: AttemptStatus | string | null,
): ExpirationFinalizationState {
  const isTerminal =
    attemptStatus === AttemptStatus.SUBMITTED ||
    attemptStatus === AttemptStatus.EXPIRED;

  return {
    isExpiredLocally: attemptStatus === AttemptStatus.EXPIRED,
    status: isTerminal ? 'confirmed' : 'idle',
    errorMessage: null,
    attemptCount: 0,
    canNavigateToResult: isTerminal,
  };
}

/**
 * Transitions the local expiration state machine when the countdown reaches 0 (or when retrying after a network error).
 * Immediately locks editing (`isExpiredLocally: true`) and guards against duplicate finalization requests.
 */
export function beginExpirationFinalization(
  prevState: ExpirationFinalizationState,
  forceRetry = false,
): {
  nextState: ExpirationFinalizationState;
  shouldTriggerRequest: boolean;
} {
  if (
    prevState.status === 'finalizing' ||
    prevState.status === 'confirmed' ||
    (prevState.status === 'error' && !forceRetry)
  ) {
    return {
      nextState: {
        ...prevState,
        isExpiredLocally: true,
      },
      shouldTriggerRequest: false,
    };
  }

  return {
    nextState: {
      isExpiredLocally: true,
      status: 'finalizing',
      errorMessage: null,
      attemptCount: prevState.attemptCount + 1,
      canNavigateToResult: false,
    },
    shouldTriggerRequest: true,
  };
}

export function completeExpirationFinalizationSuccess(
  prevState: ExpirationFinalizationState,
): ExpirationFinalizationState {
  return {
    isExpiredLocally: true,
    status: 'confirmed',
    errorMessage: null,
    attemptCount: prevState.attemptCount,
    canNavigateToResult: true,
  };
}

/**
 * Handles errors during timeout finalization:
 * - If the backend explicitly confirmed the attempt is already expired/inactive, transitions to `'confirmed'`.
 * - If a network or transient server error occurred, keeps editing disabled (`isExpiredLocally: true`),
 *   prevents premature navigation (`canNavigateToResult: false`), and exposes a clear error state for retry.
 */
export function completeExpirationFinalizationError(
  prevState: ExpirationFinalizationState,
  error: unknown,
): ExpirationFinalizationState {
  const classified = classifyAttemptError(error);
  if (classified.isExpiredAttempt) {
    return completeExpirationFinalizationSuccess(prevState);
  }

  return {
    isExpiredLocally: true,
    status: 'error',
    errorMessage:
      classified.message ||
      'Unable to reach the server to finalize your expired quiz attempt.',
    attemptCount: prevState.attemptCount,
    canNavigateToResult: false,
  };
}

/**
 * Reconciles authoritative attempt submission state in case of ambiguous network failure.
 * If server confirms terminal status (SUBMITTED / EXPIRED), allows client to navigate to result safely.
 */
export function reconcileAttemptSubmissionState(
  serverStatus: AttemptStatus | string | undefined | null,
  error?: unknown,
): {
  isFinalized: boolean;
  status: AttemptStatus | string | null;
  canNavigate: boolean;
} {
  if (
    serverStatus === AttemptStatus.SUBMITTED ||
    serverStatus === AttemptStatus.EXPIRED
  ) {
    return {
      isFinalized: true,
      status: serverStatus,
      canNavigate: true,
    };
  }
  if (error) {
    const classified = classifyAttemptError(error);
    if (classified.isExpiredAttempt) {
      return {
        isFinalized: true,
        status: AttemptStatus.EXPIRED,
        canNavigate: true,
      };
    }
  }
  return {
    isFinalized: false,
    status: serverStatus ?? null,
    canNavigate: false,
  };
}
