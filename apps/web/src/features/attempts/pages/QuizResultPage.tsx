import { useParams, Link } from 'react-router';
import { useAttemptResult, useAttemptHistory } from '../hooks/use-attempts';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { AttemptStatus } from '../types/attempt.types';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { Alert } from '@/components/feedback/Alert';
import { formatDate } from '@/lib/utils/formatters';

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function QuizResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const { data: result, isLoading, error, refetch, isFetching } = useAttemptResult(attemptId ?? '');
  const { data: history } = useAttemptHistory(result?.quizId ?? '');

  if (isLoading) {
    return <LoadingSpinner message="Calculating quiz result..." />;
  }

  if (error || !result) {
    return (
      <div style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}>
        <Alert variant="danger">
          {error instanceof Error ? error.message : 'Attempt result data is not available.'}
        </Alert>
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <Button variant="primary" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Retrying...' : 'Retry'}
          </Button>
          <Link to="/dashboard">
            <Button variant="outline">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = result.status === AttemptStatus.EXPIRED;
  const score = result.score ?? 0;
  const totalPossible = result.totalMarks ?? result.totalScore ?? 0;
  const percentageDisplay = result.percentage !== null
    ? `${result.percentage}%`
    : totalPossible > 0
      ? `${((score / totalPossible) * 100).toFixed(2)}%`
      : '0%';

  const isPass = (result.percentage ?? (totalPossible > 0 ? (score / totalPossible) * 100 : 0)) >= 70;

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Expired Notice Banner if applicable */}
      {isExpired && (
        <Alert variant="warning">
          <strong>Time Limit Expired:</strong> The countdown ended before manual submission. The server automatically finalized your attempt and calculated your score based on your saved answers as of the deadline.
        </Alert>
      )}

      {/* Result Hero Header */}
      <Card variant="default">
        <CardBody style={{ textAlign: 'center', padding: '36px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <Badge variant={isPass ? 'success' : 'brand'} size="sm">
              {isExpired ? 'Timer Expired (Finalized)' : 'Quiz Completed'}
            </Badge>
            {result.quizVersion && (
              <Badge variant="neutral" size="sm">
                v{result.quizVersion}
              </Badge>
            )}
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '8px 0 4px 0', color: 'var(--color-text-primary)' }}>
            {result.quizTitle || 'Assessment Result'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0 0 20px 0' }}>
            Attempt #{result.attemptId.slice(0, 8)}
          </p>

          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '20px 48px',
              borderRadius: '12px',
              background: 'var(--color-bg-subtle, #f8fafc)',
              border: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--brand-600, #4f46e5)', lineHeight: 1 }}>
              {percentageDisplay}
            </span>
            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              {score} / {totalPossible} points
            </span>
          </div>

          {/* Action Navigation */}
          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link to={`/quizzes/${result.quizId}/versions/${result.quizVersionId}`}>
              <Button variant="primary">Retake / Start New Attempt</Button>
            </Link>
            <Link to={`/quizzes/${result.quizId}/attempts`}>
              <Button variant="outline">Quiz Attempt History</Button>
            </Link>
            <Link to="/attempts">
              <Button variant="outline">All My Attempts</Button>
            </Link>
          </div>
        </CardBody>
      </Card>

      {/* Breakdown Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <Card variant="default">
          <CardBody style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Correct
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success-text, #065f46)', marginTop: '4px' }}>
              {result.correctCount ?? result.correctAnswers ?? 0}
            </div>
          </CardBody>
        </Card>

        <Card variant="default">
          <CardBody style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Wrong
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--danger-accent, #dc2626)', marginTop: '4px' }}>
              {result.wrongCount ?? result.wrongAnswers ?? 0}
            </div>
          </CardBody>
        </Card>

        <Card variant="default">
          <CardBody style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Unanswered
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--warning-text, #92400e)', marginTop: '4px' }}>
              {result.unansweredCount ?? result.unanswered ?? 0}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Session Details */}
      <Card variant="default">
        <CardHeader>
          <CardTitle style={{ fontSize: '1.125rem' }}>Session Details</CardTitle>
          <CardDescription>Server verified attempt execution timestamps and duration.</CardDescription>
        </CardHeader>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Started At:</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formatDate(result.startedAt)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Submitted At:</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formatDate(result.submittedAt)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Elapsed Time:</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formatDuration(result.elapsedSeconds)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Time Limit:</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              {result.timeLimitSeconds ? `${Math.round(result.timeLimitSeconds / 60)} min (${result.timeLimitSeconds}s)` : 'Untimed'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Submission Mode:</span>
            <Badge variant={isExpired ? 'warning' : 'success'} size="sm">
              {isExpired ? 'Automatic Timer Expiration' : 'Manual Submission'}
            </Badge>
          </div>
        </CardBody>
      </Card>

      {/* Question-Level Review Section */}
      {result.questions && result.questions.length > 0 && (
        <Card variant="default">
          <CardHeader>
            <CardTitle style={{ fontSize: '1.25rem' }}>Question Review & Answers</CardTitle>
            <CardDescription>
              Detailed breakdown of your submitted answers compared to the authoritative answer key.
            </CardDescription>
          </CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {result.questions.map((q, idx) => {
              const isCorrect = q.isCorrect;
              const isUnanswered = q.isUnanswered;

              return (
                <div
                  key={q.id}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    background: isCorrect
                      ? 'rgba(16, 185, 129, 0.04)'
                      : isUnanswered
                        ? 'rgba(245, 158, 11, 0.04)'
                        : 'rgba(239, 68, 68, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        Question {idx + 1} • {q.questionType.replace('_', ' ').toUpperCase()}
                      </span>
                      <h4 style={{ margin: '4px 0 0 0', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {q.text}
                      </h4>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                        {q.marksAwarded} / {q.marks} pts
                      </span>
                      {isCorrect ? (
                        <Badge variant="success" size="sm">Correct</Badge>
                      ) : isUnanswered ? (
                        <Badge variant="warning" size="sm">Unanswered</Badge>
                      ) : (
                        <Badge variant="danger" size="sm">Incorrect</Badge>
                      )}
                    </div>
                  </div>

                  {/* Options List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    {q.options.map((opt) => {
                      const isSelected = q.selectedOptionIds.includes(opt.id);
                      const isCorrectOption = opt.isCorrect;

                      let borderColor = 'var(--color-border, #e2e8f0)';
                      let bg = 'var(--color-bg-base, #ffffff)';
                      if (isCorrectOption) {
                        borderColor = 'var(--success-border, #10b981)';
                        bg = 'rgba(16, 185, 129, 0.08)';
                      } else if (isSelected && !isCorrectOption) {
                        borderColor = 'var(--danger-accent, #ef4444)';
                        bg = 'rgba(239, 68, 68, 0.08)';
                      }

                      return (
                        <div
                          key={opt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            border: `1.5px solid ${borderColor}`,
                            background: bg,
                            fontSize: '0.875rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                              {String.fromCharCode(65 + (opt.order - 1))}.
                            </span>
                            <span style={{ color: 'var(--color-text-primary)' }}>{opt.text}</span>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {isSelected && (
                              <Badge variant={isCorrectOption ? 'success' : 'danger'} size="sm">
                                Your Answer
                              </Badge>
                            )}
                            {isCorrectOption && (
                              <Badge variant="neutral" size="sm">
                                ✓ Correct Answer
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      {/* Recent Attempts History Table */}
      {history?.items && history.items.length > 0 && (
        <Card variant="default">
          <CardHeader>
            <CardTitle style={{ fontSize: '1.125rem' }}>Attempt History for this Quiz</CardTitle>
            <CardDescription>Other submissions and attempts by you on this assessment.</CardDescription>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Attempt ID</Th>
                    <Th>Status</Th>
                    <Th>Score</Th>
                    <Th>Submitted At</Th>
                    <Th style={{ textAlign: 'right' }}>Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {history.items.map((item) => (
                    <Tr key={item.attemptId}>
                      <Td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {item.attemptId.slice(0, 8)}
                      </Td>
                      <Td>
                        <Badge size="sm" variant={item.status === AttemptStatus.SUBMITTED ? 'success' : item.status === AttemptStatus.EXPIRED ? 'warning' : 'brand'}>
                          {item.status}
                        </Badge>
                      </Td>
                      <Td style={{ fontWeight: 700 }}>
                        {item.status === AttemptStatus.IN_PROGRESS
                          ? '-'
                          : item.score !== null
                            ? `${item.score} / ${item.totalMarks ?? item.totalScore ?? 0}`
                            : '-'}
                      </Td>
                      <Td style={{ fontSize: '0.8125rem' }}>{formatDate(item.submittedAt)}</Td>
                      <Td style={{ textAlign: 'right' }}>
                        {item.status === AttemptStatus.IN_PROGRESS ? (
                          <Link to={`/attempts/${item.attemptId}`}>
                            <Button variant="primary" size="sm">Resume</Button>
                          </Link>
                        ) : (
                          <Link to={`/attempts/${item.attemptId}/result`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        )}
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
