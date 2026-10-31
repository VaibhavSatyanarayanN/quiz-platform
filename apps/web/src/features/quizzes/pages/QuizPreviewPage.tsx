import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { usePublishedQuizVersion, useLatestPublishedQuizVersion } from '@/features/quizzes/hooks/use-quizzes';
import { useStartAttempt, useAttemptHistory } from '@/features/attempts/hooks/use-attempts';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { formatDurationSeconds } from '@/lib/utils/formatters';

interface HttpErrorWithStatus {
  response?: {
    status?: number;
  };
}

export default function QuizPreviewPage() {
  const { quizId, quizVersionId } = useParams<{ quizId: string; quizVersionId?: string }>();
  const navigate = useNavigate();

  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const specificVersionQuery = usePublishedQuizVersion(
    quizId ?? '',
    quizVersionId ?? '',
  );

  const latestVersionQuery = useLatestPublishedQuizVersion(
    quizId ?? '',
    { enabled: !quizVersionId && !!quizId },
  );

  const { data: quizVersion, isLoading, error } = quizVersionId
    ? specificVersionQuery
    : latestVersionQuery;

  const { data: attemptHistory } = useAttemptHistory(quizId);
  const startAttemptMutation = useStartAttempt();

  if (isLoading) {
    return <LoadingSpinner message="Loading quiz details..." />;
  }

  const isForbidden =
    (error as HttpErrorWithStatus)?.response?.status === 403 ||
    (error instanceof Error &&
      (error.message.toLowerCase().includes('not assigned') ||
        error.message.toLowerCase().includes('forbidden')));

  if (isForbidden) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto' }}>
        <Alert variant="danger" title="Assessment Restricted">
          You are not assigned to take this quiz. Please contact your organization administrator or course instructor to be assigned to this assessment.
        </Alert>
        <div style={{ marginTop: '16px' }}>
          <Link to="/dashboard">
            <Button variant="outline">← Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
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

  // Detect active in-progress attempt
  const inProgressAttempt = attemptHistory?.items?.find((a) => a.status === 'in_progress');
  const isExpiredOnClient = Boolean(
    inProgressAttempt?.expiresAt && new Date(inProgressAttempt.expiresAt).getTime() <= currentTime,
  );

  // Past completed or expired attempts
  const pastAttempts = attemptHistory?.items?.filter((a) => a.status !== 'in_progress') ?? [];

  const handleStartQuiz = () => {
    if (inProgressAttempt && !isExpiredOnClient) {
      navigate(`/attempts/${inProgressAttempt.attemptId}`);
      return;
    }

    const targetVersionId = quizVersionId || quizVersion.quizVersionId;
    if (!quizId || !targetVersionId || totalQuestions === 0) return;
    startAttemptMutation.mutate(
      { quizId, versionId: targetVersionId },
      {
        onSuccess: (data) => {
          const attemptId = data.attemptId || data.id;
          navigate(`/attempts/${attemptId}`);
        },
      },
    );
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">← Back to Dashboard</Button>
        </Link>
      </div>

      {/* In-Progress Attempt Alert / Banner */}
      {inProgressAttempt && !isExpiredOnClient && (
        <Card variant="default" style={{ borderColor: 'var(--brand-600, #2563eb)', borderWidth: '2px' }}>
          <CardBody style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: '16px 20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant="brand" size="sm">● Active Session</Badge>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                  You have an in-progress attempt for this assessment
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Started {new Date(inProgressAttempt.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Your answers and timer are preserved.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(`/attempts/${inProgressAttempt.attemptId}`)}
            >
              Resume Attempt →
            </Button>
          </CardBody>
        </Card>
      )}

      {inProgressAttempt && isExpiredOnClient && (
        <Alert variant="warning" title="Previous Attempt Reached Deadline">
          Your active session reached its deadline and has expired. You can view your completed evaluation result or begin a new attempt.
          <div style={{ marginTop: '8px' }}>
            <Link to={`/attempts/${inProgressAttempt.attemptId}/result`}>
              <Button variant="outline" size="sm">View Expired Result →</Button>
            </Link>
          </div>
        </Alert>
      )}

      {/* Main Assessment Overview Card */}
      <Card variant="default">
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Badge variant="brand" size="sm">v{quizVersion.version}</Badge>
            <Badge variant="success" size="sm">{quizVersion.status ?? 'published'}</Badge>
            {quizVersion.timeLimitSeconds ? (
              <Badge variant="brand" size="sm">⏱ {Math.floor(quizVersion.timeLimitSeconds / 60)} mins</Badge>
            ) : (
              <Badge variant="neutral" size="sm">Untimed</Badge>
            )}
          </div>
          <CardTitle style={{ fontSize: '1.625rem', fontWeight: 700 }}>{displayTitle}</CardTitle>
          <CardDescription style={{ fontSize: '0.9375rem', marginTop: '6px' }}>
            {displayDescription || 'No description provided.'}
          </CardDescription>
        </CardHeader>

        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              padding: '16px',
              borderRadius: '8px',
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
        </CardBody>

        <CardFooter style={{ justifyContent: 'space-between' }}>
          <Link to="/dashboard">
            <Button variant="outline">Back to Catalog</Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={handleStartQuiz}
            disabled={totalQuestions === 0 || startAttemptMutation.isPending}
            isLoading={startAttemptMutation.isPending}
          >
            {inProgressAttempt && !isExpiredOnClient ? 'Resume Attempt →' : 'Start Assessment →'}
          </Button>
        </CardFooter>
      </Card>

      {/* Assessment Instructions & Pre-Attempt Rules */}
      <Card variant="default">
        <CardHeader>
          <CardTitle style={{ fontSize: '1.125rem', fontWeight: 700 }}>Assessment Instructions & Rules</CardTitle>
          <CardDescription>
            Please read these instructions thoroughly before beginning your assessment.
          </CardDescription>
        </CardHeader>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>⏱</span>
            <div>
              <strong>Server-Authoritative Timer:</strong> For timed assessments, your countdown begins immediately when you click Start Assessment. The timer runs continuously on the server and does not pause if you close your tab or navigate away.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>🔒</span>
            <div>
              <strong>Deadline Enforcement:</strong> Once the timer expires, the attempt is finalized automatically. No answers submitted after the deadline can be accepted.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>💾</span>
            <div>
              <strong>Automatic Saving & Navigation:</strong> Answers are saved automatically whenever you select an option or navigate between questions. You may navigate freely between questions before finalizing your attempt.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>📊</span>
            <div>
              <strong>Grading & Evaluation:</strong> Single-choice, multiple-choice, and true/false questions are evaluated automatically upon submission according to the allocated marks breakdown.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>🏁</span>
            <div>
              <strong>Submission Finality:</strong> Submitting your attempt is irreversible. Once submitted, answers cannot be edited or modified.
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Previous Attempts History */}
      {pastAttempts.length > 0 && (
        <Card variant="default">
          <CardHeader>
            <CardTitle style={{ fontSize: '1.125rem', fontWeight: 700 }}>Your Past Attempts</CardTitle>
            <CardDescription>Historical records of your previous attempts for this assessment.</CardDescription>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Date & Time</Th>
                    <Th>Version</Th>
                    <Th>Status</Th>
                    <Th>Score</Th>
                    <Th style={{ textAlign: 'right' }}>Result</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pastAttempts.map((attempt) => (
                    <Tr key={attempt.attemptId}>
                      <Td style={{ fontSize: '0.875rem' }}>
                        {new Date(attempt.startedAt).toLocaleDateString()}{' '}
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(attempt.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </Td>
                      <Td>
                        <Badge variant="brand" size="sm">v{attempt.version}</Badge>
                      </Td>
                      <Td>
                        <Badge
                          variant={attempt.status === 'submitted' ? 'success' : 'warning'}
                          size="sm"
                        >
                          {attempt.status === 'submitted' ? '● Submitted' : '● Expired'}
                        </Badge>
                      </Td>
                      <Td style={{ fontSize: '0.875rem' }}>
                        {attempt.score !== null ? (
                          <>
                            <strong>{attempt.score}</strong> / {attempt.totalMarks ?? totalMarks}{' '}
                            <span style={{ color: 'var(--color-text-muted)' }}>({attempt.percentage ?? 0}%)</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        <Link to={`/attempts/${attempt.attemptId}/result`}>
                          <Button variant="outline" size="sm">
                            View Result →
                          </Button>
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
