import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAttempt, useSubmitAttempt, useSaveAnswer } from '../hooks/use-attempts';
import { QuestionCard } from '../components/QuestionCard';
import { QuestionPalette } from '../components/QuestionPalette';
import { QuizTimer } from '../components/QuizTimer';
import { SubmitConfirmModal } from '../components/SubmitConfirmModal';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Alert } from '@/components/feedback/Alert';
import { QuestionType } from '@/features/quizzes/types/quiz.types';
import { AttemptStatus } from '../types/attempt.types';

export default function QuizAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const { data: attempt, isLoading, error } = useAttempt(attemptId ?? '');
  const submitAttemptMutation = useSubmitAttempt();
  const saveAnswerMutation = useSaveAnswer();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswersMap, setUserAnswersMap] = useState<Record<string, string[]>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);
  const isSubmittingRef = useRef(false);

  // Derive initial answers map from attempt payload
  const initialAnswersMap = useMemo(() => {
    if (!attempt?.questions) return {};
    const map: Record<string, string[]> = {};
    for (const q of attempt.questions) {
      if (q.selectedOptionIds && q.selectedOptionIds.length > 0) {
        map[q.id] = q.selectedOptionIds;
      }
    }
    return map;
  }, [attempt]);

  // Combined answers map
  const answersMap = useMemo(() => {
    return { ...initialAnswersMap, ...userAnswersMap };
  }, [initialAnswersMap, userAnswersMap]);

  // If attempt is already submitted or expired, navigate to result
  useEffect(() => {
    if (attempt) {
      if (
        attempt.status === AttemptStatus.SUBMITTED ||
        attempt.status === AttemptStatus.EXPIRED
      ) {
        navigate(`/attempts/${attempt.attemptId}/result`, { replace: true });
      }
    }
  }, [attempt, navigate]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmittingAnswers(true);

    submitAttemptMutation.mutate(attemptId, {
      onSuccess: () => {
        navigate(`/attempts/${attemptId}/result`, { replace: true });
      },
      onError: (err) => {
        console.error('Failed to submit attempt:', err);
        isSubmittingRef.current = false;
        setIsSubmittingAnswers(false);
      },
    });
  }, [attemptId, submitAttemptMutation, navigate]);

  const handleExpire = useCallback(() => {
    if (isSubmittingRef.current) return;
    handleSubmit();
  }, [handleSubmit]);

  const questions = useMemo(() => attempt?.questions ?? [], [attempt]);
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  useEffect(() => {
    const handleNavKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'n') {
        if (currentIndex < totalQuestions - 1) {
          setCurrentIndex((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'p') {
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        setShowSubmitModal(true);
      }
    };

    window.addEventListener('keydown', handleNavKey);
    return () => window.removeEventListener('keydown', handleNavKey);
  }, [currentIndex, totalQuestions]);

  if (isLoading) {
    return <LoadingSpinner message="Loading quiz attempt..." />;
  }

  if (error || !attempt) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto' }}>
        <Alert variant="danger">
          {error instanceof Error ? error.message : 'Attempt not found or expired.'}
        </Alert>
      </div>
    );
  }

  const answeredCount = Object.keys(answersMap).filter(
    (key) => answersMap[key] && answersMap[key].length > 0
  ).length;

  const handleOptionSelect = (questionId: string, optionId: string) => {
    const q = questions.find((item) => item.id === questionId);
    if (!q) return;

    const currentSelected = userAnswersMap[questionId] ?? initialAnswersMap[questionId] ?? [];
    let nextOptionIds: string[];

    if (q.questionType === QuestionType.SINGLE_CHOICE || q.questionType === QuestionType.TRUE_FALSE) {
      nextOptionIds = [optionId];
    } else if (q.questionType === QuestionType.MULTIPLE_CHOICE) {
      const exists = currentSelected.includes(optionId);
      nextOptionIds = exists
        ? currentSelected.filter((id) => id !== optionId)
        : [...currentSelected, optionId];
    } else {
      nextOptionIds = [optionId];
    }

    setUserAnswersMap((prev) => ({ ...prev, [questionId]: nextOptionIds }));

    saveAnswerMutation.mutate({
      attemptId: attempt.attemptId,
      questionId,
      data: { optionIds: nextOptionIds },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '12px',
          border: '1px solid var(--color-border, #e5e7eb)',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
            {attempt.quizTitle}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <Badge variant="brand" size="sm">Attempt #{attempt.attemptId.slice(0, 8)}</Badge>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              Question {currentIndex + 1} of {totalQuestions}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {attempt.expiresAt && (
            <QuizTimer expiresAt={attempt.expiresAt} onExpire={handleExpire} />
          )}

          <Button
            variant="primary"
            onClick={() => setShowSubmitModal(true)}
            isLoading={submitAttemptMutation.isPending || isSubmittingAnswers}
          >
            Submit Attempt
          </Button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>
        <main style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={totalQuestions}
              selectedOptionIds={answersMap[currentQuestion.id] || []}
              onOptionSelect={(optId) => handleOptionSelect(currentQuestion.id, optId)}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              ← Previous
            </Button>
            <Button
              variant="primary"
              disabled={currentIndex === totalQuestions - 1}
              onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
            >
              Next →
            </Button>
          </div>
        </main>

        <QuestionPalette
          questions={questions}
          currentIndex={currentIndex}
          answersMap={answersMap}
          onSelectQuestion={(idx) => setCurrentIndex(idx)}
        />
      </div>

      <SubmitConfirmModal
        isOpen={showSubmitModal}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        isSubmitting={submitAttemptMutation.isPending || isSubmittingAnswers}
      />
    </div>
  );
}
