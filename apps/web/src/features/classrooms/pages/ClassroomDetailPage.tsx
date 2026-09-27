import React, { useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  useClassroomDetails,
  useAddClassroomStudent,
  useRemoveClassroomStudent,
} from '../hooks/use-classrooms.js';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Modal } from '@/components/ui/Modal/Modal';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { StudentSearchSelect } from '../components/StudentSearchSelect';

export const ClassroomDetailPage: React.FC = () => {
  const { classroomId } = useParams<{ classroomId: string }>();
  const { data: classroom, isLoading, error } = useClassroomDetails(classroomId ?? '');

  const addStudentMutation = useAddClassroomStudent();
  const removeStudentMutation = useRemoveClassroomStudent();

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingSpinner message="Loading classroom details..." />;
  }

  if (error || !classroom) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert variant="danger">{(error as Error)?.message || 'Classroom not found.'}</Alert>
        <div style={{ marginTop: '16px' }}>
          <Link to="/classrooms">
            <Button variant="outline">← Back to Classrooms</Button>
          </Link>
        </div>
      </div>
    );
  }

  const enrolledStudentIds = (classroom.students || [])
    .map((s) => s.studentId)
    .filter((id): id is string => Boolean(id));

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !classroomId) return;

    setModalError(null);
    addStudentMutation.mutate(
      { classroomId, studentId: selectedStudentId },
      {
        onSuccess: () => {
          setIsStudentModalOpen(false);
          setSelectedStudentId(null);
        },
        onError: (err) => {
          setModalError((err as Error)?.message || 'Failed to enroll student');
        },
      },
    );
  };

  const handleRemoveStudent = (studentId: string) => {
    if (!classroomId) return;
    if (!window.confirm('Remove student from this classroom?')) return;
    removeStudentMutation.mutate({ classroomId, studentId });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Breadcrumb */}
      <div>
        <Link to="/classrooms" style={{ fontSize: '0.875rem', color: 'var(--brand-600, #2563eb)', textDecoration: 'none' }}>
          ← Back to Classrooms Directory
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{classroom.name}</h1>
          <Badge variant={classroom.isActive ? 'success' : 'neutral'}>
            {classroom.isActive ? '● Active' : '● Inactive'}
          </Badge>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          {classroom.description || 'No description provided.'}
        </p>
      </div>

      {/* Teachers Section */}
      <Card variant="outlined">
        <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <CardTitle>Assigned Teachers</CardTitle>
        </CardHeader>
        <CardBody>
          {!classroom.teachers || classroom.teachers.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No teachers assigned yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {classroom.teachers.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.username}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t.email}</div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Enrolled Students Section */}
      <Card variant="outlined">
        <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <CardTitle>Enrolled Students ({classroom.students?.length ?? 0})</CardTitle>
          <Button variant="primary" size="sm" onClick={() => setIsStudentModalOpen(true)}>
            + Enroll Student
          </Button>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {!classroom.students || classroom.students.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No students enrolled in this classroom yet.
            </div>
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Student Name</Th>
                    <Th>Email</Th>
                    <Th>Joined Date</Th>
                    <Th style={{ textAlign: 'right' }}>Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {classroom.students.map((s) => (
                    <Tr key={s.id}>
                      <Td style={{ fontWeight: 600 }}>{s.username}</Td>
                      <Td style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{s.email}</Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {s.joinedAt ? new Date(s.joinedAt).toLocaleDateString() : 'N/A'}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => s.studentId && handleRemoveStudent(s.studentId)}
                          isLoading={removeStudentMutation.isPending}
                        >
                          Remove
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>

      {/* Modal to Enroll Student */}
      <Modal isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)} title="Enroll Student">
        <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {modalError && <Alert variant="danger">{modalError}</Alert>}
          <StudentSearchSelect
            organizationId={classroom.organizationId}
            enrolledStudentIds={enrolledStudentIds}
            selectedStudentId={selectedStudentId}
            onSelectStudent={(id) => setSelectedStudentId(id)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button type="button" variant="ghost" onClick={() => setIsStudentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!selectedStudentId}
              isLoading={addStudentMutation.isPending}
            >
              Enroll Student
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ClassroomDetailPage;
