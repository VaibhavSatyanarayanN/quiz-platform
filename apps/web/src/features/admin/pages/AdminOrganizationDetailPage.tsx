import { useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  useAdminOrganizationDetails,
  useAdminOrganizationCreators,
  useUpdateCreatorStatus,
} from '../hooks/use-admin';
import { CreateCreatorModal } from '../components/CreateCreatorModal';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { formatDate } from '@/lib/utils/formatters';

export default function AdminOrganizationDetailPage() {
  const { organizationId } = useParams<{ organizationId: string }>();

  const {
    data: org,
    isLoading: isOrgLoading,
    error: orgError,
  } = useAdminOrganizationDetails(organizationId ?? '');

  const {
    data: creatorsData,
    isLoading: isCreatorsLoading,
  } = useAdminOrganizationCreators(organizationId ?? '');

  const updateStatusMutation = useUpdateCreatorStatus();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  if (isOrgLoading || isCreatorsLoading) {
    return <LoadingSpinner message="Loading organization details..." />;
  }

  if (orgError || !org) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert variant="danger">
          {orgError instanceof Error ? orgError.message : 'Organization not found.'}
        </Alert>
        <div style={{ marginTop: '16px' }}>
          <Link to="/admin/organizations">
            <Button variant="outline">← Back to Organizations</Button>
          </Link>
        </div>
      </div>
    );
  }

  const creators = creatorsData?.items ?? [];

  const handleToggleStatus = (userId: string, currentStatus: boolean) => {
    if (!organizationId) return;
    const newStatus = !currentStatus;

    updateStatusMutation.mutate(
      {
        organizationId,
        userId,
        isActive: newStatus,
      },
      {
        onSuccess: () => {
          setBanner(`Creator status updated to ${newStatus ? 'Active' : 'Deactivated'}.`);
          setTimeout(() => setBanner(null), 3500);
        },
      },
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Link to="/admin/organizations" style={{ fontSize: '0.875rem', color: 'var(--brand-600, #2563eb)', textDecoration: 'none' }}>
            ← Back to Organizations
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{org.name}</h1>
            <Badge variant={org.isActive ? 'success' : 'neutral'} size="sm">
              {org.isActive ? '● Active' : '● Inactive'}
            </Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Slug: <code>{org.slug}</code> | Tenant ID: <code>{org.id}</code>
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          + Add Creator
        </Button>
      </div>

      {banner && <Alert variant="success">{banner}</Alert>}

      {/* Organization Creators Card */}
      <Card variant="default">
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <CardTitle>Creators ({creators.length})</CardTitle>
              <CardDescription>Creator accounts affiliated with {org.name}.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}>
              + Create Creator
            </Button>
          </div>
        </CardHeader>

        <CardBody style={{ padding: 0 }}>
          {creators.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No creators in this organization yet. Click "+ Create Creator" above to add one.
            </div>
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Creator</Th>
                    <Th>Email</Th>
                    <Th>Org Role</Th>
                    <Th>Status</Th>
                    <Th>Joined</Th>
                    <Th style={{ textAlign: 'right' }}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {creators.map((c) => (
                    <Tr key={c.id}>
                      <Td style={{ fontWeight: 600 }}>{c.username}</Td>
                      <Td style={{ fontSize: '0.875rem' }}>{c.email}</Td>
                      <Td>
                        <Badge variant="brand" size="sm">{c.role}</Badge>
                      </Td>
                      <Td>
                        <Badge variant={c.isActive ? 'success' : 'danger'} size="sm">
                          {c.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {formatDate(c.createdAt)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        <Button
                          variant={c.isActive ? 'danger' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleStatus(c.userId, c.isActive)}
                          isLoading={updateStatusMutation.isPending}
                        >
                          {c.isActive ? 'Deactivate' : 'Activate'}
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

      {organizationId && (
        <CreateCreatorModal
          organizationId={organizationId}
          organizationName={org.name}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
