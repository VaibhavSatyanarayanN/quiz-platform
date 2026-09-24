import { useState, type FormEvent } from 'react';
import { useCreateOrganization } from '../hooks/use-admin';
import { Modal } from '@/components/ui/Modal/Modal';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateOrganizationModal({ isOpen, onClose }: CreateOrganizationModalProps) {
  const createOrgMutation = useCreateOrganization();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Organization name is required.');
      return;
    }

    createOrgMutation.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName('');
          onClose();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to create organization');
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Organization"
      description="Add a new tenant organization to manage creator accounts and scoped assessments."
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        <Input
          label="Organization Name *"
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Training Academy"
          required
          maxLength={100}
          disabled={createOrgMutation.isPending}
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
          <Button type="button" variant="outline" onClick={onClose} disabled={createOrgMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={createOrgMutation.isPending}>
            Create Organization
          </Button>
        </div>
      </form>
    </Modal>
  );
}
