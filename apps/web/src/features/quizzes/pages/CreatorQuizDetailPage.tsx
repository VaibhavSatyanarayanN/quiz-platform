import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router';
import {
  useCreatorQuizDetails,
  useUpdateQuiz,
  useUpdateQuizVersion,
  useBulkSaveQuestions,
  usePublishVersion,
  useDiscardVersion,
  useCreateNewVersion,
  useAiGenerations,
  useGenerateAiQuestions,
  useGenerateAiQuestionsFromPdf,
  useCancelAiGeneration,
} from '../hooks/use-quizzes';
import { QuestionEditor } from '../components/QuestionEditor';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { Alert } from '@/components/feedback/Alert';
import {
  QuizVersionStatus,
  QuestionType,
  DifficultyLevel,
  GenerationStatus,
  GenerationReviewStatus,
  type CreateQuestionRequest,
} from '../types/quiz.types';
import styles from './CreatorQuizDetailPage.module.css';

const isUuid = (str?: string): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export default function CreatorQuizDetailPage() {
  const { quizId, versionId } = useParams<{ quizId: string; versionId?: string }>();
  const navigate = useNavigate();
  const { data: quiz, isLoading, error } = useCreatorQuizDetails(quizId ?? '');
  const { data: aiGenerations = [] } = useAiGenerations(quizId ?? '');

  const updateQuizMutation = useUpdateQuiz();
  const updateQuizVersionMutation = useUpdateQuizVersion();
  const bulkSaveQuestionsMutation = useBulkSaveQuestions();
  const publishVersionMutation = usePublishVersion();
  const discardVersionMutation = useDiscardVersion();
  const createNewVersionMutation = useCreateNewVersion();
  const generateAiMutation = useGenerateAiQuestions();
  const generateAiPdfMutation = useGenerateAiQuestionsFromPdf();
  const cancelAiMutation = useCancelAiGeneration();

  const [selectedVersionIdState, setSelectedVersionId] = useState<string | null>(null);
  const [draftQuestionsState, setDraftQuestionsState] = useState<CreateQuestionRequest[] | null>(null);

  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [isEditingVersionSettings, setIsEditingVersionSettings] = useState(false);
  const [versionTimeLimitMinutes, setVersionTimeLimitMinutes] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const [searchParams] = useSearchParams();
  const [showAiGenerator, setShowAiGenerator] = useState(
    () => searchParams.get('ai') === 'open' || searchParams.get('ai') === 'true',
  );
  const [aiMode, setAiMode] = useState<'topic' | 'pdf'>('topic');
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<DifficultyLevel>(DifficultyLevel.MEDIUM);
  const [aiPdfFile, setAiPdfFile] = useState<File | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const latestVersionId = useMemo(() => {
    if (!quiz?.versions?.length) return null;
    return [...quiz.versions].sort((a, b) => b.version - a.version)[0]?.id ?? null;
  }, [quiz]);

  const selectedVersionId = selectedVersionIdState || versionId || latestVersionId;

  const selectedVersion = useMemo(() => {
    if (!quiz?.versions) return undefined;
    return quiz.versions.find((v) => v.id === selectedVersionId);
  }, [quiz, selectedVersionId]);

  const existingDraftVersion = useMemo(() => {
    return quiz?.versions?.find((v) => v.status === QuizVersionStatus.DRAFT);
  }, [quiz]);

  const inFlightAiCount = useMemo(() => {
    if (!selectedVersionId) return 0;
    return aiGenerations.filter(
      (g) =>
        g.targetVersionId === selectedVersionId &&
        (g.status === GenerationStatus.PENDING || g.status === GenerationStatus.PROCESSING),
    ).length;
  }, [aiGenerations, selectedVersionId]);

  const draftQuestions = useMemo(() => {
    if (draftQuestionsState !== null) return draftQuestionsState;
    if (!selectedVersion?.questions) return [];
    return selectedVersion.questions.map((q) => ({
      id: q.id,
      text: q.text,
      questionType: q.questionType,
      marks: q.marks,
      options: q.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
      })),
    }));
  }, [draftQuestionsState, selectedVersion]);

  const publishingChecklist = useMemo(() => {
    const issues: string[] = [];

    if (!quiz?.title?.trim()) {
      issues.push('Quiz title cannot be empty.');
    }

    if (draftQuestions.length === 0) {
      issues.push('At least 1 question is required before publishing.');
    }

    draftQuestions.forEach((q, idx) => {
      const num = idx + 1;
      if (!q.text.trim()) {
        issues.push(`Question ${num} prompt is empty.`);
      }
      if (q.marks < 1) {
        issues.push(`Question ${num} marks must be at least 1.`);
      }
      if (q.questionType === QuestionType.TRUE_FALSE) {
        if (q.options.length !== 2) {
          issues.push(`Question ${num} (True/False) must have exactly 2 options.`);
        }
      } else {
        if (q.options.length < 2) {
          issues.push(`Question ${num} (${q.questionType}) must have at least 2 options.`);
        }
      }

      const optTexts = new Set<string>();
      q.options.forEach((opt, oIdx) => {
        const oLabel = String.fromCharCode(65 + oIdx);
        if (!opt.text.trim()) {
          issues.push(`Question ${num}, Option ${oLabel} cannot be empty.`);
        }
        const norm = opt.text.trim().toLowerCase();
        if (optTexts.has(norm)) {
          issues.push(`Question ${num} has duplicate option text "${opt.text.trim()}".`);
        }
        optTexts.add(norm);
      });

      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (q.questionType === QuestionType.SINGLE_CHOICE || q.questionType === QuestionType.TRUE_FALSE) {
        if (correctCount !== 1) {
          issues.push(
            `Question ${num} (${q.questionType}) must have exactly 1 correct answer (currently has ${correctCount}).`,
          );
        }
      } else if (q.questionType === QuestionType.MULTIPLE_CHOICE) {
        if (correctCount < 1) {
          issues.push(`Question ${num} (Multiple Choice) must have at least 1 correct answer.`);
        }
      }
    });

    if (inFlightAiCount > 0) {
      issues.push(`${inFlightAiCount} AI generation run(s) are currently in progress.`);
    }

    return {
      isReady: issues.length === 0,
      issues,
    };
  }, [quiz?.title, draftQuestions, inFlightAiCount]);

  const handleSelectVersion = (vId: string) => {
    if (draftQuestionsState !== null) {
      const confirmSwitch = window.confirm(
        'You have unsaved changes in this draft version. Switching versions will discard unsaved edits. Are you sure you want to proceed?',
      );
      if (!confirmSwitch) return;
    }
    setSelectedVersionId(vId);
    setDraftQuestionsState(null);
    setIsEditingVersionSettings(false);
  };

  const setDraftQuestions = (questions: CreateQuestionRequest[]) => {
    setDraftQuestionsState(questions);
  };

  const handleStartMetaEdit = () => {
    if (!quiz) return;
    setEditTitle(quiz.title);
    setEditDescription(quiz.description || '');
    setIsEditingMeta(true);
  };

  const handleStartVersionSettingsEdit = () => {
    setVersionTimeLimitMinutes(
      selectedVersion?.timeLimitSeconds
        ? String(Math.round(selectedVersion.timeLimitSeconds / 60))
        : '',
    );
    setIsEditingVersionSettings(true);
  };

  const handleSaveVersionSettings = () => {
    if (!quizId || !selectedVersionId) return;
    setActionError(null);
    const trimmed = versionTimeLimitMinutes.trim();
    let timeLimitSeconds: number | null = null;
    if (trimmed) {
      const mins = Number(trimmed);
      if (isNaN(mins) || mins < 1) {
        setActionError('Time limit must be a positive integer in minutes (or leave empty for untimed).');
        return;
      }
      timeLimitSeconds = Math.round(mins * 60);
    }

    updateQuizVersionMutation.mutate(
      {
        quizId,
        versionId: selectedVersionId,
        data: { timeLimitSeconds },
      },
      {
        onSuccess: () => {
          setIsEditingVersionSettings(false);
          setSuccessBanner('Version time limit updated successfully.');
          setTimeout(() => setSuccessBanner(null), 3500);
        },
        onError: (err) => {
          setActionError(err instanceof Error ? err.message : 'Failed to update version settings.');
        },
      },
    );
  };

  const handleSaveMeta = () => {
    if (!quizId) return;
    setActionError(null);
    updateQuizMutation.mutate(
      {
        quizId,
        data: {
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setIsEditingMeta(false);
          setSuccessBanner('Quiz details updated successfully.');
          setTimeout(() => setSuccessBanner(null), 3500);
        },
      },
    );
  };

  const handleSaveQuestions = () => {
    if (!quizId || !selectedVersionId) return;
    setActionError(null);

    if (draftQuestions.length === 0) {
      setActionError('Add at least 1 question before saving.');
      return;
    }

    for (let i = 0; i < draftQuestions.length; i++) {
      const q = draftQuestions[i];
      if (!q.text.trim()) {
        setActionError(`Question ${i + 1} has an empty prompt.`);
        return;
      }
      if (q.options.length < 2) {
        setActionError(`Question ${i + 1} must have at least 2 options.`);
        return;
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].text.trim()) {
          setActionError(`Question ${i + 1}, Option ${String.fromCharCode(65 + j)} cannot be empty.`);
          return;
        }
      }

      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (q.questionType === QuestionType.SINGLE_CHOICE || q.questionType === QuestionType.TRUE_FALSE) {
        if (correctCount !== 1) {
          setActionError(
            `Question ${i + 1} (${q.questionType}) must have exactly 1 correct answer. Currently has ${correctCount}.`,
          );
          return;
        }
      } else if (q.questionType === QuestionType.MULTIPLE_CHOICE) {
        if (correctCount < 1) {
          setActionError(`Question ${i + 1} (Multiple Choice) must have at least 1 correct answer.`);
          return;
        }
      }
    }

    const payload = draftQuestions.map((q) => ({
      ...(isUuid(q.id) ? { id: q.id } : {}),
      text: q.text,
      questionType: q.questionType,
      marks: q.marks,
      options: q.options.map((o) => ({
        ...(isUuid(o.id) ? { id: o.id } : {}),
        text: o.text,
        isCorrect: o.isCorrect,
      })),
    }));

    bulkSaveQuestionsMutation.mutate(
      {
        quizId,
        versionId: selectedVersionId,
        data: { questions: payload },
      },
      {
        onSuccess: () => {
          setDraftQuestionsState(null);
          setSuccessBanner('Draft questions saved successfully.');
          setTimeout(() => setSuccessBanner(null), 3500);
        },
        onError: (err) => {
          setActionError(err instanceof Error ? err.message : 'Failed to save questions.');
        },
      },
    );
  };

  const handlePublish = () => {
    if (!quizId || !selectedVersionId) return;
    if (!publishingChecklist.isReady) {
      setActionError(
        `Cannot publish: please resolve all blockers first:\n• ${publishingChecklist.issues.join('\n• ')}`,
      );
      return;
    }
    setActionError(null);
    publishVersionMutation.mutate(
      { quizId, versionId: selectedVersionId },
      {
        onSuccess: () => {
          setSuccessBanner('Quiz version published live! It is now immutable.');
          setTimeout(() => setSuccessBanner(null), 3500);
        },
        onError: (err) => {
          setActionError(err instanceof Error ? err.message : 'Failed to publish version.');
        },
      },
    );
  };

  const handleCreateNewVersion = () => {
    if (!quizId) return;
    setActionError(null);
    createNewVersionMutation.mutate(quizId, {
      onSuccess: (data) => {
        setSuccessBanner(`Created new draft version v${data.version}!`);
        setSelectedVersionId(data.id || data.quizVersionId);
        setDraftQuestionsState(null);
        setTimeout(() => setSuccessBanner(null), 3500);
      },
      onError: (err) => {
        setActionError(err instanceof Error ? err.message : 'Failed to create new version.');
      },
    });
  };

  const handleDiscardVersion = () => {
    if (!quizId || !selectedVersionId) return;
    if (
      !window.confirm(
        'Are you sure you want to discard this draft version? All unsaved questions will be lost.',
      )
    ) {
      return;
    }
    setActionError(null);
    discardVersionMutation.mutate(
      { quizId, versionId: selectedVersionId },
      {
        onSuccess: () => {
          setSuccessBanner('Draft version discarded.');
          setSelectedVersionId(null);
          setDraftQuestionsState(null);
          setTimeout(() => setSuccessBanner(null), 3500);
        },
        onError: (err) => {
          setActionError(err instanceof Error ? err.message : 'Failed to discard version.');
        },
      },
    );
  };

  const handleStartAiGeneration = () => {
    if (!quizId || !selectedVersionId) return;
    setActionError(null);

    if (aiMode === 'pdf') {
      if (!aiPdfFile) {
        setActionError('Please select a PDF file to upload for AI question generation.');
        return;
      }
      generateAiPdfMutation.mutate(
        {
          quizId,
          versionId: selectedVersionId,
          file: aiPdfFile,
          data: {
            topic: aiTopic.trim() || undefined,
            targetQuestionCount: aiCount,
            difficulty: aiDifficulty,
            questionTypes: [QuestionType.SINGLE_CHOICE, QuestionType.TRUE_FALSE],
          },
        },
        {
          onSuccess: (res) => {
            setShowAiGenerator(false);
            setAiPdfFile(null);
            navigate(`/quizzes/${quizId}/ai-generations/${res.generationId}/review`);
          },
          onError: (err) => {
            setActionError(
              err instanceof Error ? err.message : 'Failed to start PDF AI generation.',
            );
          },
        },
      );
      return;
    }

    if (!aiTopic.trim()) {
      setActionError('Please enter a topic or prompt for AI question generation.');
      return;
    }

    generateAiMutation.mutate(
      {
        quizId,
        versionId: selectedVersionId,
        data: {
          topic: aiTopic.trim(),
          targetQuestionCount: aiCount,
          difficulty: aiDifficulty,
          questionTypes: [QuestionType.SINGLE_CHOICE, QuestionType.TRUE_FALSE],
        },
      },
      {
        onSuccess: (res) => {
          setShowAiGenerator(false);
          setAiTopic('');
          navigate(`/quizzes/${quizId}/ai-generations/${res.generationId}/review`);
        },
        onError: (err) => {
          setActionError(
            err instanceof Error ? err.message : 'Failed to start AI question generation.',
          );
        },
      },
    );
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading quiz details..." />;
  }

  if (error || !quiz) {
    return (
      <div className={styles.pageContainer}>
        <Alert variant="danger">
          {error instanceof Error ? error.message : 'Failed to load quiz details.'}
        </Alert>
        <Link to="/quizzes">
          <Button variant="outline" size="sm">
            Back to Quizzes
          </Button>
        </Link>
      </div>
    );
  }

  const isDraft = selectedVersion?.status === QuizVersionStatus.DRAFT;
  const isPublished = selectedVersion?.status === QuizVersionStatus.PUBLISHED;

  return (
    <div className={styles.pageContainer}>
      {/* Top Navigation & Action Cluster */}
      <div className={styles.topNav}>
        <div className={styles.breadcrumbRow}>
          <button
            type="button"
            onClick={() => navigate('/quizzes')}
            className={styles.backLink}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Back to Quizzes</span>
          </button>
          <span className={styles.breadcrumbDivider}>/</span>
          <span className={styles.breadcrumbCurrent}>{quiz.title}</span>
        </div>

        <div className={styles.navActionCluster}>
          <Link to={`/quizzes/${quiz.id}/analytics`}>
            <Button variant="outline" size="sm">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: 6 }}
                aria-hidden="true"
              >
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
              Analytics Workbench
            </Button>
          </Link>

          {isPublished && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCreateNewVersion}
              isLoading={createNewVersionMutation.isPending}
            >
              Create New Version
            </Button>
          )}

          {isDraft && (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDiscardVersion}
                isLoading={discardVersionMutation.isPending}
              >
                Discard Draft
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePublish}
                isLoading={publishVersionMutation.isPending}
              >
                Publish Version Live
              </Button>
            </>
          )}
        </div>
      </div>

      {successBanner && <Alert variant="success">{successBanner}</Alert>}
      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {/* Quiz Metadata Header Card */}
      <div className={styles.metaCard}>
        {isEditingMeta ? (
          <div className={styles.metaEditForm}>
            <Input
              label="Quiz Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />
            <Input
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
            <div className={styles.metaEditActions}>
              <Button variant="ghost" size="sm" onClick={() => setIsEditingMeta(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveMeta}
                isLoading={updateQuizMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.metaHeaderRow}>
            <div className={styles.titleArea}>
              <h1 className={styles.quizTitle}>{quiz.title}</h1>
              <p className={styles.quizDescription}>
                {quiz.description || 'No description provided for this assessment.'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleStartMetaEdit}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: 5 }}
                aria-hidden="true"
              >
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Edit Details
            </Button>
          </div>
        )}
      </div>

      {/* Version Navigation Segmented Bar */}
      {quiz.versions && quiz.versions.length > 0 && (
        <div className={styles.versionPickerCard}>
          <div className={styles.versionPickerLeft}>
            <span className={styles.versionPickerLabel}>Versions:</span>
            <div className={styles.versionTabTrack}>
              {quiz.versions.map((v) => {
                const isSelected = v.id === selectedVersionId;
                const isVPublished = v.status === QuizVersionStatus.PUBLISHED;
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`${styles.versionTab} ${isSelected ? styles.versionTabActive : ''}`}
                    onClick={() => handleSelectVersion(v.id)}
                  >
                    <span>v{v.version}</span>
                    <span
                      className={`${styles.tabStatusBadge} ${isVPublished ? styles.tabStatusPublished : styles.tabStatusDraft
                        }`}
                    >
                      {v.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!existingDraftVersion && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateNewVersion}
              isLoading={createNewVersionMutation.isPending}
            >
              + New Draft Version
            </Button>
          )}
        </div>
      )}

      {/* Selected Version Workspace */}
      {selectedVersion && (
        <div className={styles.workspaceCard}>
          <div className={styles.workspaceHeader}>
            <div>
              <h2 className={styles.workspaceTitle}>
                Version {selectedVersion.version}
              </h2>
              <p className={styles.workspaceSubtitle}>
                {isDraft
                  ? 'Active draft version workbench. Changes are staged until published.'
                  : 'Published immutable version locked for historical score preservation.'}
              </p>
            </div>
            <span
              className={`${styles.statusPill} ${selectedVersion.status === QuizVersionStatus.PUBLISHED
                  ? styles.badgeSuccess
                  : styles.badgeWarning
                }`}
            >
              {selectedVersion.status.toUpperCase()}
            </span>
          </div>

          {/* Version Timing & Settings Bar */}
          <div className={styles.timingStrip}>
            <div className={styles.timingCluster}>
              <div className={styles.timingIconBox} aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className={styles.timingDetails}>
                <span className={styles.timingLabel}>Attempt Time Limit</span>
                <span className={styles.timingValue}>
                  {selectedVersion.timeLimitSeconds
                    ? `${Math.round(selectedVersion.timeLimitSeconds / 60)} minutes (${selectedVersion.timeLimitSeconds}s)`
                    : 'Untimed (No deadline)'}
                </span>
              </div>
            </div>

            {isDraft && !isEditingVersionSettings && (
              <Button variant="outline" size="sm" onClick={handleStartVersionSettingsEdit}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 5 }}
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Adjust Time Limit
              </Button>
            )}
          </div>

          {/* Time Limit Edit Form */}
          {isDraft && isEditingVersionSettings && (
            <div className={styles.timingEditForm}>
              <div className={styles.timingEditTitle}>
                Configure Version {selectedVersion.version} Timing
              </div>
              <Input
                label="Time Limit in Minutes (leave empty for untimed quiz)"
                type="number"
                min="1"
                placeholder="e.g. 15, or leave empty"
                value={versionTimeLimitMinutes}
                onChange={(e) => setVersionTimeLimitMinutes(e.target.value)}
              />
              <div className={styles.timingEditActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingVersionSettings(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveVersionSettings}
                  isLoading={updateQuizVersionMutation.isPending}
                >
                  Save Time Limit
                </Button>
              </div>
            </div>
          )}

          {/* Publishing Readiness Banners for Draft */}
          {isDraft && (
            <div>
              {publishingChecklist.isReady ? (
                <div className={styles.readinessReadyCard}>
                  <div className={styles.readinessReadyText}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.readinessCheckIcon}
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>
                      <strong>Ready to Publish:</strong> All question and timing criteria are
                      satisfied for version {selectedVersion.version}.
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handlePublish}
                    isLoading={publishVersionMutation.isPending}
                  >
                    Publish Version Live
                  </Button>
                </div>
              ) : (
                <div className={styles.readinessBlockersCard}>
                  <div className={styles.readinessBlockersTitle}>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      Publishing Readiness Blockers ({publishingChecklist.issues.length})
                    </span>
                  </div>
                  <ul className={styles.readinessBlockersList}>
                    {publishingChecklist.issues.map((iss) => (
                      <li key={iss}>{iss}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {isDraft ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* AI Question Generation Panel */}
              <div className={styles.aiPanel}>
                <div className={styles.aiPanelHeader}>
                  <div className={styles.aiPanelTitleArea}>
                    <h3 className={styles.aiPanelTitle}>AI Question Studio</h3>
                    <p className={styles.aiPanelSubtitle}>
                      Generate questions from topic concepts or PDF source documents, review and
                      tune choices, then apply them to this draft version.
                    </p>
                  </div>
                  <Button
                    variant={showAiGenerator ? 'outline' : 'secondary'}
                    size="sm"
                    onClick={() => setShowAiGenerator((prev) => !prev)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginRight: 6 }}
                      aria-hidden="true"
                    >
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    {showAiGenerator ? 'Close Studio' : 'Generate with AI'}
                  </Button>
                </div>

                {showAiGenerator && (
                  <div className={styles.aiDrawer}>
                    <div className={styles.aiModeSwitcher}>
                      <Button
                        variant={aiMode === 'topic' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setAiMode('topic')}
                      >
                        From Topic / Objective
                      </Button>
                      <Button
                        variant={aiMode === 'pdf' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setAiMode('pdf')}
                      >
                        From PDF Document
                      </Button>
                    </div>

                    {aiMode === 'pdf' && (
                      <div className={styles.fileInputWrapper}>
                        <label className={styles.fieldLabel}>
                          Source PDF Document (max 10 MB)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => setAiPdfFile(e.target.files?.[0] ?? null)}
                        />
                      </div>
                    )}

                    <Input
                      label={
                        aiMode === 'pdf'
                          ? 'Focus Topic (Optional)'
                          : 'Topic or Learning Objective'
                      }
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="e.g., Distributed Consensus, Raft Protocol, and State Machines"
                    />

                    <div className={styles.aiFormGrid}>
                      <div className={styles.formField}>
                        <label className={styles.fieldLabel}>Question Count (1–20)</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={aiCount}
                          onChange={(e) =>
                            setAiCount(Math.min(20, Math.max(1, Number(e.target.value) || 5)))
                          }
                          className={styles.fieldInput}
                        />
                      </div>

                      <div className={styles.formField}>
                        <label className={styles.fieldLabel}>Target Difficulty</label>
                        <select
                          value={aiDifficulty}
                          onChange={(e) => setAiDifficulty(e.target.value as DifficultyLevel)}
                          className={styles.fieldSelect}
                        >
                          <option value={DifficultyLevel.EASY}>Easy</option>
                          <option value={DifficultyLevel.MEDIUM}>Medium</option>
                          <option value={DifficultyLevel.HARD}>Hard</option>
                        </select>
                      </div>
                    </div>

                    <div className={styles.aiDrawerActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAiGenerator(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleStartAiGeneration}
                        isLoading={generateAiMutation.isPending || generateAiPdfMutation.isPending}
                      >
                        Start Generation
                      </Button>
                    </div>
                  </div>
                )}

                {/* Recent AI Generation Runs Feed */}
                {aiGenerations.filter((g) => g.targetVersionId === selectedVersion.id).length >
                  0 && (
                    <div className={styles.aiRunsSection}>
                      <div className={styles.aiRunsHeader}>
                        AI Generation Runs for Version {selectedVersion.version}
                      </div>
                      {aiGenerations
                        .filter((g) => g.targetVersionId === selectedVersion.id)
                        .map((gen) => (
                          <div key={gen.generationId} className={styles.aiRunCard}>
                            <div className={styles.aiRunInfo}>
                              <div className={styles.aiRunTitleRow}>
                                <span className={styles.aiRunTopic}>
                                  {String(gen.promptParams?.topic || 'AI Question Batch')}
                                </span>
                                <span
                                  className={`${styles.statusPill} ${gen.status === GenerationStatus.COMPLETED
                                      ? styles.badgeSuccess
                                      : gen.status === GenerationStatus.FAILED ||
                                        gen.status === GenerationStatus.CANCELLED
                                        ? styles.badgeDanger
                                        : styles.badgeBrand
                                    }`}
                                >
                                  {gen.status.toUpperCase()}
                                </span>
                                {gen.reviewStatus && (
                                  <span
                                    className={`${styles.statusPill} ${gen.reviewStatus === GenerationReviewStatus.APPLIED
                                        ? styles.badgeSuccess
                                        : gen.reviewStatus === GenerationReviewStatus.REVIEWED
                                          ? styles.badgeBrand
                                          : styles.badgeWarning
                                      }`}
                                  >
                                    {gen.reviewStatus.replace('_', ' ').toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className={styles.aiRunStage}>{gen.stageDescription}</span>
                            </div>

                            <div className={styles.aiRunActions}>
                              {gen.canCancel && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  isLoading={cancelAiMutation.isPending}
                                  onClick={() =>
                                    cancelAiMutation.mutate({
                                      quizId: quiz.id,
                                      generationId: gen.generationId,
                                    })
                                  }
                                >
                                  Cancel
                                </Button>
                              )}
                              <Link
                                to={`/quizzes/${quiz.id}/ai-generations/${gen.generationId}/review`}
                              >
                                <Button
                                  variant={
                                    gen.status === GenerationStatus.COMPLETED && !gen.isApplied
                                      ? 'primary'
                                      : 'outline'
                                  }
                                  size="sm"
                                >
                                  {gen.isApplied
                                    ? 'View Applied Set'
                                    : gen.status === GenerationStatus.COMPLETED
                                      ? 'Review & Apply'
                                      : 'View Status'}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
              </div>

              {/* Draft Question Set Editor */}
              <QuestionEditor
                questions={draftQuestions}
                onChange={setDraftQuestions}
                onSave={handleSaveQuestions}
                isSaving={bulkSaveQuestionsMutation.isPending}
              />
            </div>
          ) : (
            <div>
              {/* Published Version Immutability Notice & Actions */}
              <div className={styles.publishedNoticeCard}>
                <div className={styles.publishedNoticeHeader}>
                  <div>
                    <div className={styles.publishedNoticeTitle}>
                      Published Version (v{selectedVersion.version}) — Read-Only & Immutable
                    </div>
                    <p className={styles.publishedNoticeText}>
                      This assessment version is permanently locked to protect grading integrity for
                      historical learner attempts. To edit questions or adjust timing, create a new
                      draft version.
                    </p>
                  </div>

                  <div>
                    {existingDraftVersion ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSelectVersion(existingDraftVersion.id)}
                      >
                        Switch to Active Draft (v{existingDraftVersion.version})
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCreateNewVersion}
                        isLoading={createNewVersionMutation.isPending}
                      >
                        Create New Draft Version
                      </Button>
                    )}
                  </div>
                </div>

                {isUuid(quizId) && isUuid(selectedVersion.id) && (
                  <div className={styles.shareableLinkBox}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className={styles.shareableLinkLabel}>Direct Taker Link:</span>
                      <code className={styles.shareableLinkCode}>
                        {window.location.origin}/quizzes/{quizId}/versions/{selectedVersion.id}
                      </code>
                    </div>
                    <button
                      type="button"
                      className={styles.copyButton}
                      onClick={() =>
                        handleCopyLink(
                          `${window.location.origin}/quizzes/${quizId}/versions/${selectedVersion.id}`,
                        )
                      }
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Published Read-Only Questions List */}
              <div className={styles.publishedQuestionsList} style={{ marginTop: 16 }}>
                {(selectedVersion.questions || []).map((q, idx) => (
                  <div key={q.id} className={styles.publishedQuestionCard}>
                    <div className={styles.publishedCardHeader}>
                      <div className={styles.publishedBadgeCluster}>
                        <span className={`${styles.statusPill} ${styles.badgeBrand}`}>
                          Question {idx + 1}
                        </span>
                        <span className={`${styles.statusPill} ${styles.badgeNeutral}`}>
                          {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                        </span>
                      </div>
                      <span className={styles.publishedQuestionType}>
                        {q.questionType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className={styles.publishedQuestionPrompt}>{q.text}</div>

                    <div className={styles.publishedOptionsList}>
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        return (
                          <div
                            key={opt.id}
                            className={`${styles.publishedOptionRow} ${opt.isCorrect ? styles.publishedOptionRowCorrect : ''
                              }`}
                          >
                            <span
                              className={`${styles.optionPillIndicator} ${opt.isCorrect ? styles.optionPillCorrect : ''
                                }`}
                            >
                              {opt.isCorrect ? '✓ Correct' : letter}
                            </span>
                            <span className={styles.optionTextSpan}>{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
