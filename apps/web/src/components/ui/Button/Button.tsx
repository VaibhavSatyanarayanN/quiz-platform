import React from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      icon,
      iconRight,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`}
        {...rest}
      >
        {isLoading ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          icon && <span aria-hidden="true">{icon}</span>
        )}
        <span>{children}</span>
        {!isLoading && iconRight && <span aria-hidden="true">{iconRight}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
