import { useParams, useNavigate, Link } from 'react-router';
import { usePublishedQuizVersion } from '@/features/quizzes/hooks/use-quizzes';
import { useStartAttempt } from '@/features/attempts/hooks/use-attempts';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';
import { formatDurationSeconds } from '@/lib/utils/formatters';

export default function QuizPreviewPage() {
  const { quizId, quizVersionId } = useParams<{ quizId: string; quizVersionId: string }>();
  const navigate = useNavigate();

  const { data: quizVersion, isLoading, error } = usePublishedQuizVersion(
    quizId ?? '',
    quizVersionId ?? '',
  );

  const startAttemptMutation = useStartAttempt();

  if (isLoading) {
    return <LoadingSpinner message="Loading quiz details..." />;
  }

  if (error || !quizVersion) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto' }}>
        <Alert variant="danger" title="Quiz Unavailable">
          {error instanceof Error ? error.message : 'Quiz version not found or no longer published.'}
        </Alert>
        <div style={{ marginTop: '16px' }}>
          <Link to="/dashboard">
            <Button variant="outline">← Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayTitle = quizVersion.quizTitle || quizVersion.title;
  const displayDescription = quizVersion.quizDescription ?? quizVersion.description;
  const totalQuestions = quizVersion.questions.length;
  const totalMarks =
    quizVersion.totalMarks ??
    quizVersion.questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  const handleStartQuiz = () => {
    if (!quizId || !quizVersionId || totalQuestions === 0) return;
    startAttemptMutation.mutate(
      { quizId, versionId: quizVersionId },
      {
        onSuccess: (data) => {
          const attemptId = data.attemptId || data.id;
          navigate(`/attempts/${attemptId}`);
        },
      },
    );
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">← Back to Dashboard</Button>
        </Link>
      </div>

      <Card variant="default">
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Badge variant="brand" size="sm">v{quizVersion.version}</Badge>
            <Badge variant="success" size="sm">{quizVersion.status ?? 'published'}</Badge>
          </div>
          <CardTitle style={{ fontSize: '1.5rem', fontWeight: 700 }}>{displayTitle}</CardTitle>
          <CardDescription style={{ fontSize: '0.9375rem', marginTop: '4px' }}>
            {displayDescription || 'No description provided.'}
          </CardDescription>
        </CardHeader>

        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              padding: '16px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
              border: '1px solid var(--color-border, #e2e8f0)',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Questions
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                {totalQuestions}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Marks
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                {totalMarks}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Time Limit
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-600, #2563eb)', marginTop: '4px' }}>
                {formatDurationSeconds(quizVersion.timeLimitSeconds)}
              </div>
            </div>
          </div>

          {totalQuestions === 0 && (
            <Alert variant="warning" title="No Questions Available">
              This published quiz version currently has no questions available for taking.
            </Alert>
          )}

          {startAttemptMutation.isError && (
            <Alert variant="danger" title="Unable to Start Attempt">
              {startAttemptMutation.error instanceof Error
                ? startAttemptMutation.error.message
                : 'You are not authorized or eligible to start this quiz attempt.'}
            </Alert>
          )}

          <Alert variant="info" title="Important Note Before Starting">
            Starting the quiz creates an official attempt session. For timed quizzes, your countdown timer begins immediately upon clicking Start Quiz.
          </Alert>
        </CardBody>

        <CardFooter style={{ justifyContent: 'space-between' }}>
          <Link to="/dashboard">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={handleStartQuiz}
            disabled={totalQuestions === 0 || startAttemptMutation.isPending}
            isLoading={startAttemptMutation.isPending}
          >
            Start Quiz
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
