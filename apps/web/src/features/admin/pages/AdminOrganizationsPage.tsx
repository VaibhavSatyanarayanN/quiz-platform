import { useState } from 'react';
import { Link } from 'react-router';
import { useAdminOrganizations } from '../hooks/use-admin';
import { CreateOrganizationModal } from '../components/CreateOrganizationModal';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Card, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { formatDate } from '@/lib/utils/formatters';

export default function AdminOrganizationsPage() {
  const { data, isLoading, error } = useAdminOrganizations();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isLoading) {
    return <LoadingSpinner message="Loading organizations..." />;
  }

  const organizations = data?.items ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ marginBottom: '4px' }}>
            <Link to="/admin" style={{ fontSize: '0.875rem', color: 'var(--brand-600, #2563eb)', textDecoration: 'none' }}>
              ← Back to Admin Overview
            </Link>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
            Organizations Directory
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Manage organization tenants and creator assignments.
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          + Create Organization
        </Button>
      </div>

      {error ? (
        <Card variant="default" style={{ padding: '24px', color: 'var(--color-danger-text, #dc2626)' }}>
          {error instanceof Error ? error.message : 'Failed to load organizations'}
        </Card>
      ) : organizations.length === 0 ? (
        <Card variant="default" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 8px 0' }}>No Organizations</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0 0 20px 0' }}>
            Create your first organization tenant to onboard creators.
          </p>
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            + Create Organization
          </Button>
        </Card>
      ) : (
        <Card variant="default">
          <CardBody style={{ padding: 0 }}>
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Organization</Th>
                    <Th>Slug</Th>
                    <Th>Status</Th>
                    <Th>Creators</Th>
                    <Th>Created</Th>
                    <Th style={{ textAlign: 'right' }}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {organizations.map((org) => (
                    <Tr key={org.id}>
                      <Td style={{ fontWeight: 600 }}>{org.name}</Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{org.slug}</Td>
                      <Td>
                        <Badge variant={org.isActive ? 'success' : 'neutral'} size="sm">
                          {org.isActive ? '● Active' : '● Inactive'}
                        </Badge>
                      </Td>
                      <Td style={{ fontSize: '0.875rem' }}>{org.creatorsCount} creator{org.creatorsCount !== 1 ? 's' : ''}</Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {formatDate(org.createdAt)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        <Link to={`/admin/organizations/${org.id}`}>
                          <Button variant="outline" size="sm">
                            Manage Creators →
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

      <CreateOrganizationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
