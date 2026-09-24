import React from 'react';
import { Link } from 'react-router';
import { useStudentDashboard } from '../hooks/use-dashboards.js';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';

export const StudentDashboardPage: React.FC = () => {
  const { data, isLoading, error } = useStudentDashboard();

  if (isLoading) {
    return <LoadingSpinner message="Loading your student dashboard..." />;
  }

  if (error || !data) {
    return <Alert variant="danger">{(error as Error)?.message || 'Failed to load student dashboard.'}</Alert>;
  }

  const { metrics, recentQuizzes } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
          Student Learning Dashboard
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          Overview of your assigned quizzes, completion status, and assessment performance.
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <Card variant="outlined">
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Assigned Quizzes</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{metrics.assignedQuizzes}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {metrics.completedQuizzes} Completed | {metrics.pendingQuizzes} Pending | {metrics.missedQuizzes} Missed
            </div>
          </CardBody>
        </Card>

        <Card variant="outlined">
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Average Score</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{metrics.avgPercentage}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Avg score: {metrics.avgScore} pts
            </div>
          </CardBody>
        </Card>

        <Card variant="outlined">
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Accuracy Rate</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{metrics.accuracy}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {metrics.correctAnswers} Correct / {metrics.totalQuestionsAnswered} Answered
            </div>
          </CardBody>
        </Card>

        <Card variant="outlined">
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Questions Answered</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{metrics.totalQuestionsAnswered}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {metrics.wrongAnswers} Wrong | {metrics.unansweredQuestions} Unanswered
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Assigned Assessments Table */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>My Quiz Assignments</CardTitle>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {recentQuizzes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No quiz assignments available.
            </div>
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Quiz Title</Th>
                    <Th>Classroom</Th>
                    <Th>Status</Th>
                    <Th>Score</Th>
                    <Th>Due Date</Th>
                    <Th style={{ textAlign: 'right' }}>Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {recentQuizzes.map((q) => (
                    <Tr key={q.assignmentId}>
                      <Td style={{ fontWeight: 600 }}>{q.quizTitle}</Td>
                      <Td style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        {q.classroomName || 'Individual'}
                      </Td>
                      <Td>
                        <Badge
                          variant={
                            q.status === 'completed' ? 'success' : q.status === 'pending' ? 'brand' : 'danger'
                          }
                          size="sm"
                        >
                          {q.status === 'completed'
                            ? '● Completed'
                            : q.status === 'pending'
                            ? '● Pending'
                            : '● Missed'}
                        </Badge>
                      </Td>
                      <Td style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {q.percentage !== null ? `${q.percentage}%` : '—'}
                      </Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {q.dueAt ? new Date(q.dueAt).toLocaleDateString() : 'No Due Date'}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {q.status === 'pending' ? (
                          <Link to={`/quizzes/${q.quizId}/versions/${q.quizVersionId}`}>
                            <Button variant="primary" size="sm">
                              Start Quiz →
                            </Button>
                          </Link>
                        ) : (
                          <Link to="/attempts">
                            <Button variant="outline" size="sm">
                              View Results
                            </Button>
                          </Link>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default StudentDashboardPage;
