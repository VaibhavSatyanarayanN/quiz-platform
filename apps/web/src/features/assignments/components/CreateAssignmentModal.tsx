import React, { useState } from 'react';
import { useCreateAssignment } from '../hooks/use-assignments.js';
import { useClassrooms } from '@/features/classrooms/hooks/use-classrooms';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Modal } from '@/components/ui/Modal/Modal';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  quizVersionId: string;
  quizTitle: string;
}

export const CreateAssignmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  quizId,
  quizVersionId,
  quizTitle,
}) => {
  const { currentOrganization } = useAuth();
  const { data: classrooms } = useClassrooms(currentOrganization?.organizationId);
  const createMutation = useCreateAssignment();

  const [assignmentMode, setAssignmentMode] = useState<'classroom' | 'individual'>('classroom');
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [studentIdsText, setStudentIdsText] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.organizationId) {
      setError('Organization context missing.');
      return;
    }

    if (assignmentMode === 'classroom' && !selectedClassroomId) {
      setError('Please select a target classroom.');
      return;
    }

    const studentIds = studentIdsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (assignmentMode === 'individual' && studentIds.length === 0) {
      setError('Please enter at least one student user ID.');
      return;
    }

    setError(null);
    createMutation.mutate(
      {
        quizId,
        quizVersionId,
        organizationId: currentOrganization.organizationId,
        classroomId: assignmentMode === 'classroom' ? selectedClassroomId : undefined,
        studentIds: assignmentMode === 'individual' ? studentIds : undefined,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          onClose();
          setSelectedClassroomId('');
          setStudentIdsText('');
          setStartsAt('');
          setDueAt('');
        },
        onError: (err) => {
          setError((err as Error)?.message || 'Failed to create quiz assignment.');
        },
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Quiz: ${quizTitle}`}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Assignment Target:
          </label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="mode"
                value="classroom"
                checked={assignmentMode === 'classroom'}
                onChange={() => setAssignmentMode('classroom')}
              />
              Classroom Batch
            </label>
            <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="mode"
                value="individual"
                checked={assignmentMode === 'individual'}
                onChange={() => setAssignmentMode('individual')}
              />
              Selected Students
            </label>
          </div>
        </div>

        {assignmentMode === 'classroom' ? (
          <div>
            <label htmlFor="classroom-select" style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Select Classroom:
            </label>
            <select
              id="classroom-select"
              value={selectedClassroomId}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: 'var(--color-bg-surface, #ffffff)',
              }}
              required
            >
              <option value="">-- Choose Classroom --</option>
              {classrooms?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Input
            label="Student User IDs (Comma-separated)"
            value={studentIdsText}
            onChange={(e) => setStudentIdsText(e.target.value)}
            placeholder="e.g. uuid-1, uuid-2"
            required
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input
            type="datetime-local"
            label="Starts At (Optional)"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <Input
            type="datetime-local"
            label="Due At (Optional)"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
            Publish Assignment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
