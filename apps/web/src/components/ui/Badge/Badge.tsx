import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
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
