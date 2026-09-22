import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ThemeToggle } from '../ui/ThemeToggle/ThemeToggle';
import { Badge } from '../ui/Badge/Badge';
import styles from './Layout.module.css';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const { user, logout } = useAuth();
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

  const getInitials = (id?: string) => {
    if (!id) return 'U';
    return id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'U';
  };

  const isCreatorOrAdmin = user?.role === 'creator' || user?.role === 'admin';

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <button
          type="button"
          className={styles.mobileToggleBtn}
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation menu"
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

        <Link to="/dashboard" className={styles.logoArea} aria-label="QuizPlatform Dashboard">
          <div className={styles.logoIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <span className={styles.logoText}>QuizPlatform</span>
        </Link>

        {/* Primary Desktop Horizontal Navigation */}
        <nav className={styles.desktopNav}>
          <Link
            to="/dashboard"
            className={`${styles.topNavItem} ${
              location.pathname === '/dashboard' || location.pathname === '/'
                ? styles.topNavItemActive
                : ''
            }`}
          >
            Dashboard
          </Link>
          {isCreatorOrAdmin && (
            <Link
              to="/quizzes"
              className={`${styles.topNavItem} ${
                location.pathname.startsWith('/quizzes') ? styles.topNavItemActive : ''
              }`}
            >
              Quizzes
            </Link>
          )}
          <Link
            to="/attempts"
            className={`${styles.topNavItem} ${
              location.pathname.startsWith('/attempts') ? styles.topNavItemActive : ''
            }`}
          >
            Attempts
          </Link>
        </nav>
      </div>

      <div className={styles.headerRight}>
        {/* Utilities: Notification, Help, Theme Toggle */}
        <button
          type="button"
          className={styles.iconUtilityBtn}
          title="Notifications"
          aria-label="Notifications"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        <Link to="/profile" className={styles.iconUtilityBtn} title="Help Center" aria-label="Help">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </Link>

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
              {getInitials(user.userId)}
            </button>

            {isDropdownOpen && (
              <div className={styles.userDropdown}>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Signed in as</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                    {user.email || `User #${user.userId.slice(0, 8)}`}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'creator' ? 'brand' : 'neutral'} size="sm">
                      {user.role}
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
                  Profile & Settings
                </Link>

                <div className={styles.dropdownDivider} />

                <button
                  type="button"
                  className={styles.dropdownItem}
                  style={{ color: 'var(--danger-accent, #dc2626)' }}
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
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
