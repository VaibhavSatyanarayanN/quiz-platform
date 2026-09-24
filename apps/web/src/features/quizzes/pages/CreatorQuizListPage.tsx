import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { useCreatorQuizzes } from '../hooks/use-quizzes';
import { CreateQuizModal } from '../components/CreateQuizModal';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { QuizStatus } from '../types/quiz.types';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Card, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { formatDate } from '@/lib/utils/formatters';

export default function CreatorQuizListPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useCreatorQuizzes();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const quizzes = useMemo(() => data?.items ?? [], [data]);

  const stats = useMemo(() => {
    const published = quizzes.filter((q) => q.status === QuizStatus.PUBLISHED).length;
    const drafts = quizzes.filter((q) => q.status === QuizStatus.DRAFT).length;
    const archived = quizzes.filter((q) => q.status === QuizStatus.ARCHIVED).length;
    return { total: quizzes.length, published, drafts, archived };
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((quiz) => {
      const matchesStatus =
        filterStatus === 'all' ? true : quiz.status === filterStatus;
      const matchesSearch =
        searchQuery.trim() === ''
          ? true
          : quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (quiz.description &&
              quiz.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [quizzes, filterStatus, searchQuery]);

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
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Quizzes
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Create, manage, and publish your quizzes.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
        >
          + Create Quiz
        </Button>
      </div>

      {/* Role Notice if user is non-creator role */}
      {user?.role === 'user' && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            background: 'var(--warning-bg, #fffbeb)',
            border: '1px solid var(--warning-border, #fde68a)',
            color: 'var(--warning-text, #b45309)',
            fontSize: '0.875rem',
          }}
        >
          ⚠️ Note: Your account role is "{user?.role}". Quiz creation requires a Creator or Admin role.
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card variant="default">
        <CardBody style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search quizzes by title..."
              />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button
                variant={filterStatus === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                All ({stats.total})
              </Button>
              <Button
                variant={filterStatus === QuizStatus.PUBLISHED ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(QuizStatus.PUBLISHED)}
              >
                Published ({stats.published})
              </Button>
              <Button
                variant={filterStatus === QuizStatus.DRAFT ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(QuizStatus.DRAFT)}
              >
                Drafts ({stats.drafts})
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Structured Quiz List Table */}
      {isLoading ? (
        <LoadingSpinner message="Loading quizzes..." />
      ) : error ? (
        <div role="alert" style={{ color: 'var(--danger-accent)', padding: '16px' }}>
          {error instanceof Error ? error.message : 'Failed to load quizzes'}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <Card variant="default" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 8px 0' }}>
            No quizzes found
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0 0 20px 0' }}>
            {searchQuery
              ? `No quizzes matched "${searchQuery}".`
              : "Create your first quiz and start building your question bank."}
          </p>
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            + Create Quiz
          </Button>
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
                    <Th>Published Versions</Th>
                    <Th>Updated</Th>
                    <Th style={{ textAlign: 'right' }}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredQuizzes.map((quiz) => (
                    <Tr key={quiz.id}>
                      <Td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{quiz.title}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                          {quiz.description || 'No description'}
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
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {formatDate(quiz.updatedAt)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <Link to={`/quizzes/${quiz.id}/analytics`}>
                            <Button variant="ghost" size="sm">
                              📊 Analytics
                            </Button>
                          </Link>
                          <Link to={`/quizzes/${quiz.id}`}>
                            <Button variant="outline" size="sm">
                              Open
                            </Button>
                          </Link>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </CardBody>
        </Card>
      )}

      <CreateQuizModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
