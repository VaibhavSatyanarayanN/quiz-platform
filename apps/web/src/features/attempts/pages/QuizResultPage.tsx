import { useParams, Link } from 'react-router';
import { useAttemptResult, useAttemptHistory } from '../hooks/use-attempts';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { AttemptStatus } from '../types/attempt.types';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { Alert } from '@/components/feedback/Alert';
import { formatPercentage, formatDate } from '@/lib/utils/formatters';

export default function QuizResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const { data: result, isLoading, error } = useAttemptResult(attemptId ?? '');
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
        <div style={{ marginTop: '20px' }}>
          <Link to="/dashboard">
            <Button variant="primary">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isExpiredWithoutSubmit = result.status === AttemptStatus.EXPIRED;
  const score = result.score ?? 0;
  const percentageStr = formatPercentage(score, result.totalMarks);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Result Hero Header */}
      <Card variant="default">
        <CardBody style={{ textAlign: 'center', padding: '36px 24px' }}>
          <Badge variant={score / (result.totalMarks || 1) >= 0.7 ? 'success' : 'brand'} size="sm">
            {isExpiredWithoutSubmit ? 'Timer Expired Auto-Submit' : 'Quiz Completed'}
          </Badge>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '12px 0 4px 0', color: 'var(--color-text-primary)' }}>
            {result.quizTitle || 'Assessment Result'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0 0 24px 0' }}>
            Attempt #{result.attemptId.slice(0, 8)}
          </p>

          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '20px 40px',
              borderRadius: '8px',
              background: 'var(--color-bg-subtle, #f8fafc)',
              border: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--brand-600, #4f46e5)', lineHeight: 1 }}>
              {percentageStr}
            </span>
            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '6px' }}>
              {result.score} / {result.totalMarks}
            </span>
          </div>

          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to="/dashboard">
              <Button variant="primary">Back to Dashboard</Button>
            </Link>
            <Link to="/attempts">
              <Button variant="outline">View Attempts</Button>
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
          <CardDescription>Server verified attempt execution timestamps.</CardDescription>
        </CardHeader>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Started At:</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formatDate(result.startedAt)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Submitted At:</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formatDate(result.submittedAt)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Submission Method:</span>
            <Badge variant={isExpiredWithoutSubmit ? 'warning' : 'success'} size="sm">
              {isExpiredWithoutSubmit ? 'Automatic Timer Expiry' : 'Manual Submission'}
            </Badge>
          </div>
        </CardBody>
      </Card>

      {/* Recent Attempts History Table */}
      {history?.items && history.items.length > 0 && (
        <Card variant="default">
          <CardHeader>
            <CardTitle style={{ fontSize: '1.125rem' }}>Attempt History for this Quiz</CardTitle>
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
                  </Tr>
                </Thead>
                <Tbody>
                  {history.items.map((item) => (
                    <Tr key={item.attemptId}>
                      <Td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {item.attemptId.slice(0, 8)}
                      </Td>
                      <Td>
                        <Badge size="sm">{item.status}</Badge>
                      </Td>
                      <Td style={{ fontWeight: 700 }}>
                        {item.score !== null ? `${item.score} / ${item.totalMarks ?? 0}` : '-'}
                      </Td>
                      <Td style={{ fontSize: '0.8125rem' }}>{formatDate(item.submittedAt)}</Td>
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
