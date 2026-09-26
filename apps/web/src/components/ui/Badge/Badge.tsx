import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'peach' | 'pink' | 'coral' | 'mustard' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className = '',
  variant = 'neutral',
  size = 'md',
  icon,
  ...rest
}) => {
  return (
    <span
      className={`${styles.badge} ${styles[variant]} ${styles[size]} ${className}`}
      {...rest}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
};
