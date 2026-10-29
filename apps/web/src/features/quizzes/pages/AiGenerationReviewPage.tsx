import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  useAiGenerationReview,
  useSaveAiGenerationReview,
  useResetAiGenerationReview,
  useApplyAiGenerationQuestions,
  useCancelAiGeneration,
} from '../hooks/use-quizzes';
import {
  GenerationStatus,
  GenerationReviewStatus,
  QuizVersionStatus,
  QuestionType,
  DifficultyLevel,
  type ReviewQuestionItem,
  type ReviewOptionItem,
} from '../types/quiz.types';
import {
  validateReviewQuestionSet,
  reorderQuestions,
  areQuestionSetsEqual,
} from '../utils/review-validation';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Card, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';

export default function AiGenerationReviewPage() {
  const { quizId, generationId } = useParams<{ quizId: string; generationId: string }>();
  const navigate = useNavigate();

  const {
    data: review,
    isLoading,
    error,
  } = useAiGenerationReview(quizId ?? '', generationId ?? '');

  const saveReviewMutation = useSaveAiGenerationReview();
  const resetReviewMutation = useResetAiGenerationReview();
  const applyQuestionsMutation = useApplyAiGenerationQuestions();
  const cancelGenerationMutation = useCancelAiGeneration();

  const [editedQuestions, setEditedQuestions] = useState<ReviewQuestionItem[] | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const serverQuestions = useMemo(() => review?.questions ?? [], [review]);
  const activeQuestions = editedQuestions ?? serverQuestions;

  const hasUnsavedChanges = useMemo(() => {
    if (!editedQuestions) return false;
    return !areQuestionSetsEqual(editedQuestions, serverQuestions);
  }, [editedQuestions, serverQuestions]);

  // Warn browser before unload if there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const validation = useMemo(
    () => validateReviewQuestionSet(activeQuestions, true),
    [activeQuestions],
  );

  const isApplied = Boolean(review?.isApplied);
  const isCompleted = review?.status === GenerationStatus.COMPLETED;
  const isTargetDraft = review?.targetVersionStatus === QuizVersionStatus.DRAFT;
  const isEditable = Boolean(isCompleted && !isApplied && isTargetDraft);

  const handleBackToQuiz = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        'You have unsaved review edits. Are you sure you want to leave without saving?',
      )
    ) {
      return;
    }
    navigate(`/quizzes/${quizId}`);
  };

  const updateQuestionAt = (
    index: number,
    updater: (prev: ReviewQuestionItem) => ReviewQuestionItem,
  ) => {
    if (!isEditable) return;
    const next = activeQuestions.map((q, idx) => (idx === index ? updater(q) : q));
    setEditedQuestions(next);
  };

  const handleChangeQuestionType = (
    index: number,
    newType: QuestionType,
  ) => {
    updateQuestionAt(index, (prev) => {
      if (newType === QuestionType.TRUE_FALSE) {
        return {
          ...prev,
          questionType: QuestionType.TRUE_FALSE,
          correctAnswer: 'true',
          options: [
            { id: 'True', text: 'True', isCorrect: true, order: 1 },
            { id: 'False', text: 'False', isCorrect: false, order: 2 },
          ],
        };
      }
      // SINGLE_CHOICE or MULTIPLE_CHOICE
      const existingOpts =
        prev.options.length >= 2
          ? prev.options
          : [
              { id: 'A', text: 'Option A', isCorrect: true, order: 1 },
              { id: 'B', text: 'Option B', isCorrect: false, order: 2 },
            ];
      const normalizedOpts =
        newType === QuestionType.SINGLE_CHOICE
          ? existingOpts.map((o, idx) => ({
              ...o,
              isCorrect:
                existingOpts.findIndex((item) => item.isCorrect) === idx ||
                (!existingOpts.some((item) => item.isCorrect) && idx === 0),
            }))
          : existingOpts;

      return {
        ...prev,
        questionType: newType,
        options: normalizedOpts,
      };
    });
  };

  const handleOptionTextChange = (qIdx: number, optIdx: number, text: string) => {
    updateQuestionAt(qIdx, (prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === optIdx ? { ...o, text } : o)),
    }));
  };

  const handleToggleCorrectOption = (qIdx: number, optIdx: number) => {
    updateQuestionAt(qIdx, (prev) => {
      if (
        prev.questionType === QuestionType.SINGLE_CHOICE ||
        prev.questionType === QuestionType.TRUE_FALSE
      ) {
        const nextOptions = prev.options.map((o, i) => ({
          ...o,
          isCorrect: i === optIdx,
        }));
        const selectedOpt = nextOptions[optIdx];
        const nextCorrectAns =
          prev.questionType === QuestionType.TRUE_FALSE
            ? selectedOpt?.text.toLowerCase() === 'true'
              ? 'true'
              : 'false'
            : (selectedOpt?.id ?? null);
        return {
          ...prev,
          correctAnswer: nextCorrectAns,
          options: nextOptions,
        };
      }

      // MULTIPLE_CHOICE
      const nextOptions = prev.options.map((o, i) =>
        i === optIdx ? { ...o, isCorrect: !o.isCorrect } : o,
      );
      return {
        ...prev,
        correctAnswer: nextOptions
          .filter((o) => o.isCorrect)
          .map((o) => o.id)
          .join(','),
        options: nextOptions,
      };
    });
  };

  const handleAddOption = (qIdx: number) => {
    updateQuestionAt(qIdx, (prev) => {
      if (prev.options.length >= 8) return prev;
      const nextLetter = String.fromCharCode(65 + prev.options.length);
      const newOpt: ReviewOptionItem = {
        id: nextLetter,
        text: `Option ${nextLetter}`,
        isCorrect: false,
        order: prev.options.length + 1,
      };
      return {
        ...prev,
        options: [...prev.options, newOpt],
      };
    });
  };

  const handleRemoveOption = (qIdx: number, optIdx: number) => {
    updateQuestionAt(qIdx, (prev) => {
      if (prev.options.length <= 2) return prev;
      const filtered = prev.options
        .filter((_, i) => i !== optIdx)
        .map((o, i) => ({ ...o, order: i + 1 }));
      return {
        ...prev,
        options: filtered,
      };
    });
  };

  const handleMoveQuestion = (fromIdx: number, toIdx: number) => {
    if (!isEditable) return;
    setEditedQuestions(reorderQuestions(activeQuestions, fromIdx, toIdx));
  };

  const handleRemoveQuestion = (questionId: string) => {
    if (!isEditable) return;
    const filtered = activeQuestions
      .filter((q) => q.id !== questionId)
      .map((q, idx) => ({ ...q, order: idx + 1 }));
    setEditedQuestions(filtered);
    setConfirmRemoveId(null);
  };

  const handleSaveReviewDraft = () => {
    if (!quizId || !generationId || !isEditable) return;
    setActionError(null);
    setShowValidationErrors(true);

    const draftCheck = validateReviewQuestionSet(activeQuestions, false);
    if (!draftCheck.isValid) {
      setActionError(
        draftCheck.globalError || 'Please fix validation errors before saving review draft.',
      );
      return;
    }

    saveReviewMutation.mutate(
      {
        quizId,
        generationId,
        data: { questions: activeQuestions },
      },
      {
        onSuccess: (updated) => {
          setEditedQuestions(updated.questions);
          setShowValidationErrors(false);
          setSuccessBanner('Review draft saved successfully.');
          setTimeout(() => setSuccessBanner(null), 4000);
        },
        onError: (err) => {
          setActionError(
            err instanceof Error ? err.message : 'Failed to save review draft.',
          );
        },
      },
    );
  };

  const handleResetToOriginal = () => {
    if (!quizId || !generationId || !isEditable) return;
    if (
      !window.confirm(
        'Reset all reviewed questions back to the original AI-generated output? Any edits or removals will be discarded.',
      )
    ) {
      return;
    }
    setActionError(null);
    resetReviewMutation.mutate(
      { quizId, generationId },
      {
        onSuccess: (updated) => {
          setEditedQuestions(updated.questions);
          setShowValidationErrors(false);
          setSuccessBanner('Restored original AI-generated questions.');
          setTimeout(() => setSuccessBanner(null), 4000);
        },
        onError: (err) => {
          setActionError(
            err instanceof Error ? err.message : 'Failed to reset review draft.',
          );
        },
      },
    );
  };

  const handleApplyToDraftVersion = () => {
    if (!quizId || !generationId || !isEditable) return;
    setActionError(null);
    setShowValidationErrors(true);

    if (!validation.isValid) {
      setActionError(
        validation.globalError || 'Please fix all validation issues before applying.',
      );
      return;
    }

    applyQuestionsMutation.mutate(
      {
        quizId,
        generationId,
        data: {
          targetVersionId: review?.targetVersionId,
          questions: activeQuestions,
        },
      },
      {
        onSuccess: (result) => {
          setEditedQuestions(result.questions);
          setShowValidationErrors(false);
          setSuccessBanner(
            `Successfully applied ${result.appliedQuestionsCount} question${result.appliedQuestionsCount === 1 ? '' : 's'} to the draft quiz version!`,
          );
        },
        onError: (err) => {
          setActionError(
            err instanceof Error
              ? err.message
              : 'Failed to apply questions to draft version.',
          );
        },
      },
    );
  };

  const handleCancelGeneration = () => {
    if (!quizId || !generationId) return;
    setActionError(null);
    cancelGenerationMutation.mutate(
      { quizId, generationId },
      {
        onSuccess: () => {
          setSuccessBanner('Generation cancelled.');
        },
        onError: (err) => {
          setActionError(
            err instanceof Error ? err.message : 'Failed to cancel generation.',
          );
        },
      },
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading AI generation review workspace..." />;
  }

  if (error || !review) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Alert variant="danger">
          {error instanceof Error ? error.message : 'Failed to load AI generation review.'}
        </Alert>
        <div>
          <Button variant="outline" onClick={() => navigate(`/quizzes/${quizId}`)}>
            ← Back to Quiz
          </Button>
        </div>
      </div>
    );
  }

  const promptTopic = String(review.promptParams?.topic || 'Custom AI Generation');
  const sourceTypeLabel =
    review.promptParams?.sourceType === 'pdf' || review.promptParams?.originalFilename
      ? `PDF Document (${String(review.promptParams?.originalFilename || 'Uploaded PDF')})`
      : 'Topic / Text Prompt';

  const getReviewBadgeVariant = (status: GenerationReviewStatus) => {
    if (status === GenerationReviewStatus.APPLIED) return 'success';
    if (status === GenerationReviewStatus.REVIEWED) return 'brand';
    return 'warning';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Navigation & Primary Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <Button variant="outline" size="sm" onClick={handleBackToQuiz}>
          ← Back to Quiz
        </Button>

        {isEditable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {(review.hasCreatorEdits || hasUnsavedChanges) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToOriginal}
                isLoading={resetReviewMutation.isPending}
                disabled={
                  saveReviewMutation.isPending || applyQuestionsMutation.isPending
                }
              >
                Reset to Original AI Output
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveReviewDraft}
              isLoading={saveReviewMutation.isPending}
              disabled={applyQuestionsMutation.isPending}
            >
              {hasUnsavedChanges ? 'Save Review Draft *' : 'Save Review Draft'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyToDraftVersion}
              isLoading={applyQuestionsMutation.isPending}
              disabled={
                saveReviewMutation.isPending || activeQuestions.length === 0
              }
            >
              Apply {activeQuestions.length} Question
              {activeQuestions.length === 1 ? '' : 's'} to Draft Version
            </Button>
          </div>
        )}
      </div>

      {successBanner && <Alert variant="success">{successBanner}</Alert>}
      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {hasUnsavedChanges && !isApplied && (
        <Alert variant="warning">
          You have unsaved review changes. Save your review draft or apply the questions to your
          draft quiz version before leaving.
        </Alert>
      )}

      {/* Applied Banner */}
      {isApplied && (
        <Alert variant="success">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong>Applied to Draft Quiz Version:</strong>{' '}
              {review.appliedQuestionsCount ?? activeQuestions.length} approved question
              {(review.appliedQuestionsCount ?? activeQuestions.length) === 1 ? '' : 's'}{' '}
              were appended to your draft version
              {review.appliedAt
                ? ` on ${new Date(review.appliedAt).toLocaleString()}`
                : ''}
              . This generation is now locked to prevent duplicate question insertion.
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/quizzes/${quizId}`)}
            >
              Open Draft Quiz Editor →
            </Button>
          </div>
        </Alert>
      )}

      {/* Non-Draft Target Version Warning */}
      {isCompleted && !isApplied && !isTargetDraft && (
        <Alert variant="danger">
          Target quiz version is currently <strong>{review.targetVersionStatus ?? 'missing'}</strong>.
          Only <strong>DRAFT</strong> quiz versions can receive AI-generated questions.
        </Alert>
      )}

      {/* Generation Summary Card */}
      <Card variant="elevated">
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                  AI Question Review: {promptTopic}
                </h1>
                <Badge variant={getReviewBadgeVariant(review.reviewStatus)}>
                  {review.reviewStatus.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <p
                style={{
                  color: 'var(--color-text-secondary, #6b7280)',
                  margin: '6px 0 0 0',
                  fontSize: '0.875rem',
                }}
              >
                {review.stageDescription}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Badge
                variant={
                  review.status === GenerationStatus.COMPLETED
                    ? 'success'
                    : review.status === GenerationStatus.FAILED ||
                        review.status === GenerationStatus.CANCELLED
                      ? 'danger'
                      : 'brand'
                }
              >
                Job: {review.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'var(--color-bg-subtle, #f8fafc)',
              border: '1px solid var(--color-border, #e2e8f0)',
              fontSize: '0.825rem',
            }}
          >
            <div>
              <div style={{ color: 'var(--color-text-muted, #6b7280)', fontWeight: 600 }}>
                Source Type
              </div>
              <div style={{ fontWeight: 700, marginTop: '2px' }}>{sourceTypeLabel}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted, #6b7280)', fontWeight: 600 }}>
                Questions in Review
              </div>
              <div style={{ fontWeight: 700, marginTop: '2px' }}>
                {activeQuestions.length} question{activeQuestions.length === 1 ? '' : 's'}
                {review.promptParams?.targetQuestionCount
                  ? ` (requested ${String(review.promptParams.targetQuestionCount)})`
                  : ''}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted, #6b7280)', fontWeight: 600 }}>
                Target Draft Version
              </div>
              <div style={{ fontWeight: 700, marginTop: '2px' }}>
                {review.targetVersionStatus
                  ? `${review.targetVersionStatus.toUpperCase()} (${review.targetVersionExistingQuestionCount} existing questions)`
                  : review.targetVersionId}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted, #6b7280)', fontWeight: 600 }}>
                Generated At
              </div>
              <div style={{ fontWeight: 700, marginTop: '2px' }}>
                {review.completedAt
                  ? new Date(review.completedAt).toLocaleString()
                  : new Date(review.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Active / Pending State */}
      {(review.status === GenerationStatus.PENDING ||
        review.status === GenerationStatus.PROCESSING) && (
        <Card variant="default">
          <CardBody
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              padding: '36px 24px',
              textAlign: 'center',
            }}
          >
            <LoadingSpinner message={review.stageDescription || 'Generating questions...'} />
            <p style={{ color: 'var(--color-text-secondary, #6b7280)', maxWidth: '480px', margin: 0 }}>
              This page automatically updates as the AI generation pipeline progresses. Once
              completed, your questions will appear here for review before being added to your
              draft quiz version.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelGeneration}
              isLoading={cancelGenerationMutation.isPending}
            >
              Cancel Generation
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Failed / Cancelled State */}
      {(review.status === GenerationStatus.FAILED ||
        review.status === GenerationStatus.CANCELLED) && (
        <Alert variant="danger">
          <div>
            <strong>
              Generation {review.status === GenerationStatus.CANCELLED ? 'Cancelled' : 'Failed'}:
            </strong>{' '}
            {review.errorMessage || review.stageDescription}
          </div>
        </Alert>
      )}

      {/* Completed Questions Review List */}
      {isCompleted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeQuestions.length === 0 ? (
            <Card variant="default">
              <CardBody style={{ textAlign: 'center', padding: '32px' }}>
                <p style={{ fontWeight: 600, marginBottom: '12px' }}>
                  All questions have been removed from this review set.
                </p>
                {isEditable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetToOriginal}
                    isLoading={resetReviewMutation.isPending}
                  >
                    Restore Original AI Questions
                  </Button>
                )}
              </CardBody>
            </Card>
          ) : (
            activeQuestions.map((question, qIdx) => {
              const qErrors = validation.questionErrors[question.id] ?? [];
              const hasCardErrors = showValidationErrors && qErrors.length > 0;

              return (
                <div
                  key={question.id}
                  draggable={isEditable}
                  onDragStart={() => setDraggedIndex(qIdx)}
                  onDragOver={(e) => {
                    if (!isEditable) return;
                    e.preventDefault();
                  }}
                  onDrop={() => {
                    if (!isEditable || draggedIndex === null || draggedIndex === qIdx) {
                      setDraggedIndex(null);
                      return;
                    }
                    handleMoveQuestion(draggedIndex, qIdx);
                    setDraggedIndex(null);
                  }}
                  style={{
                    borderRadius: '10px',
                    border: hasCardErrors
                      ? '2px solid var(--color-danger, #ef4444)'
                      : '1px solid var(--color-border, #e2e8f0)',
                    background: 'var(--color-surface, #ffffff)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {/* Card Header: Order, Reorder Controls, Badges, Remove */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Badge variant="brand">Question {qIdx + 1}</Badge>
                      {question.difficulty && (
                        <Badge variant="neutral" size="sm">
                          Difficulty: {question.difficulty}
                        </Badge>
                      )}
                      {question.cognitiveLevel && (
                        <Badge variant="neutral" size="sm">
                          Bloom: {question.cognitiveLevel}
                        </Badge>
                      )}
                    </div>

                    {isEditable && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={qIdx === 0}
                          onClick={() => handleMoveQuestion(qIdx, qIdx - 1)}
                          aria-label={`Move question ${qIdx + 1} up`}
                        >
                          ↑ Up
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={qIdx === activeQuestions.length - 1}
                          onClick={() => handleMoveQuestion(qIdx, qIdx + 1)}
                          aria-label={`Move question ${qIdx + 1} down`}
                        >
                          ↓ Down
                        </Button>

                        {confirmRemoveId === question.id ? (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleRemoveQuestion(question.id)}
                            >
                              Confirm Remove
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmRemoveId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setConfirmRemoveId(question.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Validation Errors for this question */}
                  {hasCardErrors && (
                    <Alert variant="danger">
                      <ul style={{ margin: 0, paddingLeft: '18px' }}>
                        {qErrors.map((errMsg, errIdx) => (
                          <li key={errIdx}>{errMsg}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}

                  {/* Question Stem */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label
                      htmlFor={`q-text-${question.id}`}
                      style={{ fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      Question Prompt
                    </label>
                    <textarea
                      id={`q-text-${question.id}`}
                      value={question.text}
                      disabled={!isEditable}
                      onChange={(e) =>
                        updateQuestionAt(qIdx, (prev) => ({
                          ...prev,
                          text: e.target.value,
                        }))
                      }
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        fontSize: '0.95rem',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  {/* Question Metadata Controls: Type, Marks, Difficulty */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label
                        htmlFor={`q-type-${question.id}`}
                        style={{ fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Question Type
                      </label>
                      <select
                        id={`q-type-${question.id}`}
                        value={question.questionType}
                        disabled={!isEditable}
                        onChange={(e) =>
                          handleChangeQuestionType(
                            qIdx,
                            e.target.value as QuestionType,
                          )
                        }
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border, #cbd5e1)',
                          fontSize: '0.875rem',
                        }}
                      >
                        <option value={QuestionType.SINGLE_CHOICE}>Single Choice (MCQ)</option>
                        <option value={QuestionType.MULTIPLE_CHOICE}>Multiple Choice</option>
                        <option value={QuestionType.TRUE_FALSE}>True / False</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label
                        htmlFor={`q-marks-${question.id}`}
                        style={{ fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Marks (1–100)
                      </label>
                      <input
                        id={`q-marks-${question.id}`}
                        type="number"
                        min={1}
                        max={100}
                        value={question.marks}
                        disabled={!isEditable}
                        onChange={(e) =>
                          updateQuestionAt(qIdx, (prev) => ({
                            ...prev,
                            marks: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border, #cbd5e1)',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label
                        htmlFor={`q-diff-${question.id}`}
                        style={{ fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Difficulty
                      </label>
                      <select
                        id={`q-diff-${question.id}`}
                        value={question.difficulty || DifficultyLevel.MEDIUM}
                        disabled={!isEditable}
                        onChange={(e) =>
                          updateQuestionAt(qIdx, (prev) => ({
                            ...prev,
                            difficulty: e.target.value,
                          }))
                        }
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border, #cbd5e1)',
                          fontSize: '0.875rem',
                        }}
                      >
                        <option value={DifficultyLevel.EASY}>Easy</option>
                        <option value={DifficultyLevel.MEDIUM}>Medium</option>
                        <option value={DifficultyLevel.HARD}>Hard</option>
                      </select>
                    </div>
                  </div>

                  {/* Answer Options Editor */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                        Answer Options (click badge to mark correct)
                      </span>
                      {isEditable &&
                        question.questionType !== QuestionType.TRUE_FALSE &&
                        question.options.length < 8 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddOption(qIdx)}
                          >
                            + Add Option
                          </Button>
                        )}
                    </div>

                    {question.options.map((opt, optIdx) => (
                      <div
                        key={`${question.id}-opt-${optIdx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: opt.isCorrect
                            ? 'var(--color-success-bg, #f0fdf4)'
                            : 'var(--color-bg-subtle, #f8fafc)',
                          border: opt.isCorrect
                            ? '1px solid var(--color-success-border, #86efac)'
                            : '1px solid var(--color-border, #e2e8f0)',
                        }}
                      >
                        <button
                          type="button"
                          disabled={!isEditable}
                          onClick={() => handleToggleCorrectOption(qIdx, optIdx)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: isEditable ? 'pointer' : 'default',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            background: opt.isCorrect ? '#16a34a' : '#e2e8f0',
                            color: opt.isCorrect ? '#ffffff' : '#334155',
                          }}
                        >
                          {opt.isCorrect ? '✓ Correct' : String.fromCharCode(65 + optIdx)}
                        </button>

                        <input
                          type="text"
                          value={opt.text}
                          disabled={
                            !isEditable ||
                            question.questionType === QuestionType.TRUE_FALSE
                          }
                          aria-label={`Question ${qIdx + 1} Option ${optIdx + 1}`}
                          onChange={(e) =>
                            handleOptionTextChange(qIdx, optIdx, e.target.value)
                          }
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border, #cbd5e1)',
                            fontSize: '0.875rem',
                          }}
                        />

                        {isEditable &&
                          question.questionType !== QuestionType.TRUE_FALSE &&
                          question.options.length > 2 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveOption(qIdx, optIdx)}
                            >
                              ✕
                            </Button>
                          )}
                      </div>
                    ))}
                  </div>

                  {/* Explanation / Rationale */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label
                      htmlFor={`q-exp-${question.id}`}
                      style={{ fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      Explanation / Rationale (Optional)
                    </label>
                    <textarea
                      id={`q-exp-${question.id}`}
                      value={question.explanation ?? ''}
                      disabled={!isEditable}
                      onChange={(e) =>
                        updateQuestionAt(qIdx, (prev) => ({
                          ...prev,
                          explanation: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Explain why the correct answer is right..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        fontSize: '0.85rem',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Bottom Action Bar */}
      {isEditable && activeQuestions.length > 0 && (
        <Card variant="default">
          <CardBody
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #475569)' }}>
              Ready to add <strong>{activeQuestions.length}</strong> reviewed question
              {activeQuestions.length === 1 ? '' : 's'} to your draft quiz version? Existing draft
              questions ({review.targetVersionExistingQuestionCount}) will be preserved.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveReviewDraft}
                isLoading={saveReviewMutation.isPending}
                disabled={applyQuestionsMutation.isPending}
              >
                Save Review Draft
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyToDraftVersion}
                isLoading={applyQuestionsMutation.isPending}
                disabled={saveReviewMutation.isPending}
              >
                Apply {activeQuestions.length} Question
                {activeQuestions.length === 1 ? '' : 's'} to Draft Version
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
