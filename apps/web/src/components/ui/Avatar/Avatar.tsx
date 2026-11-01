import React from 'react';
import styles from './Avatar.module.css';

export interface AvatarProps {
  name?: string;
  email?: string;
  username?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  variant?: 'gradient' | 'bordered';
  presetIcon?: string;
  showStatus?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function getUserInitials(name?: string, email?: string, username?: string): string {
  let source = name?.trim() || username?.trim();
  if (!source && email) {
    source = email.split('@')[0];
  }
  if (!source) return 'U';

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source)) {
    return 'U';
  }

  const words = source.split(/[\s._-]+/).filter(Boolean);

  if (words.length >= 2) {
    const first = words[0][0];
    const second = words[1][0];
    if (first && second) {
      return (first + second).toUpperCase();
    }
  }

  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return source.slice(0, 1).toUpperCase() || 'U';
}

/* Identity-preserving pale tone steps (taste-skill v2) */
const AVATAR_TONES = [
  { bg: 'var(--brand-50, #e0e7ff)', text: 'var(--brand-700, #3730a3)' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#e0f2fe', text: '#0369a1' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#fee2e2', text: '#991b1b' },
  { bg: 'var(--color-surface-active, #e2e8f0)', text: 'var(--color-text-primary, #0f172a)' },
];

function getToneForString(str: string = 'user') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_TONES.length;
  return AVATAR_TONES[index];
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  email,
  username,
  src,
  size = 'md',
  variant,
  presetIcon,
  showStatus = false,
  className = '',
  style,
}) => {
  const initials = getUserInitials(name, email, username);
  const identifier = email || username || name || 'default';
  const tone = getToneForString(identifier);

  const containerClasses = [
    styles.avatar,
    styles[size],
    variant === 'bordered' ? styles.bordered : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClasses}
      style={{
        background: src ? 'none' : tone.bg,
        color: src ? 'inherit' : tone.text,
        ...style,
      }}
      title={name || username || email || 'User Avatar'}
    >
      {src ? (
        <img
          src={src}
          alt={name || username || 'Avatar'}
          className={styles.avatarImage}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : presetIcon ? (
        <span className={styles.avatarIcon}>{presetIcon}</span>
      ) : (
        <span className={styles.avatarInitials}>{initials}</span>
      )}

      {showStatus && <span className={styles.statusDot} />}
    </div>
  );
};
