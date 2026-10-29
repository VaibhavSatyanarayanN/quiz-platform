import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAttemptHistory } from '../hooks/use-attempts';
import { AttemptStatus } from '../types/attempt.types';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { Alert } from '@/components/feedback/Alert';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { formatDate } from '@/lib/utils/formatters';

export default function AttemptHistoryPage() {
  const { quizId } = useParams<{ quizId?: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error, refetch, isFetching } = useAttemptHistory(
    quizId,
    page,
    limit,
  );

  const getStatusBadge = (status: AttemptStatus) => {
    switch (status) {
      case AttemptStatus.SUBMITTED:
        return <Badge variant="success" size="sm">Submitted</Badge>;
      case AttemptStatus.EXPIRED:
        return <Badge variant="warning" size="sm">Expired</Badge>;
      case AttemptStatus.IN_PROGRESS:
        return <Badge variant="brand" size="sm">In Progress</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
            {quizId ? 'Quiz Attempt History' : 'My Attempt History'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary, #6b7280)', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
            {quizId
              ? 'Past assessment attempts for this specific quiz.'
              : 'View all your completed, expired, and in-progress quiz attempts.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {quizId && (
            <Link to="/attempts">
              <Button variant="outline" size="sm">
                View All Quizzes
              </Button>
            </Link>
          )}
          <Link to="/dashboard">
            <Button variant="outline" size="sm">
              Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <LoadingSpinner message="Loading your attempt history..." />
        </div>
      )}

      {/* Error State with Retry */}
      {!isLoading && error && (
        <Card variant="default">
          <CardBody style={{ textAlign: 'center', padding: '32px 24px' }}>
            <Alert variant="danger">
              {error instanceof Error ? error.message : 'Failed to load attempt history.'}
            </Alert>
            <div style={{ marginTop: '16px' }}>
              <Button variant="primary" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? 'Retrying...' : 'Retry'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Content Table & Empty State */}
      {!isLoading && !error && data && (
        <Card variant="default">
          <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <CardTitle style={{ fontSize: '1.125rem' }}>
                Past Attempts ({data.total})
              </CardTitle>
              <CardDescription>
                Chronological list of attempts ordered newest first.
              </CardDescription>
            </div>
            {isFetching && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Updating...
              </span>
            )}
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {data.items.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📝</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.125rem', fontWeight: 600 }}>No Attempts Found</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem' }}>
                  {quizId
                    ? 'You have not taken this quiz yet.'
                    : 'You have not started any quiz attempts yet.'}
                </p>
                <Link to="/dashboard">
                  <Button variant="primary" size="sm">
                    Browse Quizzes
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Quiz Title</Th>
                        <Th>Version</Th>
                        <Th>Status</Th>
                        <Th>Score</Th>
                        <Th>Percentage</Th>
                        <Th>Started At</Th>
                        <Th>Submitted / Expired At</Th>
                        <Th style={{ textAlign: 'right' }}>Action</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {data.items.map((item) => {
                        const isInProgress = item.status === AttemptStatus.IN_PROGRESS;
                        return (
                          <Tr key={item.attemptId}>
                            <Td style={{ fontWeight: 600 }}>
                              <Link
                                to={`/quizzes/${item.quizId}/attempts`}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                                title="Filter by this quiz"
                              >
                                {item.quizTitle || `Quiz ${item.quizId.slice(0, 8)}`}
                              </Link>
                            </Td>
                            <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                              v{item.version}
                            </Td>
                            <Td>{getStatusBadge(item.status)}</Td>
                            <Td style={{ fontWeight: 600 }}>
                              {isInProgress
                                ? <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                : `${item.score ?? 0} / ${item.totalMarks ?? item.totalScore ?? 0}`}
                            </Td>
                            <Td style={{ fontWeight: 700 }}>
                              {isInProgress ? (
                                <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                              ) : item.percentage !== null ? (
                                `${item.percentage}%`
                              ) : (
                                '-'
                              )}
                            </Td>
                            <Td style={{ fontSize: '0.8125rem' }}>
                              {formatDate(item.startedAt)}
                            </Td>
                            <Td style={{ fontSize: '0.8125rem' }}>
                              {item.submittedAt ? formatDate(item.submittedAt) : '-'}
                            </Td>
                            <Td style={{ textAlign: 'right' }}>
                              {isInProgress ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => navigate(`/attempts/${item.attemptId}`)}
                                >
                                  Resume
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/attempts/${item.attemptId}/result`)}
                                >
                                  View Result
                                </Button>
                              )}
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableContainer>

                {/* Pagination Controls */}
                {data.totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      borderTop: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      Page {data.page} of {data.totalPages} ({data.total} total attempts)
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || isFetching}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= data.totalPages || isFetching}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
