import React, { useState } from 'react';
import { useCreateOrgTeacher } from '@/features/classrooms/hooks/use-classrooms';
import { Modal } from '@/components/ui/Modal/Modal';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';

interface CreateTeacherModalProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onTeacherCreated?: () => void;
}

export const CreateTeacherModal: React.FC<CreateTeacherModalProps> = ({
  organizationId,
  isOpen,
  onClose,
  onTeacherCreated,
}) => {
  const createTeacherMutation = useCreateOrgTeacher();

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

    createTeacherMutation.mutate(
      {
        organizationId,
        email: email.trim().toLowerCase(),
        username: username.trim(),
        tempPassword: tempPassword.trim(),
      },
      {
        onSuccess: () => {
          setEmail('');
          setUsername('');
          setTempPassword('');
          onClose();
          if (onTeacherCreated) {
            onTeacherCreated();
          }
        },
        onError: (err) => {
          setError((err as Error)?.message || 'Failed to create teacher account');
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Teacher / Instructor Account"
      description="Register a new teacher or instructor account under your organization."
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        <Input
          label="Teacher Email *"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teacher@school.edu"
          required
          disabled={createTeacherMutation.isPending}
        />

        <Input
          label="Teacher Username *"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. prof_sharma"
          required
          disabled={createTeacherMutation.isPending}
        />

        <Input
          label="Teacher Password *"
          type="password"
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          placeholder="Enter teacher password"
          helperText="Min 6 characters. Required for initial login."
          required
          minLength={6}
          disabled={createTeacherMutation.isPending}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={createTeacherMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={createTeacherMutation.isPending}>
            Create Teacher
          </Button>
        </div>
      </form>
    </Modal>
  );
};
