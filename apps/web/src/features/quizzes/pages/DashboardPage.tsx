import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { UserRole } from '@/features/auth/types/auth.types';
import { useCreatorQuizzes, usePublishedQuizzes } from '@/features/quizzes/hooks/use-quizzes';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { Input } from '@/components/ui/Input/Input';
import { Alert } from '@/components/feedback/Alert';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCreatorOrAdmin =
    user?.role === UserRole.CREATOR || user?.role === UserRole.ADMIN;

  const [learnerSearch, setLearnerSearch] = useState('');
  const [learnerTiming, setLearnerTiming] = useState<'all' | 'timed' | 'untimed'>('all');
  const [learnerPage, setLearnerPage] = useState(1);

  const { data: creatorQuizzes } = useCreatorQuizzes(undefined, { enabled: isCreatorOrAdmin });
  const {
    data: publishedQuizzesData,
    isLoading: isPublishedLoading,
    isError: isPublishedError,
    error: publishedError,
    refetch: refetchPublished,
  } = usePublishedQuizzes(
    {
      search: learnerSearch.trim() || undefined,
      timing: learnerTiming !== 'all' ? learnerTiming : undefined,
      page: learnerPage,
      limit: 10,
    },
    { enabled: !isCreatorOrAdmin },
  );

  const [quizInput, setQuizInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const handleJoinQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);

    const input = quizInput.trim();
    if (!input) {
      setInputError('Please enter a Quiz link or Quiz ID / Version ID.');
      return;
    }

    const match = input.match(/quizzes\/([a-zA-Z0-9-]+)\/versions\/([a-zA-Z0-9-]+)/);
    if (match) {
      const [, qId, vId] = match;
      navigate(`/quizzes/${qId}/versions/${vId}`);
      return;
    }

    const singleQuizMatch = input.match(/quizzes\/([a-zA-Z0-9-]+)(?:\/take|\/published)?$/);
    if (singleQuizMatch) {
      navigate(`/quizzes/${singleQuizMatch[1]}/take`);
      return;
    }

    const parts = input.split(/[/,\s]+/).filter(Boolean);
    if (parts.length === 2) {
      navigate(`/quizzes/${parts[0]}/versions/${parts[1]}`);
      return;
    }

    if (parts.length === 1 && parts[0].length >= 8) {
      navigate(`/quizzes/${parts[0]}/take`);
      return;
    }

    setInputError('Expected format: Paste full quiz taker link, quizId, or "quizId / versionId"');
  };

  const totalQuizzes = creatorQuizzes?.items?.length || 0;
  const publishedQuizzes = creatorQuizzes?.items?.filter((q) => q.status === 'published').length || 0;
  const draftQuizzes = creatorQuizzes?.items?.filter((q) => q.status === 'draft').length || 0;

  const displayName = user?.email ? user.email.split('@')[0] : 'User';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Dashboard Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
            Welcome back, <strong>{displayName}</strong>. {isCreatorOrAdmin ? 'Manage your quizzes and build questions.' : 'Explore available assessments and track your learning progress.'}
          </p>
        </div>
        {isCreatorOrAdmin ? (
          <Link to="/quizzes/new">
            <Button variant="primary">
              + Create Quiz
            </Button>
          </Link>
        ) : (
          <Link to="/attempts">
            <Button variant="outline">
              My Past Attempts →
            </Button>
          </Link>
        )}
      </div>

      {/* Summary Metrics Row */}
      {isCreatorOrAdmin ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <Card variant="default">
            <CardBody style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Quizzes
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                {totalQuizzes}
              </div>
            </CardBody>
          </Card>

          <Card variant="default">
            <CardBody style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Published
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success-text)', marginTop: '4px' }}>
                {publishedQuizzes}
              </div>
            </CardBody>
          </Card>

          <Card variant="default">
            <CardBody style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Drafts
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--brand-600)', marginTop: '4px' }}>
                {draftQuizzes}
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <Card variant="default">
            <CardBody style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Available Assessments
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--brand-600)', marginTop: '4px' }}>
                {publishedQuizzesData?.total ?? 0}
              </div>
            </CardBody>
          </Card>

          <Card variant="default">
            <CardBody style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Assessment Center
              </div>
              <div style={{ marginTop: '6px' }}>
                <Link to="/attempts">
                  <Button variant="outline" size="sm">
                    View Assessment History →
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Join Quiz / Quick Access Section */}
      <Card variant="default">
        <CardHeader style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <CardTitle style={{ fontSize: '1.125rem' }}>Join Assessment Session</CardTitle>
          <CardDescription>
            Enter a shared assessment link, Quiz ID, or Version ID to access a published quiz evaluation.
          </CardDescription>
        </CardHeader>
        <CardBody style={{ paddingTop: '12px' }}>
          <form onSubmit={handleJoinQuiz} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="quiz-link-input" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Assessment Link or ID
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <Input
                  id="quiz-link-input"
                  placeholder="e.g. /quizzes/quizId/versions/versionId or quizId"
                  value={quizInput}
                  onChange={(e) => {
                    setQuizInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  error={inputError ? '' : undefined}
                />
              </div>
              <Button type="submit" variant="primary" style={{ height: '38px', flexShrink: 0 }}>
                Open Quiz
              </Button>
            </div>
            {inputError && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-danger, #ef4444)', marginTop: '2px', fontWeight: 500 }} role="alert">
                {inputError}
              </span>
            )}
          </form>
        </CardBody>
      </Card>

      {/* Structured Content Grid */}
      {isCreatorOrAdmin ? (
        <Card variant="default">
          <CardHeader style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <CardTitle style={{ fontSize: '1.125rem' }}>Your Quizzes</CardTitle>
              <CardDescription>Structured list of quizzes created in your workspace.</CardDescription>
            </div>
            <Link to="/quizzes">
              <Button variant="outline" size="sm">
                View all quizzes →
              </Button>
            </Link>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {creatorQuizzes?.items && creatorQuizzes.items.length > 0 ? (
              <TableContainer>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Quiz Title</Th>
                      <Th>Status</Th>
                      <Th>Published Versions</Th>
                      <Th style={{ textAlign: 'right' }}>Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {creatorQuizzes.items.slice(0, 5).map((quiz) => (
                      <Tr key={quiz.id}>
                        <Td>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{quiz.title}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                            {quiz.description || 'No description provided'}
                          </div>
                        </Td>
                        <Td>
                          <Badge variant={quiz.status === 'published' ? 'success' : 'neutral'} size="sm">
                            {quiz.status === 'published' ? '● Published' : '● Draft'}
                          </Badge>
                        </Td>
                        <Td style={{ fontSize: '0.875rem' }}>
                          {quiz.publishedVersionsCount ?? 0} version{(quiz.publishedVersionsCount ?? 0) !== 1 ? 's' : ''}
                        </Td>
                        <Td style={{ textAlign: 'right' }}>
                          <Link to={`/quizzes/${quiz.id}`}>
                            <Button variant="outline" size="sm">
                              Open
                            </Button>
                          </Link>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            ) : (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.9375rem' }}>No quizzes yet. Create your first quiz to start building your question bank.</p>
                <Link to="/quizzes/new">
                  <Button variant="primary" size="sm">
                    + Create Quiz
                  </Button>
                </Link>
              </div>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card variant="default">
          <CardHeader style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <CardTitle style={{ fontSize: '1.25rem', fontWeight: 700 }}>Published Assessment Catalog</CardTitle>
                <CardDescription>
                  Browse available assessments, check evaluation parameters, and begin your attempts.
                </CardDescription>
              </div>
              <Link to="/attempts">
                <Button variant="outline" size="sm">
                  View Past Attempts →
                </Button>
              </Link>
            </div>

            {/* Catalog Filter and Search Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: '240px', maxWidth: '400px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Input
                  id="learner-search-input"
                  placeholder="Search by quiz title or description..."
                  value={learnerSearch}
                  onChange={(e) => {
                    setLearnerSearch(e.target.value);
                    setLearnerPage(1);
                  }}
                />
                {learnerSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLearnerSearch('');
                      setLearnerPage(1);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Timing filter toggles */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginRight: '4px' }}>
                  Timing:
                </span>
                <Button
                  variant={learnerTiming === 'all' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setLearnerTiming('all');
                    setLearnerPage(1);
                  }}
                >
                  All
                </Button>
                <Button
                  variant={learnerTiming === 'timed' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setLearnerTiming('timed');
                    setLearnerPage(1);
                  }}
                >
                  Timed
                </Button>
                <Button
                  variant={learnerTiming === 'untimed' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setLearnerTiming('untimed');
                    setLearnerPage(1);
                  }}
                >
                  Untimed
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardBody style={{ padding: 0 }}>
            {isPublishedLoading ? (
              <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner message="Loading available assessments..." />
              </div>
            ) : isPublishedError ? (
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Alert variant="danger" title="Unable to Load Assessments">
                  {publishedError instanceof Error ? publishedError.message : 'An error occurred while loading the quiz catalog.'}
                </Alert>
                <div>
                  <Button variant="outline" size="sm" onClick={() => refetchPublished()}>
                    ↻ Retry Loading
                  </Button>
                </div>
              </div>
            ) : publishedQuizzesData?.items && publishedQuizzesData.items.length > 0 ? (
              <>
                <TableContainer>
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Assessment Title & Details</Th>
                        <Th>Questions & Marks</Th>
                        <Th>Duration</Th>
                        <Th style={{ textAlign: 'right' }}>Action</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {publishedQuizzesData.items.map((quiz) => (
                        <Tr key={quiz.id}>
                          <Td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {quiz.title}
                              </span>
                              <Badge variant="brand" size="sm">
                                v{quiz.latestPublishedVersionNumber}
                              </Badge>
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {quiz.description || 'No description provided.'}
                            </div>
                          </Td>
                          <Td style={{ fontSize: '0.875rem' }}>
                            {quiz.totalQuestions} question{quiz.totalQuestions !== 1 ? 's' : ''}{' '}
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              ({quiz.totalMarks} mark{quiz.totalMarks !== 1 ? 's' : ''})
                            </span>
                          </Td>
                          <Td style={{ fontSize: '0.875rem' }}>
                            {quiz.timeLimitSeconds ? (
                              <Badge variant="brand" size="sm">
                                ⏱ {Math.floor(quiz.timeLimitSeconds / 60)} mins
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">
                                Untimed
                              </Badge>
                            )}
                          </Td>
                          <Td style={{ textAlign: 'right' }}>
                            <Link to={`/quizzes/${quiz.id}/take`}>
                              <Button variant="primary" size="sm">
                                Start Assessment →
                              </Button>
                            </Link>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>

                {/* Pagination Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderTop: '1px solid var(--color-border, #e2e8f0)',
                    flexWrap: 'wrap',
                    gap: '12px',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <div>
                    Showing <strong>{((publishedQuizzesData.page - 1) * publishedQuizzesData.limit) + 1}</strong> to{' '}
                    <strong>{Math.min(publishedQuizzesData.page * publishedQuizzesData.limit, publishedQuizzesData.total)}</strong> of{' '}
                    <strong>{publishedQuizzesData.total}</strong> assessments
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLearnerPage((p) => Math.max(1, p - 1))}
                      disabled={publishedQuizzesData.page <= 1}
                    >
                      ← Previous
                    </Button>
                    <span>
                      Page {publishedQuizzesData.page} of {publishedQuizzesData.totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLearnerPage((p) => p + 1)}
                      disabled={publishedQuizzesData.page >= publishedQuizzesData.totalPages}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                {learnerSearch || learnerTiming !== 'all' ? (
                  <>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.9375rem', fontWeight: 500 }}>
                      No assessments match your current filter criteria.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLearnerSearch('');
                        setLearnerTiming('all');
                        setLearnerPage(1);
                      }}
                    >
                      Clear Search & Filters
                    </Button>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.9375rem' }}>
                    No published quizzes are currently available in your catalog.
                  </p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
