import { Link } from 'react-router';
import { useAdminOverview, useAdminOrganizations } from '../hooks/use-admin';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { Card, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';

export default function AdminDashboardPage() {
  const { data: overview, isLoading: isOverviewLoading } = useAdminOverview();
  const { data: orgsData, isLoading: isOrgsLoading } = useAdminOrganizations();

  if (isOverviewLoading || isOrgsLoading) {
    return <LoadingSpinner message="Loading admin overview..." />;
  }

  const organizations = orgsData?.items ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Admin Title Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Badge variant="brand" size="sm">Platform Admin Console</Badge>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
            Admin Overview
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Manage platform organizations, tenant creators, and authorization.
          </p>
        </div>

        <Link to="/admin/organizations">
          <Button variant="primary">Manage Organizations →</Button>
        </Link>
      </div>

      {/* Metrics Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Card variant="elevated">
          <CardBody>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Organizations
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-600, #2563eb)', marginTop: '4px' }}>
              {overview?.totalOrganizations ?? 0}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Total registered tenants
            </div>
          </CardBody>
        </Card>

        <Card variant="elevated">
          <CardBody>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Tenants
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success-text, #166534)', marginTop: '4px' }}>
              {overview?.activeOrganizations ?? 0}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Currently active organizations
            </div>
          </CardBody>
        </Card>

        <Card variant="elevated">
          <CardBody>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Creators
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary, #111827)', marginTop: '4px' }}>
              {overview?.totalCreators ?? 0}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Organization-affiliated creators
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick Organizations Table */}
      <Card variant="default">
        <CardBody style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border, #e5e7eb)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Organizations Summary</h3>
            <Link to="/admin/organizations" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--brand-600, #2563eb)', textDecoration: 'none' }}>
              View All ({organizations.length}) →
            </Link>
          </div>

          {organizations.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No organizations created yet.
            </div>
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Organization</Th>
                    <Th>Slug</Th>
                    <Th>Status</Th>
                    <Th>Creators</Th>
                    <Th style={{ textAlign: 'right' }}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {organizations.slice(0, 5).map((org) => (
                    <Tr key={org.id}>
                      <Td style={{ fontWeight: 600 }}>{org.name}</Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{org.slug}</Td>
                      <Td>
                        <Badge variant={org.isActive ? 'success' : 'neutral'} size="sm">
                          {org.isActive ? '● Active' : '● Inactive'}
                        </Badge>
                      </Td>
                      <Td style={{ fontSize: '0.875rem' }}>{org.creatorsCount} creators</Td>
                      <Td style={{ textAlign: 'right' }}>
                        <Link to={`/admin/organizations/${org.id}`}>
                          <Button variant="outline" size="sm">Details</Button>
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
