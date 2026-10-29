import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router';
import { useCreatorQuizzes } from '../hooks/use-quizzes';
import { CreateQuizModal } from '../components/CreateQuizModal';
import { QuizStatus } from '../types/quiz.types';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Card, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Alert } from '@/components/feedback/Alert';
import { formatDate } from '@/lib/utils/formatters';

export default function CreatorQuizListPage() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Debounce search query to prevent excessive queries while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle status filter change
  const handleStatusFilterChange = (status: string) => {
    setFilterStatus(status);
    setPage(1);
  };

  // Primary paginated and filtered quiz list query
  const queryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    status: filterStatus === 'all' ? undefined : (filterStatus as QuizStatus),
    page,
    limit,
  }), [debouncedSearch, filterStatus, page, limit]);

  const { data, isLoading, error, refetch } = useCreatorQuizzes(queryParams);

  // Unfiltered summary count query for KPI cards
  const { data: summaryData } = useCreatorQuizzes({ limit: 50 });

  const quizzes = useMemo(() => data?.items ?? [], [data]);

  const stats = useMemo(() => {
    const allItems = summaryData?.items ?? quizzes;
    const published = allItems.filter((q) => q.status === QuizStatus.PUBLISHED).length;
    const drafts = allItems.filter((q) => q.status === QuizStatus.DRAFT).length;
    const total = summaryData?.total ?? data?.total ?? allItems.length;
    return { total, published, drafts };
  }, [summaryData, data, quizzes]);

  const total = data?.total ?? quizzes.length;
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--color-text-primary)',
            }}
          >
            Quiz Creator Dashboard
          </h1>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: '0.875rem',
              margin: '4px 0 0 0',
            }}
          >
            Create, manage, and inspect your quizzes and AI-generated question banks.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            aria-label="Create New Quiz"
          >
            + Create Quiz
          </Button>
        </div>
      </div>

      {/* Role Notice for non-creator / learner accounts */}
      {user?.role === 'user' && (
        <Alert variant="warning" title="Learner Account Notice">
          Your current account role is "{user?.role}". Authoring, editing, and managing quizzes requires Creator or Admin privileges.
        </Alert>
      )}

      {/* KPI Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <Card variant="default">
          <CardBody style={{ padding: '16px 20px' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Total Quizzes
            </div>
            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                marginTop: '4px',
              }}
            >
              {stats.total}
            </div>
          </CardBody>
        </Card>

        <Card variant="default">
          <CardBody style={{ padding: '16px 20px' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Published
            </div>
            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--success-text, #059669)',
                marginTop: '4px',
              }}
            >
              {stats.published}
            </div>
          </CardBody>
        </Card>

        <Card variant="default">
          <CardBody style={{ padding: '16px 20px' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Drafts
            </div>
            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--brand-600, #4f46e5)',
                marginTop: '4px',
              }}
            >
              {stats.drafts}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card variant="default">
        <CardBody style={{ padding: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '240px' }}>
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search quizzes by title or description..."
                aria-label="Search quizzes"
              />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button
                variant={filterStatus === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilterChange('all')}
                aria-label="Filter all quizzes"
              >
                All
              </Button>
              <Button
                variant={filterStatus === QuizStatus.PUBLISHED ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilterChange(QuizStatus.PUBLISHED)}
                aria-label="Filter published quizzes"
              >
                Published
              </Button>
              <Button
                variant={filterStatus === QuizStatus.DRAFT ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilterChange(QuizStatus.DRAFT)}
                aria-label="Filter draft quizzes"
              >
                Drafts
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main Content Area: Loading, Error, Empty, or Table */}
      {isLoading ? (
        <Card variant="default">
          <CardBody style={{ padding: '24px' }}>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              aria-busy="true"
              aria-label="Loading quizzes"
            >
              {[1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--color-border, #e5e7eb)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Skeleton width="45%" height={20} style={{ marginBottom: '8px' }} />
                    <Skeleton width="75%" height={14} />
                  </div>
                  <Skeleton width="80px" height={24} />
                  <Skeleton width="110px" height={16} />
                  <Skeleton width="160px" height={32} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : error ? (
        <Card variant="default">
          <CardBody style={{ padding: '24px' }}>
            <Alert variant="danger" title="Unable to load quizzes">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  width: '100%',
                }}
              >
                <span>
                  {error instanceof Error
                    ? error.message
                    : 'A network or server error occurred while retrieving your quizzes.'}
                </span>
                <div>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    ↻ Retry Loading
                  </Button>
                </div>
              </div>
            </Alert>
          </CardBody>
        </Card>
      ) : quizzes.length === 0 ? (
        <Card variant="default">
          <CardBody style={{ padding: '32px 16px' }}>
            <EmptyState
              title={
                debouncedSearch || filterStatus !== 'all'
                  ? 'No matching quizzes found'
                  : 'No quizzes yet'
              }
              description={
                debouncedSearch || filterStatus !== 'all'
                  ? 'No quizzes match your current search query or filter selection. Try adjusting or clearing filters.'
                  : 'Start building your assessment bank by creating your first quiz.'
              }
              actionLabel={
                debouncedSearch || filterStatus !== 'all'
                  ? 'Clear Filters'
                  : '+ Create Quiz'
              }
              onAction={() => {
                if (debouncedSearch || filterStatus !== 'all') {
                  setSearchInput('');
                  setFilterStatus('all');
                  setPage(1);
                } else {
                  setIsModalOpen(true);
                }
              }}
            />
          </CardBody>
        </Card>
      ) : (
        <Card variant="default">
          <CardBody style={{ padding: 0 }}>
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Quiz</Th>
                    <Th>Status</Th>
                    <Th>Version Info</Th>
                    <Th>Updated</Th>
                    <Th style={{ textAlign: 'right' }}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {quizzes.map((quiz) => (
                    <Tr key={quiz.id}>
                      <Td>
                        <div
                          style={{
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {quiz.title}
                        </div>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            color: 'var(--color-text-secondary)',
                            marginTop: '2px',
                          }}
                        >
                          {quiz.description || 'No description provided'}
                        </div>
                      </Td>
                      <Td>
                        <Badge
                          variant={
                            quiz.status === 'published' ? 'success' : 'neutral'
                          }
                          size="sm"
                        >
                          {quiz.status === 'published'
                            ? '● Published'
                            : '● Draft'}
                        </Badge>
                      </Td>
                      <Td>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            {quiz.publishedVersionsCount} published version
                            {quiz.publishedVersionsCount !== 1 ? 's' : ''}
                          </span>
                          {quiz.hasDraft && (
                            <span
                              style={{
                                color: 'var(--brand-600, #4f46e5)',
                                fontWeight: 500,
                                fontSize: '0.75rem',
                              }}
                            >
                              ● Draft active
                            </span>
                          )}
                          {quiz.latestVersion && (
                            <span
                              style={{
                                color: 'var(--color-text-muted, #9ca3af)',
                                fontSize: '0.75rem',
                              }}
                            >
                              Latest: v{quiz.latestVersion}
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {formatDate(quiz.updatedAt)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'flex-end',
                            flexWrap: 'wrap',
                          }}
                        >
                          <Link to={`/quizzes/${quiz.id}?ai=open`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Open AI question generator for ${quiz.title}`}
                            >
                              ✨ AI Questions
                            </Button>
                          </Link>
                          <Link to={`/quizzes/${quiz.id}/analytics`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`View analytics for ${quiz.title}`}
                            >
                              📊 Analytics
                            </Button>
                          </Link>
                          <Link to={`/quizzes/${quiz.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Manage quiz ${quiz.title}`}
                            >
                              Manage
                            </Button>
                          </Link>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderTop: '1px solid var(--color-border, #e5e7eb)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Showing {(page - 1) * limit + 1}–
                  {Math.min(page * limit, total)} of {total} quizzes
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    ← Previous
                  </Button>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      padding: '0 8px',
                    }}
                  >
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <CreateQuizModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

export { CreatorQuizListPage as QuizCreatorDashboard };
