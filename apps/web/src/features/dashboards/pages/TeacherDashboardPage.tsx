import React, { useState } from 'react';
import { Link } from 'react-router';
import { useTeacherDashboard } from '../hooks/use-dashboards.js';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { CreateStudentModal } from '@/features/classrooms/components/CreateStudentModal';

export const TeacherDashboardPage: React.FC = () => {
  const { currentOrganization } = useAuth();
  const { data, isLoading, error } = useTeacherDashboard();
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const organizationId = currentOrganization?.organizationId || '';

  if (isLoading) {
    return <LoadingSpinner message="Loading your teacher dashboard..." />;
  }

  if (error || !data) {
    return <Alert variant="danger">{(error as Error)?.message || 'Failed to load teacher dashboard.'}</Alert>;
  }

  const { metrics, recentAssignments } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome & Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
            Teacher Studio Dashboard
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Manage classrooms, create assessments, and monitor student performance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {organizationId && (
            <Button variant="outline" onClick={() => setIsStudentModalOpen(true)}>
              + Register Student
            </Button>
          )}
          <Link to="/classrooms">
            <Button variant="outline">+ Classrooms</Button>
          </Link>
          <Link to="/quizzes/new">
            <Button variant="primary">+ Create Quiz</Button>
          </Link>
        </div>
      </div>

      {banner && <Alert variant="success">{banner}</Alert>}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <Card variant="outlined">
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>My Classrooms</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{metrics.myClassrooms}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Active batches</div>
          </CardBody>
        </Card>

        <Card variant="outlined">
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Enrolled Students</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{metrics.myStudents}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total unique students</div>
          </CardBody>
        </Card>

        <Card variant="outlined">
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>My Quizzes</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{metrics.myQuizzes}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{metrics.assignedQuizzes} Assigned</div>
          </CardBody>
        </Card>

        <Card variant="outlined">
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Completed Attempts</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{metrics.completedAttempts}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Submitted attempts</div>
          </CardBody>
        </Card>

        <Card variant="outlined">
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Average Score</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{metrics.avgScorePercentage}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Class accuracy avg</div>
          </CardBody>
        </Card>
      </div>

      {/* Recent Assignments Table */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Recent Quiz Assignments</CardTitle>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {recentAssignments.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No active quiz assignments. Create a quiz and assign it to a classroom!
            </div>
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Quiz Title</Th>
                    <Th>Target Classroom</Th>
                    <Th>Assigned Date</Th>
                    <Th>Due Date</Th>
                    <Th style={{ textAlign: 'right' }}>Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {recentAssignments.map((a) => (
                    <Tr key={a.id}>
                      <Td style={{ fontWeight: 600 }}>{a.quizTitle}</Td>
                      <Td style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{a.classroomName}</Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {new Date(a.createdAt).toLocaleDateString()}
                      </Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {a.dueAt ? new Date(a.dueAt).toLocaleDateString() : 'No Due Date'}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        <Link to="/quizzes">
                          <Button variant="outline" size="sm">
                            Manage Quizzes
                          </Button>
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>

      {organizationId && (
        <CreateStudentModal
          organizationId={organizationId}
          isOpen={isStudentModalOpen}
          onClose={() => setIsStudentModalOpen(false)}
          onStudentCreated={(newStudent) => {
            setBanner(`Student "${newStudent.username}" (${newStudent.email}) registered successfully!`);
            setTimeout(() => setBanner(null), 4000);
          }}
        />
      )}
    </div>
  );
};

export default TeacherDashboardPage;
