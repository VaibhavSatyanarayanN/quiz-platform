import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge/Badge';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { authApi } from '@/features/auth/api/auth.api';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'danger'; msg: string } | null>(null);

  const email = user?.email || 'user@quizplatform.com';
  const username = user?.username || email.split('@')[0] || 'User';
  const userId = user?.userId || 'usr_anonymous';
  const role = user?.role || 'user';
  const organizations = user?.organizations || [];

  const roleLabel = role === 'admin' ? 'Administrator' : role === 'creator' ? 'Quiz Creator' : 'Learner';
  const roleBadgeVariant = role === 'admin' ? 'danger' : role === 'creator' ? 'brand' : 'neutral';

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
      setFeedback({ type: 'success', msg: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to update password.';
      setFeedback({
        type: 'danger',
        msg: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Account Settings</h1>
        <p className={styles.pageDescription}>
          Manage your personal identity, organization memberships, and security credentials.
        </p>
      </div>

      {/* Mandatory Password Notice if temp password active */}
      {user?.mustChangePassword && (
        <Alert variant="warning">
          Action Required: You are signed in with a temporary password. Update your password below to secure your account.
        </Alert>
      )}

      {/* Section 1: Identity & Credentials */}
      <section className={styles.sectionRow}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Profile Information</h2>
          <p className={styles.sectionDescription}>
            Your public identity and workspace account identifiers.
          </p>
        </div>

        <div className={styles.sectionPanel}>
          <div className={styles.identityBanner}>
            <Avatar username={username} email={email} size="lg" />
            <div className={styles.identityInfo}>
              <div className={styles.identityNameRow}>
                <h3 className={styles.identityUsername}>{username}</h3>
                <Badge variant={roleBadgeVariant} size="sm">
                  {roleLabel}
                </Badge>
              </div>
              <p className={styles.identityEmail}>{email}</p>
            </div>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <label className={styles.detailLabel}>Account Username</label>
              <div className={styles.detailValue}>{username}</div>
            </div>
            <div className={styles.detailItem}>
              <label className={styles.detailLabel}>Email Address</label>
              <div className={styles.detailValue}>{email}</div>
            </div>
            <div className={styles.detailItem}>
              <label className={styles.detailLabel}>User Identifier</label>
              <div className={`${styles.detailValue} ${styles.detailValueMono}`}>{userId}</div>
            </div>
            <div className={styles.detailItem}>
              <label className={styles.detailLabel}>Platform Access Tier</label>
              <div className={styles.detailValue}>{roleLabel}</div>
            </div>
          </div>
        </div>
      </section>

      <hr className={styles.sectionDivider} />

      {/* Section 2: Organization Memberships */}
      <section className={styles.sectionRow}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Organizations</h2>
          <p className={styles.sectionDescription}>
            Institutions and workspaces associated with your profile.
          </p>
        </div>

        <div className={styles.sectionPanel}>
          {organizations.length > 0 ? (
            <div className={styles.orgsList}>
              {organizations.map((org) => (
                <div key={org.organizationId} className={styles.orgItem}>
                  <div className={styles.orgNameGroup}>
                    <span className={styles.orgName}>{org.organizationName}</span>
                    <span className={styles.orgSlug}>{org.organizationSlug}</span>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {org.role}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.sectionDescription} style={{ margin: 0 }}>
              Personal workspace · No external organization affiliations attached to this account.
            </p>
          )}
        </div>
      </section>

      <hr className={styles.sectionDivider} />

      {/* Section 3: Password & Security */}
      <section className={styles.sectionRow}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Password & Security</h2>
          <p className={styles.sectionDescription}>
            Update your account password. Choose a secure passphrase of at least 6 characters.
          </p>
        </div>

        <div className={styles.sectionPanel}>
          {feedback && (
            <Alert variant={feedback.type}>
              {feedback.msg}
            </Alert>
          )}

          <form onSubmit={handlePasswordSubmit} className={styles.form}>
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

            <div className={styles.formActions}>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
