import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { UserRole } from '@/features/auth/types/auth.types';
import { useCreatorQuizzes } from '@/features/quizzes/hooks/use-quizzes';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { Input } from '@/components/ui/Input/Input';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCreatorOrAdmin =
    user?.role === UserRole.CREATOR || user?.role === UserRole.ADMIN;

  const { data: creatorQuizzes } = useCreatorQuizzes();

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

    const parts = input.split(/[/,\s]+/).filter(Boolean);
    if (parts.length === 2) {
      navigate(`/quizzes/${parts[0]}/versions/${parts[1]}`);
      return;
    }

    setInputError('Expected format: Paste full quiz taker link or "quizId / versionId"');
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
            Welcome back, <strong>{displayName}</strong>. Continue learning, manage your quizzes, and track your progress.
          </p>
        </div>
        {isCreatorOrAdmin && (
          <Link to="/quizzes/new">
            <Button variant="primary">
              + Create Quiz
            </Button>
          </Link>
        )}
      </div>

      {/* Summary Metrics Row */}
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

      {/* Join Quiz / Quick Access Section */}
      <Card variant="default">
        <CardHeader style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <CardTitle style={{ fontSize: '1.125rem' }}>Join Assessment Session</CardTitle>
          <CardDescription>
            Enter a shared assessment link or Version ID to access a published quiz evaluation.
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
                  placeholder="e.g. /quizzes/quizId/versions/versionId"
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
      {isCreatorOrAdmin && (
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
                          {quiz.publishedVersionsCount} version{quiz.publishedVersionsCount !== 1 ? 's' : ''}
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
      )}
    </div>
  );
}
