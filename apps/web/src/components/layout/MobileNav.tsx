import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Button } from '../ui/Button/Button';
import { Badge } from '../ui/Badge/Badge';
import { Avatar } from '../ui/Avatar/Avatar';
import styles from './Layout.module.css';

interface MobileNavProps {
  onClose: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onClose }) => {
  const { user, isPlatformAdmin, logout } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!user) return null;
  const isCreatorOrAdmin = user.role === 'creator' || user.role === 'admin' || isPlatformAdmin;

  return (
    <div className={styles.mobileDrawer}>
      <div className={styles.mobileDrawerBackdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.mobileDrawerContent}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar email={user.email} username={user.username} size="md" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                {user.email || `User #${user.userId.slice(0, 8)}`}
              </div>
              <Badge variant="coral" size="sm">
                {isPlatformAdmin ? 'Super Admin' : user.role === 'admin' ? 'Org Admin' : user.role === 'creator' ? 'Teacher' : 'Student'}
              </Badge>
            </div>
          </div>
          <button type="button" className={styles.mobileToggleBtn} onClick={onClose} aria-label="Close drawer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.dropdownDivider} />

        <Link to="/dashboard" className={styles.dropdownItem} onClick={onClose}>
          Dashboard
        </Link>

        {isCreatorOrAdmin ? (
          <>
            <Link to="/classrooms" className={styles.dropdownItem} onClick={onClose}>
              Classrooms
            </Link>
            <Link to="/quizzes" className={styles.dropdownItem} onClick={onClose}>
              Quizzes
            </Link>
            <Link to="/attempts" className={styles.dropdownItem} onClick={onClose}>
              Analytics & Submissions
            </Link>
          </>
        ) : (
          <Link to="/attempts" className={styles.dropdownItem} onClick={onClose}>
            My Results
          </Link>
        )}

        {isPlatformAdmin && (
          <>
            <Link to="/admin/organizations" className={styles.dropdownItem} onClick={onClose}>
              Organizations
            </Link>
            <Link to="/admin" className={styles.dropdownItem} onClick={onClose}>
              Platform Admin
            </Link>
          </>
        )}

        <div className={styles.dropdownDivider} />

        <Link to="/profile" className={styles.dropdownItem} onClick={onClose}>
          Profile & Settings
        </Link>

        <div className={styles.dropdownDivider} />

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onClose();
            logout();
          }}
          style={{ marginTop: 'auto' }}
        >
          Log out
        </Button>
      </div>
    </div>
  );
};
