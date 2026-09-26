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

export function getUserInitials(name?: string, email?: string, username?: string): string {
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

/* Warm, rich SaaS Brand Gradients (Peach, Pink, Coral, Mustard) */
const GRADIENTS = [
  'linear-gradient(135deg, #E39A7B 0%, #D96E43 100%)', // Rich Coral
  'linear-gradient(135deg, #FFD3AC 0%, #E39A7B 100%)', // Peach-Coral
  'linear-gradient(135deg, #FFB5AB 0%, #D96E43 100%)', // Pink-Coral
  'linear-gradient(135deg, #DBB06B 0%, #D96E43 100%)', // Mustard-Coral
  'linear-gradient(135deg, #E39A7B 0%, #8C4B33 100%)', // Terracotta
  'linear-gradient(135deg, #FFB5AB 0%, #DBB06B 100%)', // Warm Sunburst
  'linear-gradient(135deg, #D96E43 0%, #A85232 100%)', // Deep Coral
];

function getGradientForString(str: string = 'user'): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
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
  const backgroundGradient = getGradientForString(identifier);

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
        background: src ? 'none' : backgroundGradient,
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
