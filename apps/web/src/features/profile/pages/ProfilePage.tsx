import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { authApi } from '@/features/auth/api/auth.api';

export default function ProfilePage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);

  const email = user?.email || 'user@quizplatform.com';
  const username = user?.username || email.split('@')[0] || 'User';

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentPassword) {
      setFeedback({ type: 'danger', msg: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setFeedback({ type: 'danger', msg: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'danger', msg: 'New password and confirm password do not match.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await authApi.changePassword({ currentPassword, newPassword });
      setFeedback({ type: 'success', msg: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setFeedback({
        type: 'danger',
        msg: err.response?.data?.message || err.message || 'Failed to update password.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
          Profile Settings
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          Manage your account information and password.
        </p>
      </div>

      {/* Mandatory Password Alert if active */}
      {user?.mustChangePassword && (
        <Alert variant="warning">
          <strong>Action Required:</strong> You are using a temporary password. Please update your password below.
        </Alert>
      )}

      {/* Simple Modern User Header */}
      <Card variant="default">
        <CardBody style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px' }}>
          <Avatar username={username} email={email} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                {username}
              </h2>
              <Badge variant={user?.role === 'admin' ? 'danger' : user?.role === 'creator' ? 'brand' : 'neutral'} size="sm">
                {user?.role || 'user'}
              </Badge>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {email}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Account Details */}
      <Card variant="default">
        <CardHeader>
          <CardTitle style={{ fontSize: '1rem' }}>Account Details</CardTitle>
        </CardHeader>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input id="profile-username" label="Username" value={username} readOnly disabled />
          <Input id="profile-email" label="Email Address" value={email} readOnly disabled />
        </CardBody>
      </Card>

      {/* Security & Password Change */}
      <Card variant="default">
        <CardHeader>
          <CardTitle style={{ fontSize: '1rem' }}>Change Password</CardTitle>
          <CardDescription>Ensure your account is using a long, secure password.</CardDescription>
        </CardHeader>
        <CardBody>
          {feedback && (
            <Alert variant={feedback.type} style={{ marginBottom: '16px' }}>
              {feedback.msg}
            </Alert>
          )}

          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              id="current-password"
              type="password"
              label="Current Password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              id="new-password"
              type="password"
              label="New Password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              id="confirm-password"
              type="password"
              label="Confirm New Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Update Password
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
