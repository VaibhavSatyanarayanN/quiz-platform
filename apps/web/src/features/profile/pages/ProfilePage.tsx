import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Input } from '@/components/ui/Input/Input';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function ProfilePage() {
  const { user } = useAuth();
  const initials = user?.userId ? user.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() : 'VS';
  const email = user?.email || `user_${user?.userId?.slice(0, 8)}@quizplatform.com`;
  const name = user?.email ? user.email.split('@')[0] : `User #${user?.userId?.slice(0, 8)}`;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
          Profile
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          Your personal account information and permissions.
        </p>
      </div>

      {/* User Hero Avatar Card */}
      <Card variant="default">
        <CardBody style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--brand-600, #4f46e5)',
              color: '#ffffff',
              fontSize: '1.5rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
              border: '3px solid var(--brand-200, #c7d2fe)',
            }}
          >
            {initials}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 2px 0', textTransform: 'capitalize' }}>
            {name}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0 0 12px 0' }}>
            {email}
          </p>
          <Badge variant={user?.role === 'admin' ? 'danger' : user?.role === 'creator' ? 'brand' : 'neutral'} size="sm">
            {user?.role || 'user'}
          </Badge>
        </CardBody>
      </Card>

      {/* Account Details Form */}
      <Card variant="default">
        <CardHeader>
          <CardTitle style={{ fontSize: '1.125rem' }}>Account Information</CardTitle>
          <CardDescription>Verified account credentials.</CardDescription>
        </CardHeader>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            id="profile-username"
            label="Username"
            value={name}
            readOnly
            disabled
          />
          <Input
            id="profile-email"
            label="Email Address"
            value={email}
            readOnly
            disabled
          />
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
              Assigned Role
            </label>
            <Input
              id="profile-role"
              value={user?.role ? user.role.toUpperCase() : 'USER'}
              readOnly
              disabled
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
