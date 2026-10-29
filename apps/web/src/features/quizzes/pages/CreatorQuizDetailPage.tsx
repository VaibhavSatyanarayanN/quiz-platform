import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import {
  useCreatorQuizDetails,
  useUpdateQuiz,
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
import { Card, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
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

  const [showAiGenerator, setShowAiGenerator] = useState(false);
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

  const handleSelectVersion = (vId: string) => {
    setSelectedVersionId(vId);
    setDraftQuestionsState(null);
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
    setActionError(null);
    publishVersionMutation.mutate(
      { quizId, versionId: selectedVersionId },
      {
        onSuccess: () => {
          setSuccessBanner('Quiz version published live!');
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
    if (!window.confirm('Are you sure you want to discard this draft version? All unsaved questions will be lost.')) {
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

  if (isLoading) {
    return <LoadingSpinner message="Loading quiz details..." />;
  }

  if (error || !quiz) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert variant="danger">
          {error instanceof Error ? error.message : 'Failed to load quiz.'}
        </Alert>
        <div style={{ marginTop: '16px' }}>
          <Link to="/quizzes">
            <Button variant="outline">← Back to Quizzes</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isDraft = selectedVersion?.status === QuizVersionStatus.DRAFT;
  const isPublished = selectedVersion?.status === QuizVersionStatus.PUBLISHED;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <Link to="/quizzes">
          <Button variant="outline" size="sm">← Back to Quizzes</Button>
        </Link>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to={`/quizzes/${quiz.id}/analytics`}>
            <Button variant="outline" size="sm">
              📊 Analytics
            </Button>
          </Link>

          {isPublished && (
            <Button variant="secondary" size="sm" onClick={handleCreateNewVersion} isLoading={createNewVersionMutation.isPending}>
              Create New Version
            </Button>
          )}

          {isDraft && (
            <>
              <Button variant="danger" size="sm" onClick={handleDiscardVersion} isLoading={discardVersionMutation.isPending}>
                Discard Draft
              </Button>
              <Button variant="primary" size="sm" onClick={handlePublish} isLoading={publishVersionMutation.isPending}>
                Publish Version
              </Button>
            </>
          )}
        </div>
      </div>

      {successBanner && <Alert variant="success">{successBanner}</Alert>}
      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {/* Quiz Metadata Header Card */}
      <Card variant="elevated">
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isEditingMeta ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button variant="ghost" size="sm" onClick={() => setIsEditingMeta(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveMeta} isLoading={updateQuizMutation.isPending}>
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{quiz.title}</h1>
                  <p style={{ color: 'var(--color-text-secondary, #6b7280)', margin: '4px 0 0 0' }}>
                    {quiz.description || 'No description provided.'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleStartMetaEdit}>
                  Edit Details
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Version Picker */}
      {quiz.versions && quiz.versions.length > 0 && (
        <Card variant="default">
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                Versions:
              </span>
              {quiz.versions.map((v) => (
                <Button
                  key={v.id}
                  variant={v.id === selectedVersionId ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => handleSelectVersion(v.id)}
                >
                  v{v.version} ({v.status})
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Selected Version Workspace */}
      {selectedVersion && (
        <Card variant="elevated">
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Version {selectedVersion.version} ({selectedVersion.status})
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                  {isDraft ? 'Editable draft version workspace.' : 'Published immutable version.'}
                </p>
              </div>
              <Badge variant={selectedVersion.status === QuizVersionStatus.PUBLISHED ? 'success' : 'warning'}>
                {selectedVersion.status}
              </Badge>
            </div>

            {isDraft ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* AI Question Generation & Review Panel */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'var(--color-bg-subtle, #f8fafc)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                        ✨ AI Question Generation & Review
                      </h3>
                      <p
                        style={{
                          fontSize: '0.825rem',
                          color: 'var(--color-text-secondary, #6b7280)',
                          margin: '2px 0 0 0',
                        }}
                      >
                        Generate questions asynchronously, review and edit them, then explicitly
                        apply approved questions to this draft version.
                      </p>
                    </div>
                    <Button
                      variant={showAiGenerator ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => setShowAiGenerator((prev) => !prev)}
                    >
                      {showAiGenerator ? 'Close Generator' : '✨ Generate with AI'}
                    </Button>
                  </div>

                  {showAiGenerator && (
                    <div
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        background: 'var(--color-surface, #ffffff)',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button
                          variant={aiMode === 'topic' ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setAiMode('topic')}
                        >
                          From Topic / Prompt
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            Source PDF File (max 10 MB)
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
                        placeholder="e.g., Distributed Systems Consensus & Raft"
                      />

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            Question Count (1–20)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={aiCount}
                            onChange={(e) =>
                              setAiCount(
                                Math.min(20, Math.max(1, Number(e.target.value) || 5)),
                              )
                            }
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border, #cbd5e1)',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            Difficulty
                          </label>
                          <select
                            value={aiDifficulty}
                            onChange={(e) =>
                              setAiDifficulty(e.target.value as DifficultyLevel)
                            }
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border, #cbd5e1)',
                            }}
                          >
                            <option value={DifficultyLevel.EASY}>Easy</option>
                            <option value={DifficultyLevel.MEDIUM}>Medium</option>
                            <option value={DifficultyLevel.HARD}>Hard</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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
                          isLoading={
                            generateAiMutation.isPending || generateAiPdfMutation.isPending
                          }
                        >
                          Start AI Generation
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Recent Generations for this Version */}
                  {aiGenerations.filter((g) => g.targetVersionId === selectedVersion.id)
                    .length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--color-text-muted, #6b7280)',
                        }}
                      >
                        AI Generation Runs for Version {selectedVersion.version}
                      </div>
                      {aiGenerations
                        .filter((g) => g.targetVersionId === selectedVersion.id)
                        .map((gen) => (
                          <div
                            key={gen.generationId}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: 'var(--color-surface, #ffffff)',
                              border: '1px solid var(--color-border, #e2e8f0)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                  {String(gen.promptParams?.topic || 'AI Question Set')}
                                </span>
                                <Badge
                                  size="sm"
                                  variant={
                                    gen.status === GenerationStatus.COMPLETED
                                      ? 'success'
                                      : gen.status === GenerationStatus.FAILED ||
                                          gen.status === GenerationStatus.CANCELLED
                                        ? 'danger'
                                        : 'brand'
                                  }
                                >
                                  {gen.status.toUpperCase()}
                                </Badge>
                                {gen.reviewStatus && (
                                  <Badge
                                    size="sm"
                                    variant={
                                      gen.reviewStatus === GenerationReviewStatus.APPLIED
                                        ? 'success'
                                        : gen.reviewStatus === GenerationReviewStatus.REVIEWED
                                          ? 'brand'
                                          : 'warning'
                                    }
                                  >
                                    {gen.reviewStatus.replace('_', ' ').toUpperCase()}
                                  </Badge>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  color: 'var(--color-text-secondary, #6b7280)',
                                }}
                              >
                                {gen.stageDescription}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                      ? 'Review & Apply Questions →'
                                      : 'View Status'}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <QuestionEditor
                  questions={draftQuestions}
                  onChange={setDraftQuestions}
                  onSave={handleSaveQuestions}
                  isSaving={bulkSaveQuestionsMutation.isPending}
                />
              </div>
            ) : (
              <div>
                {isUuid(quizId) && isUuid(selectedVersion.id) && (
                  <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--color-bg-subtle, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Shareable Quiz Taker Link
                    </div>
                    <code style={{ fontSize: '0.875rem', color: 'var(--brand-700, #1d4ed8)', fontWeight: 600 }}>
                      {window.location.origin}/quizzes/{quizId}/versions/{selectedVersion.id}
                    </code>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedVersion.questions.map((q, idx) => (
                    <div key={q.id} style={{ padding: '16px', border: '1px solid var(--color-border, #e2e8f0)', borderRadius: '8px', background: 'var(--color-surface, #ffffff)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          <span style={{ color: 'var(--brand-600, #2563eb)', marginRight: '8px' }}>Q{idx + 1}.</span>
                          {q.text}
                        </div>
                        <Badge variant="neutral" size="sm">{q.marks} Mark{q.marks > 1 ? 's' : ''}</Badge>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #6b7280)', marginTop: '4px', textTransform: 'capitalize' }}>
                        Type: {q.questionType.replace('_', ' ')}
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={opt.id}
                            style={{
                              fontSize: '0.875rem',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: opt.isCorrect ? '1px solid var(--color-success-border, #bbf7d0)' : '1px solid transparent',
                              backgroundColor: opt.isCorrect ? 'var(--color-success-bg, #f0fdf4)' : 'transparent',
                              color: opt.isCorrect ? 'var(--color-success-text, #166534)' : 'var(--color-text-primary, #111827)',
                              fontWeight: opt.isCorrect ? 600 : 400,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span>{opt.text}</span>
                            {opt.isCorrect && (
                              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-success-text, #166534)' }}>
                                ✓ Correct Option
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
