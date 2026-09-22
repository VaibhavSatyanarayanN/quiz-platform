import React from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/hooks/use-auth';
import styles from './Layout.module.css';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isCreatorOrAdmin = user?.role === 'creator' || user?.role === 'admin';

  return (
    <aside className={styles.sidebar}>
      <div className={styles.navSectionLabel}>Platform Navigation</div>

      <Link
        to="/dashboard"
        className={`${styles.navItem} ${
          location.pathname === '/dashboard' || location.pathname === '/'
            ? styles.navItemActive
            : ''
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>Dashboard</span>
      </Link>

      <Link
        to="/attempts"
        className={`${styles.navItem} ${
          location.pathname === '/attempts' ? styles.navItemActive : ''
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>Attempt History</span>
      </Link>

      {isCreatorOrAdmin && (
        <>
          <div className={styles.navSectionLabel}>Creator Studio</div>
          <Link
            to="/quizzes"
            className={`${styles.navItem} ${
              location.pathname.startsWith('/quizzes') ? styles.navItemActive : ''
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>My Quizzes</span>
          </Link>
        </>
      )}

      <div className={styles.navSectionLabel}>Account</div>
      <Link
        to="/profile"
        className={`${styles.navItem} ${
          location.pathname === '/profile' ? styles.navItemActive : ''
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>Profile & Settings</span>
      </Link>
    </aside>
  );
};
