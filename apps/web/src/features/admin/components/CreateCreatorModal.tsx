import { useState, type FormEvent } from 'react';
import { useCreateOrganizationCreator } from '../hooks/use-admin';
import { Modal } from '@/components/ui/Modal/Modal';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';

interface CreateCreatorModalProps {
  organizationId: string;
  organizationName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateCreatorModal({
  organizationId,
  organizationName,
  isOpen,
  onClose,
}: CreateCreatorModalProps) {
  const createCreatorMutation = useCreateOrganizationCreator();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'teacher'>('teacher');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !username.trim() || !password.trim()) {
      setError('Email, username, and password are required.');
      return;
    }

    createCreatorMutation.mutate(
      {
        organizationId,
        data: {
          email: email.trim().toLowerCase(),
          username: username.trim(),
          password: password.trim(),
          role,
        },
      },
      {
        onSuccess: () => {
          setEmail('');
          setUsername('');
          setPassword('');
          setRole('teacher');
          onClose();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to create member');
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Organization Member"
      description={`Add an admin or teacher member to ${organizationName || 'the organization'}.`}
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        <Input
          label="Organization"
          id="org-display"
          type="text"
          value={organizationName || organizationId}
          disabled
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Organization Role *
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'teacher')}
            disabled={createCreatorMutation.isPending}
            style={{
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #cbd5e1)',
              backgroundColor: 'var(--color-surface, #ffffff)',
              color: 'var(--color-text-primary, #0f172a)',
              fontSize: '0.875rem',
            }}
          >
            <option value="admin">Organization Admin (Principal / Org Manager)</option>
            <option value="teacher">Teacher / Instructor</option>
          </select>
        </div>

        <Input
          label="Email Address *"
          id="creator-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@organization.com"
          required
          disabled={createCreatorMutation.isPending}
        />

        <Input
          label="Username *"
          id="creator-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. rahul_sharma"
          required
          disabled={createCreatorMutation.isPending}
        />

        <Input
          label="Member Password *"
          id="creator-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter member password"
          helperText="Min 6 characters. Required for account login."
          required
          minLength={6}
          disabled={createCreatorMutation.isPending}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--color-border, #e5e7eb)',
          }}
        >
          <Button type="button" variant="outline" onClick={onClose} disabled={createCreatorMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={createCreatorMutation.isPending}>
            Create Creator
          </Button>
        </div>
      </form>
    </Modal>
  );
}
