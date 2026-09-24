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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !username.trim()) {
      setError('Email and username are required.');
      return;
    }

    createCreatorMutation.mutate(
      {
        organizationId,
        data: {
          email: email.trim().toLowerCase(),
          username: username.trim(),
          password: password ? password : undefined,
        },
      },
      {
        onSuccess: () => {
          setEmail('');
          setUsername('');
          setPassword('');
          onClose();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to create creator');
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Organization Creator"
      description={`Add a new creator member to ${organizationName || 'the organization'}.`}
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

        <Input
          label="Email Address *"
          id="creator-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="creator@organization.com"
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
          label="Initial Password (Optional)"
          id="creator-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave empty to generate temporary password"
          helperText="Min 8 characters. If empty, a temporary password will be generated automatically."
          minLength={8}
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
