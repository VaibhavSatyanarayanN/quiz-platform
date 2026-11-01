import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ThemeToggle } from '../ui/ThemeToggle/ThemeToggle';
import { Badge } from '../ui/Badge/Badge';
import { Avatar } from '../ui/Avatar/Avatar';
import styles from './Layout.module.css';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const { user, isPlatformAdmin, currentOrganization, logout } = useAuth();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBreadcrumb = () => {
    const p = location.pathname;
    if (p.startsWith('/quizzes')) return 'Workbench / Quizzes';
    if (p.startsWith('/classrooms')) return 'Workbench / Classrooms';
    if (p.startsWith('/attempts')) return 'Workbench / Submissions';
    if (p.startsWith('/organization')) return 'Organization / Members';
    if (p.startsWith('/admin')) return 'System Admin / Overview';
    if (p.startsWith('/profile')) return 'Account / Settings';
    return 'Workbench / Dashboard';
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className={styles.mobileToggleBtn}
          onClick={onToggleMobileMenu}
          aria-label="Toggle mobile menu"
        >
          {isMobileMenuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          )}
        </button>

        {/* Mobile Logo (hidden on desktop) */}
        <Link to="/dashboard" className={styles.mobileLogoArea} aria-label="QuizPlatform Dashboard">
          <div className={styles.brandMonogram} style={{ width: 26, height: 26 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 19 21 12 17 5 21 12 2" />
            </svg>
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>QuizPlatform</span>
        </Link>

        {/* Desktop Breadcrumb Navigation Indicator */}
        <div className={styles.headerBreadcrumb} aria-label="Current Scope">
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{getBreadcrumb()}</span>
        </div>
      </div>

      <div className={styles.headerRight}>
        {currentOrganization && (
          <div className={styles.orgBadge}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.orgIcon}>
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <path d="M9 22v-4h6v4" />
              <path d="M8 6h.01" />
              <path d="M16 6h.01" />
              <path d="M12 6h.01" />
              <path d="M12 10h.01" />
            </svg>
            <span className={styles.orgName}>{currentOrganization.organizationName}</span>
          </div>
        )}

        <ThemeToggle />

        {user && (
          <div className={styles.userMenuWrapper} ref={dropdownRef}>
            <button
              type="button"
              className={styles.avatarBtn}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-expanded={isDropdownOpen}
              aria-label="User profile menu"
            >
              <Avatar email={user.email} username={user.username} size="sm" showStatus />
            </button>

            {isDropdownOpen && (
              <div className={styles.userDropdown}>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Signed in as</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                    {user.email || `User #${user.userId.slice(0, 8)}`}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <Badge variant={isPlatformAdmin ? 'neutral' : user.role === 'admin' ? 'neutral' : 'neutral'} size="sm">
                      {isPlatformAdmin ? 'Super Admin' : user.role === 'admin' ? 'Org Admin' : user.role === 'creator' ? 'Teacher' : 'Student'}
                    </Badge>
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <Link
                  to="/profile"
                  className={styles.dropdownItem}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Profile & Settings</span>
                </Link>

                <div className={styles.dropdownDivider} />

                <button
                  type="button"
                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    logout();
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
