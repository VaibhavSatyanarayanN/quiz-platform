import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useAttempt, useSubmitAttempt, useSaveAnswer } from '../hooks/use-attempts';
import { QuestionCard } from '../components/QuestionCard';
import { QuestionPalette } from '../components/QuestionPalette';
import { QuizTimer } from '../components/QuizTimer';
import { SubmitConfirmModal } from '../components/SubmitConfirmModal';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Alert } from '@/components/feedback/Alert';
import {
  AttemptStatus,
  type QuestionPersistenceState,
} from '../types/attempt.types';
import {
  beginExpirationFinalization,
  beginQuestionSave,
  classifyAttemptError,
  clampQuestionIndex,
  completeExpirationFinalizationError,
  completeExpirationFinalizationSuccess,
  completeQuestionSaveError,
  completeQuestionSaveSuccess,
  computeNextSelectedOptions,
  createInitialExpirationState,
  createInitialPersistenceMap,
  getAttemptProgressSummary,
  getNextQuestionIndex,
  getPreviousQuestionIndex,
  isAttemptInteractive,
  sortAttemptQuestions,
  type ExpirationFinalizationState,
  type TimerUrgencyLevel,
} from '../utils/attempt-persistence';

export default function QuizAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const {
    data: attempt,
    isLoading,
    error,
    refetch: refetchAttempt,
  } = useAttempt(attemptId ?? '');
  const submitAttemptMutation = useSubmitAttempt();
  const { mutateAsync: saveAnswerAsync } = useSaveAnswer();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [persistenceMap, setPersistenceMap] = useState<
    Record<string, QuestionPersistenceState>
  >({});
  const [navigationWarning, setNavigationWarning] = useState<string | null>(null);
  const [lifecycleBanner, setLifecycleBanner] = useState<string | null>(null);
  const [expirationState, setExpirationState] =
    useState<ExpirationFinalizationState>(() => createInitialExpirationState());
  const [timerUrgency, setTimerUrgency] = useState<TimerUrgencyLevel>('normal');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);

  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);
  const persistenceMapRef = useRef<Record<string, QuestionPersistenceState>>({});
  const expirationStateRef = useRef<ExpirationFinalizationState>(
    createInitialExpirationState(),
  );
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Track component mount/unmount and abort any outstanding save requests on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const controllers = abortControllersRef.current;
    return () => {
      isMountedRef.current = false;
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  // Sort questions deterministically by persisted question order
  const questions = useMemo(
    () => sortAttemptQuestions(attempt?.questions),
    [attempt?.questions],
  );
  const totalQuestions = questions.length;
  const safeCurrentIndex = clampQuestionIndex(currentIndex, totalQuestions);
  const currentQuestion = questions[safeCurrentIndex];

  // Restore saved answers when attempt loads or refreshes without clobbering active local edits
  useEffect(() => {
    if (!questions.length) return;
    setPersistenceMap((prev) => {
      const next = createInitialPersistenceMap(questions, prev);
      persistenceMapRef.current = next;
      return next;
    });
  }, [questions]);

  // Compute aggregate progress and save state
  const progress = useMemo(
    () => getAttemptProgressSummary(questions, persistenceMap),
    [questions, persistenceMap],
  );

  const isExpiredLocally = expirationState.isExpiredLocally;
  const isInteractive = isAttemptInteractive(attempt?.status, isExpiredLocally);

  // Warn before browser tab unload if unsaved or in-flight answers exist
  useEffect(() => {
    if (!progress.hasUnsavedChanges || !isInteractive) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [progress.hasUnsavedChanges, isInteractive]);

  // If attempt is already submitted or expired on the server, synchronize state and navigate to result page
  useEffect(() => {
    if (!attempt) return;
    if (
      attempt.status === AttemptStatus.SUBMITTED ||
      attempt.status === AttemptStatus.EXPIRED
    ) {
      expirationStateRef.current = createInitialExpirationState(attempt.status);
      const targetAttemptId = attempt.attemptId || attempt.id || attemptId;
      navigate(`/attempts/${targetAttemptId}/result`, { replace: true });
    }
  }, [attempt, attemptId, navigate]);

  const persistQuestionSelection = useCallback(
    async (
      questionId: string,
      nextOptionIds: string[],
      forceRetry = false,
    ) => {
      const resolvedAttemptId = attempt?.attemptId || attempt?.id || attemptId;
      if (!resolvedAttemptId || !isInteractive) {
        return;
      }

      const { nextMap, requestSeq, shouldSendRequest } = beginQuestionSave(
        persistenceMapRef.current,
        questionId,
        nextOptionIds,
        forceRetry,
      );

      if (!shouldSendRequest) {
        return;
      }

      // Abort any older in-flight save request for the same question
      const previousController = abortControllersRef.current.get(questionId);
      if (previousController) {
        previousController.abort();
      }
      const controller = new AbortController();
      abortControllersRef.current.set(questionId, controller);

      persistenceMapRef.current = nextMap;
      setPersistenceMap(nextMap);

      try {
        const saved = await saveAnswerAsync({
          attemptId: resolvedAttemptId,
          questionId,
          data: { optionIds: nextOptionIds },
          signal: controller.signal,
        });

        if (!isMountedRef.current) return;

        const { nextMap: confirmedMap, applied } = completeQuestionSaveSuccess(
          persistenceMapRef.current,
          questionId,
          requestSeq,
          saved?.optionIds ?? nextOptionIds,
          saved?.answeredAt ?? null,
        );

        if (applied) {
          persistenceMapRef.current = confirmedMap;
          setPersistenceMap(confirmedMap);
          setNavigationWarning(null);
        }
      } catch (err) {
        if (!isMountedRef.current) return;

        const classified = classifyAttemptError(err);
        if (classified.isAborted) {
          return;
        }

        const { nextMap: errorMap, applied } = completeQuestionSaveError(
          persistenceMapRef.current,
          questionId,
          requestSeq,
          classified.message,
          classified.statusCode,
        );

        if (applied) {
          persistenceMapRef.current = errorMap;
          setPersistenceMap(errorMap);
        }

        if (classified.isExpiredAttempt) {
          const confirmed = completeExpirationFinalizationSuccess(
            expirationStateRef.current,
          );
          expirationStateRef.current = confirmed;
          setExpirationState(confirmed);
          setLifecycleBanner(
            'This quiz attempt has expired. Answer editing is now locked.',
          );
          navigate(`/attempts/${resolvedAttemptId}/result`, { replace: true });
        } else if (classified.isForbidden || classified.isUnauthorized) {
          setLifecycleBanner(classified.message);
        }
      } finally {
        if (abortControllersRef.current.get(questionId) === controller) {
          abortControllersRef.current.delete(questionId);
        }
      }
    },
    [attempt, attemptId, isInteractive, navigate, saveAnswerAsync],
  );

  const handleOptionSelect = useCallback(
    (questionId: string, optionId: string) => {
      if (!isInteractive) return;
      const q = questions.find((item) => item.id === questionId);
      if (!q) return;

      const currentSelected = progress.answersMap[questionId] ?? [];
      const validOptionIds = q.options.map((opt) => opt.id);
      const nextOptionIds = computeNextSelectedOptions(
        q.questionType,
        currentSelected,
        optionId,
        validOptionIds,
      );

      void persistQuestionSelection(questionId, nextOptionIds, false);
    },
    [isInteractive, questions, progress.answersMap, persistQuestionSelection],
  );

  const handleRetryQuestionSave = useCallback(
    (questionId: string) => {
      const state = persistenceMapRef.current[questionId];
      if (!state || !isInteractive) return;
      void persistQuestionSelection(questionId, state.selectedOptionIds, true);
    },
    [isInteractive, persistQuestionSelection],
  );

  const handleRetryAllUnsaved = useCallback(() => {
    if (!isInteractive) return;
    for (const qId of progress.failedQuestionIds) {
      const state = persistenceMapRef.current[qId];
      if (state) {
        void persistQuestionSelection(qId, state.selectedOptionIds, true);
      }
    }
  }, [isInteractive, progress.failedQuestionIds, persistQuestionSelection]);

  const navigateToQuestion = useCallback(
    (targetIndex: number) => {
      const clamped = clampQuestionIndex(targetIndex, totalQuestions);
      if (clamped === safeCurrentIndex) return;

      if (currentQuestion) {
        const currentSaveState = persistenceMapRef.current[currentQuestion.id];
        if (currentSaveState?.status === 'error') {
          setNavigationWarning(
            `Question ${safeCurrentIndex + 1} has an unsaved answer. Your selection is preserved locally — please retry saving before submitting.`,
          );
        }
      }

      setCurrentIndex(clamped);
    },
    [totalQuestions, safeCurrentIndex, currentQuestion],
  );

  const handleSubmit = useCallback(async () => {
    const resolvedAttemptId = attempt?.attemptId || attempt?.id || attemptId;
    if (!resolvedAttemptId || isSubmittingRef.current) return;
    if (attempt?.status === AttemptStatus.SUBMITTED) return;

    isSubmittingRef.current = true;
    setIsSubmittingAnswers(true);

    submitAttemptMutation.mutate(resolvedAttemptId, {
      onSuccess: () => {
        if (!isMountedRef.current) return;
        const confirmed = completeExpirationFinalizationSuccess(
          expirationStateRef.current,
        );
        expirationStateRef.current = confirmed;
        setExpirationState(confirmed);
        navigate(`/attempts/${resolvedAttemptId}/result`, { replace: true });
      },
      onError: async (err) => {
        if (!isMountedRef.current) return;
        const classified = classifyAttemptError(err);
        if (classified.isExpiredAttempt) {
          const confirmed = completeExpirationFinalizationSuccess(
            expirationStateRef.current,
          );
          expirationStateRef.current = confirmed;
          setExpirationState(confirmed);
          navigate(`/attempts/${resolvedAttemptId}/result`, { replace: true });
          return;
        }

        // On network or ambiguous error, query authoritative attempt state before concluding failure
        try {
          const fresh = await refetchAttempt();
          if (!isMountedRef.current) return;
          if (
            fresh.data?.status === AttemptStatus.SUBMITTED ||
            fresh.data?.status === AttemptStatus.EXPIRED
          ) {
            const confirmed = completeExpirationFinalizationSuccess(
              expirationStateRef.current,
            );
            expirationStateRef.current = confirmed;
            setExpirationState(confirmed);
            navigate(`/attempts/${resolvedAttemptId}/result`, { replace: true });
            return;
          }
        } catch {
          // If refetch also fails, proceed with normal error display
        }

        isSubmittingRef.current = false;
        setIsSubmittingAnswers(false);
      },
    });
  }, [attempt, attemptId, submitAttemptMutation, navigate, refetchAttempt]);

  const executeExpirationFinalization = useCallback(
    (forceRetry = false) => {
      const resolvedAttemptId = attempt?.attemptId || attempt?.id || attemptId;
      if (!resolvedAttemptId) return;

      // Abort any in-flight answer saves immediately when local timer reaches 0
      for (const controller of abortControllersRef.current.values()) {
        controller.abort();
      }
      abortControllersRef.current.clear();
      setShowSubmitModal(false);

      const { nextState, shouldTriggerRequest } = beginExpirationFinalization(
        expirationStateRef.current,
        forceRetry,
      );
      expirationStateRef.current = nextState;
      setExpirationState(nextState);
      setLifecycleBanner('Time has expired. Finalizing your quiz attempt...');

      if (!shouldTriggerRequest || isSubmittingRef.current) {
        return;
      }

      isSubmittingRef.current = true;
      setIsSubmittingAnswers(true);

      submitAttemptMutation.mutate(resolvedAttemptId, {
        onSuccess: () => {
          if (!isMountedRef.current) return;
          isSubmittingRef.current = false;
          setIsSubmittingAnswers(false);
          const confirmed = completeExpirationFinalizationSuccess(
            expirationStateRef.current,
          );
          expirationStateRef.current = confirmed;
          setExpirationState(confirmed);
          navigate(`/attempts/${resolvedAttemptId}/result`, { replace: true });
        },
        onError: async (err) => {
          if (!isMountedRef.current) return;
          const classified = classifyAttemptError(err);
          if (classified.isExpiredAttempt) {
            isSubmittingRef.current = false;
            setIsSubmittingAnswers(false);
            const confirmed = completeExpirationFinalizationSuccess(
              expirationStateRef.current,
            );
            expirationStateRef.current = confirmed;
            setExpirationState(confirmed);
            navigate(`/attempts/${resolvedAttemptId}/result`, { replace: true });
            return;
          }

          // Check authoritative state in case timeout submit actually succeeded
          try {
            const fresh = await refetchAttempt();
            if (!isMountedRef.current) return;
            if (
              fresh.data?.status === AttemptStatus.SUBMITTED ||
              fresh.data?.status === AttemptStatus.EXPIRED
            ) {
              isSubmittingRef.current = false;
              setIsSubmittingAnswers(false);
              const confirmed = completeExpirationFinalizationSuccess(
                expirationStateRef.current,
              );
              expirationStateRef.current = confirmed;
              setExpirationState(confirmed);
              navigate(`/attempts/${resolvedAttemptId}/result`, { replace: true });
              return;
            }
          } catch {
            // Ignore refetch failure
          }

          isSubmittingRef.current = false;
          setIsSubmittingAnswers(false);
          const failedState = completeExpirationFinalizationError(
            expirationStateRef.current,
            err,
          );
          expirationStateRef.current = failedState;
          setExpirationState(failedState);

          if (failedState.canNavigateToResult) {
            navigate(`/attempts/${resolvedAttemptId}/result`, { replace: true });
          } else {
            setLifecycleBanner(
              'Time has expired. Answer editing is locked while we confirm finalization with the server.',
            );
          }
        },
      });
    },
    [attempt, attemptId, submitAttemptMutation, navigate, refetchAttempt],
  );

  const handleExpire = useCallback(() => {
    executeExpirationFinalization(false);
  }, [executeExpirationFinalization]);

  const handleRetryExpirationFinalization = useCallback(() => {
    void refetchAttempt();
    executeExpirationFinalization(true);
  }, [refetchAttempt, executeExpirationFinalization]);

  const handleUrgencyChange = useCallback((urgency: TimerUrgencyLevel) => {
    setTimerUrgency(urgency);
  }, []);

  useEffect(() => {
    const handleNavKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'n') {
        if (safeCurrentIndex < totalQuestions - 1) {
          navigateToQuestion(safeCurrentIndex + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'p') {
        if (safeCurrentIndex > 0) {
          navigateToQuestion(safeCurrentIndex - 1);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isInteractive) {
        setShowSubmitModal(true);
      }
    };

    window.addEventListener('keydown', handleNavKey);
    return () => window.removeEventListener('keydown', handleNavKey);
  }, [safeCurrentIndex, totalQuestions, navigateToQuestion, isInteractive]);

  if (isLoading) {
    return <LoadingSpinner message="Loading quiz attempt..." />;
  }

  if (error || !attempt) {
    const classifiedLoadError = classifyAttemptError(error);
    const alertTitle = classifiedLoadError.isForbidden || classifiedLoadError.isUnauthorized
      ? 'Access Denied'
      : classifiedLoadError.isNotFound
        ? 'Attempt Not Found'
        : 'Attempt Unavailable';

    return (
      <div style={{ maxWidth: '640px', margin: '40px auto' }}>
        <Alert variant="danger" title={alertTitle}>
          {classifiedLoadError.message ||
            'Attempt not found, expired, or you do not have permission to access it.'}
        </Alert>
        <div style={{ marginTop: '16px' }}>
          <Link to="/dashboard">
            <Button variant="outline">← Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const resolvedAttemptId = attempt.attemptId || attempt.id || attemptId || '';
  const currentQuestionState = currentQuestion
    ? persistenceMap[currentQuestion.id]
    : undefined;

  return (
    <div className="quiz-taking-layout">
      <header className="quiz-topbar" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
            {attempt.quizTitle || 'Quiz Assessment'}
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
              flexWrap: 'wrap',
            }}
          >
            <Badge variant="brand" size="sm">
              Attempt #{resolvedAttemptId.slice(0, 8)}
            </Badge>
            {attempt.version !== undefined && (
              <Badge variant="neutral" size="sm">
                v{attempt.version}
              </Badge>
            )}
            <Badge
              variant={isInteractive ? 'success' : 'warning'}
              size="sm"
            >
              {isExpiredLocally ? AttemptStatus.EXPIRED : attempt.status}
            </Badge>
            <span
              className="quiz-progress-text"
              style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}
            >
              {totalQuestions > 0
                ? `Question ${safeCurrentIndex + 1} of ${totalQuestions} • ${progress.answeredCount}/${totalQuestions} answered (${progress.progressPercent}%)`
                : '0 questions'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {attempt.expiresAt && (
            <QuizTimer
              expiresAt={attempt.expiresAt}
              remainingTimeSeconds={attempt.remainingTimeSeconds}
              onExpire={handleExpire}
              onUrgencyChange={handleUrgencyChange}
            />
          )}

          {isInteractive ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowSubmitModal(true)}
              isLoading={submitAttemptMutation.isPending || isSubmittingAnswers}
              disabled={totalQuestions === 0}
            >
              Submit Attempt
            </Button>
          ) : expirationState.status === 'error' ? (
            <Button
              type="button"
              variant="primary"
              onClick={handleRetryExpirationFinalization}
              isLoading={submitAttemptMutation.isPending || isSubmittingAnswers}
            >
              Retry Finalization
            </Button>
          ) : (
            <Link to={`/attempts/${resolvedAttemptId}/result`}>
              <Button type="button" variant="primary">
                View Results →
              </Button>
            </Link>
          )}
        </div>
      </header>

      {totalQuestions > 0 && (
        <div
          className="quiz-progress-track"
          role="progressbar"
          aria-label="Overall quiz completion progress"
          aria-valuenow={progress.answeredCount}
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
        >
          <div
            className="quiz-progress-bar"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
      )}

      {isInteractive && (timerUrgency === 'warning' || timerUrgency === 'urgent') && (
        <Alert
          variant={timerUrgency === 'urgent' ? 'danger' : 'warning'}
          title={
            timerUrgency === 'urgent'
              ? 'Final Minute Remaining'
              : 'Low Time Warning'
          }
        >
          {timerUrgency === 'urgent'
            ? 'Less than 1 minute remains. Your saved answers will be automatically finalized when the timer reaches 00:00.'
            : 'Less than 5 minutes remain on this quiz attempt. Ensure your answers are saved before time expires.'}
        </Alert>
      )}

      {!isInteractive && expirationState.status === 'error' && (
        <Alert variant="danger" title="Time Expired — Finalization Pending">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span>
              {expirationState.errorMessage ||
                'Time is up, but we could not reach the server to finalize your attempt.'}{' '}
              Answer editing is locked, and your previously saved answers remain preserved on the server.
            </span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleRetryExpirationFinalization}
              isLoading={submitAttemptMutation.isPending || isSubmittingAnswers}
            >
              Retry Finalization
            </Button>
          </div>
        </Alert>
      )}

      {!isInteractive && expirationState.status !== 'error' && (
        <Alert
          variant="warning"
          title={
            attempt.status === AttemptStatus.SUBMITTED
              ? 'Attempt Already Submitted'
              : 'Attempt Expired'
          }
        >
          {lifecycleBanner ||
            'This quiz attempt is no longer active. Answer editing has been disabled.'}
        </Alert>
      )}

      {(progress.errorCount > 0 || navigationWarning) && isInteractive && (
        <Alert variant="danger" title="Unsaved Answer Detected">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span>
              {navigationWarning ||
                `Failed to save ${progress.errorCount} answer${progress.errorCount > 1 ? 's' : ''}. Your selection is preserved locally.`}
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {progress.failedQuestionIds.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const firstFailedIdx = questions.findIndex(
                      (q) => q.id === progress.failedQuestionIds[0],
                    );
                    if (firstFailedIdx >= 0) {
                      setCurrentIndex(firstFailedIdx);
                    }
                  }}
                >
                  Go to Unsaved Question
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleRetryAllUnsaved}
              >
                Retry Save ({progress.errorCount})
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {submitAttemptMutation.isError && expirationState.status !== 'error' && (
        <Alert variant="danger" title="Submission Failed">
          {classifyAttemptError(submitAttemptMutation.error).message}
        </Alert>
      )}

      {totalQuestions === 0 ? (
        <Alert variant="warning" title="No Questions Available">
          This quiz attempt has no questions available to display.
        </Alert>
      ) : (
        <div className="quiz-body-grid" style={{ alignItems: 'start' }}>
          <main className="quiz-main-content">
            {currentQuestion && (
              <QuestionCard
                question={currentQuestion}
                questionNumber={safeCurrentIndex + 1}
                totalQuestions={totalQuestions}
                selectedOptionIds={progress.answersMap[currentQuestion.id] || []}
                onOptionSelect={(optId) =>
                  handleOptionSelect(currentQuestion.id, optId)
                }
                saveStatus={currentQuestionState?.status ?? 'idle'}
                saveError={currentQuestionState?.errorMessage ?? null}
                onRetrySave={() => handleRetryQuestionSave(currentQuestion.id)}
                disabled={!isInteractive}
              />
            )}

            <nav
              className="question-nav-controls"
              aria-label="Question step navigation"
            >
              <Button
                type="button"
                variant="outline"
                disabled={safeCurrentIndex === 0}
                aria-label="Previous question"
                onClick={() =>
                  navigateToQuestion(
                    getPreviousQuestionIndex(safeCurrentIndex, totalQuestions),
                  )
                }
              >
                ← Previous
              </Button>

              <span className="question-nav-center" aria-live="polite">
                Question {safeCurrentIndex + 1} of {totalQuestions}
              </span>

              <Button
                type="button"
                variant="primary"
                disabled={safeCurrentIndex >= totalQuestions - 1}
                aria-label="Next question"
                onClick={() =>
                  navigateToQuestion(
                    getNextQuestionIndex(safeCurrentIndex, totalQuestions),
                  )
                }
              >
                Next →
              </Button>
            </nav>

            <div className="keyboard-shortcuts-hint" aria-hidden="true">
              <span>
                <kbd>←</kbd> <kbd>→</kbd> Navigate questions
              </span>
              <span>
                <kbd>1</kbd>–<kbd>9</kbd> or <kbd>A</kbd>–<kbd>Z</kbd> Select option
              </span>
            </div>
          </main>

          <QuestionPalette
            questions={questions}
            currentIndex={safeCurrentIndex}
            answersMap={progress.answersMap}
            saveStatusMap={progress.saveStatusMap}
            onSelectQuestion={navigateToQuestion}
          />
        </div>
      )}

      <SubmitConfirmModal
        isOpen={showSubmitModal}
        totalQuestions={totalQuestions}
        answeredCount={progress.answeredCount}
        unsavedCount={progress.errorCount}
        savingCount={progress.savingCount}
        onRetryUnsaved={handleRetryAllUnsaved}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        isSubmitting={submitAttemptMutation.isPending || isSubmittingAnswers}
      />
    </div>
  );
}
