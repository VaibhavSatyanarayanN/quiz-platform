import React from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/hooks/use-auth';
import styles from './Layout.module.css';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, isPlatformAdmin, currentOrganization } = useAuth();

  const isCreatorOrAdmin = user?.role === 'creator' || user?.role === 'admin' || isPlatformAdmin;

  return (
    <aside className={styles.sidebar}>
      {/* Brand & Studio Scope Header */}
      <div className={styles.sidebarBrand}>
        <Link to="/dashboard" className={styles.brandLink}>
          <div className={styles.brandMonogram} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 19 21 12 17 5 21 12 2" />
            </svg>
          </div>
          <div className={styles.brandMeta}>
            <span className={styles.brandTitle}>QuizPlatform</span>
            <span className={styles.brandScope}>
              {currentOrganization?.organizationName || 'Assessment Studio'}
            </span>
          </div>
        </Link>
      </div>

      <nav className={styles.sidebarNav} aria-label="Main Navigation">
        {/* Workbench Section */}
        <div className={styles.navGroupLabel}>Workbench</div>

        <Link
          to="/dashboard"
          className={`${styles.navItem} ${
            location.pathname === '/dashboard' || location.pathname === '/' || location.pathname.endsWith('/dashboard')
              ? styles.navItemActive
              : ''
          }`}
        >
          <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>Dashboard</span>
        </Link>

        {isCreatorOrAdmin && (
          <>
            <Link
              to="/quizzes"
              className={`${styles.navItem} ${
                location.pathname.startsWith('/quizzes') ? styles.navItemActive : ''
              }`}
            >
              <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Quizzes</span>
            </Link>

            <Link
              to="/classrooms"
              className={`${styles.navItem} ${
                location.pathname.startsWith('/classrooms') ? styles.navItemActive : ''
              }`}
            >
              <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>Classrooms</span>
            </Link>
          </>
        )}

        <Link
          to="/attempts"
          className={`${styles.navItem} ${
            location.pathname.startsWith('/attempts') ? styles.navItemActive : ''
          }`}
        >
          <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{isCreatorOrAdmin ? 'Submissions' : 'My Past Attempts'}</span>
        </Link>

        {/* Organization Section */}
        {isCreatorOrAdmin && (
          <>
            <div className={styles.navGroupLabel}>Organization</div>
            <Link
              to="/organization/members"
              className={`${styles.navItem} ${
                location.pathname.startsWith('/organization') ? styles.navItemActive : ''
              }`}
            >
              <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Members & Roles</span>
            </Link>
          </>
        )}

        {/* System Administration Section */}
        {isPlatformAdmin && (
          <>
            <div className={styles.navGroupLabel}>System Admin</div>
            <Link
              to="/admin"
              className={`${styles.navItem} ${
                location.pathname === '/admin' ? styles.navItemActive : ''
              }`}
            >
              <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Platform Admin</span>
            </Link>
            <Link
              to="/admin/organizations"
              className={`${styles.navItem} ${
                location.pathname.startsWith('/admin/organizations') ? styles.navItemActive : ''
              }`}
            >
              <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01" />
                <path d="M16 6h.01" />
                <path d="M12 6h.01" />
                <path d="M12 10h.01" />
                <path d="M12 14h.01" />
              </svg>
              <span>Organizations</span>
            </Link>
          </>
        )}
      </nav>

      {/* Account Section */}
      <div className={styles.sidebarFooter}>
        <Link
          to="/profile"
          className={`${styles.navItem} ${
            location.pathname === '/profile' ? styles.navItemActive : ''
          }`}
        >
          <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Profile & Settings</span>
        </Link>
      </div>
    </aside>
  );
};
