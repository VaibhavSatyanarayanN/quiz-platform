import React, { useState } from 'react';
import { useCreateOrgStudent } from '../hooks/use-classrooms';
import { Modal } from '@/components/ui/Modal/Modal';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';

interface CreateStudentModalProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onStudentCreated?: (newStudent: { userId: string; username: string; email: string }) => void;
}

export const CreateStudentModal: React.FC<CreateStudentModalProps> = ({
  organizationId,
  isOpen,
  onClose,
  onStudentCreated,
}) => {
  const createStudentMutation = useCreateOrgStudent();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !username.trim() || !tempPassword.trim()) {
      setError('Email, username, and password are required.');
      return;
    }

    createStudentMutation.mutate(
      {
        organizationId,
        email: email.trim().toLowerCase(),
        username: username.trim(),
        tempPassword: tempPassword.trim(),
      },
      {
        onSuccess: (res) => {
          setEmail('');
          setUsername('');
          setTempPassword('');
          onClose();
          if (onStudentCreated && res) {
            onStudentCreated({
              userId: res.userId,
              username: res.username,
              email: res.email,
            });
          }
        },
        onError: (err) => {
          setError((err as Error)?.message || 'Failed to create student');
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Student"
      description="Create a new student account under this organization."
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        <Input
          label="Student Email *"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
          required
          disabled={createStudentMutation.isPending}
        />

        <Input
          label="Student Username *"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. alex_smith"
          required
          disabled={createStudentMutation.isPending}
        />

        <Input
          label="Student Password *"
          type="password"
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          placeholder="Enter student password"
          helperText="Min 6 characters. Required for student login."
          required
          minLength={6}
          disabled={createStudentMutation.isPending}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={createStudentMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={createStudentMutation.isPending}>
            Register Student
          </Button>
        </div>
      </form>
    </Modal>
  );
};
