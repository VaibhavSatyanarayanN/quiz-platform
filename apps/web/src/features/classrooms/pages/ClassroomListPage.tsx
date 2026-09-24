import React, { useState } from 'react';
import { Link } from 'react-router';
import { useClassrooms, useCreateClassroom } from '../hooks/use-classrooms.js';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Card, CardBody } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { Modal } from '@/components/ui/Modal/Modal';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Alert } from '@/components/feedback/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';

export const ClassroomListPage: React.FC = () => {
  const { currentOrganization } = useAuth();
  const { data: classrooms, isLoading, error } = useClassrooms(currentOrganization?.organizationId);
  const createMutation = useCreateClassroom();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Classroom name is required.');
      return;
    }
    if (!currentOrganization?.organizationId) {
      setFormError('Organization context is missing.');
      return;
    }

    setFormError(null);
    createMutation.mutate(
      {
        organizationId: currentOrganization.organizationId,
        name: name.trim(),
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          setName('');
          setDescription('');
        },
        onError: (err) => {
          setFormError((err as Error)?.message || 'Failed to create classroom');
        },
      },
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading classrooms..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
            Classrooms Directory
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Manage institutional classrooms, teachers, and enrolled students.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          + Create Classroom
        </Button>
      </div>

      {error ? (
        <Alert variant="danger">{(error as Error)?.message || 'Failed to load classrooms'}</Alert>
      ) : !classrooms || classrooms.length === 0 ? (
        <Card variant="default" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <CardBody>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 8px 0' }}>No Classrooms Found</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0 0 20px 0' }}>
              Create your first classroom batch to assign quizzes and manage students.
            </p>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>
              + Create Classroom
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Card variant="default">
          <CardBody style={{ padding: 0 }}>
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Classroom Name</Th>
                    <Th>Description</Th>
                    <Th>Created Date</Th>
                    <Th style={{ textAlign: 'right' }}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {classrooms.map((c) => (
                    <Tr key={c.id}>
                      <Td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.name}</Td>
                      <Td style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        {c.description || 'No description'}
                      </Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        <Link to={`/classrooms/${c.id}`}>
                          <Button variant="outline" size="sm">
                            Manage Classroom →
                          </Button>
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </CardBody>
        </Card>
      )}

      {/* Modal for creating a classroom */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Classroom">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Input
            label="Classroom Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Class 10-A, Physics Batch 1"
            required
          />
          <Input
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Morning batch for Grade 10 Assessment"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Create Classroom
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ClassroomListPage;
