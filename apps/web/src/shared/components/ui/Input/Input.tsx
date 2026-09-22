import React, { useId } from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      iconLeft,
      iconRight,
      className = '',
      disabled,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className={styles.wrapper}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}

        <div className={styles.inputContainer}>
          {iconLeft && <span className={styles.iconLeft}>{iconLeft}</span>}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`
              ${styles.input}
              ${iconLeft ? styles.hasIconLeft : ''}
              ${iconRight ? styles.hasIconRight : ''}
              ${error ? styles.isError : ''}
              ${className}
            `}
            {...rest}
          />
          {iconRight && <span className={styles.iconRight}>{iconRight}</span>}
        </div>

        {error ? (
          <span id={errorId} className={styles.errorText} role="alert">
            {error}
          </span>
        ) : helperText ? (
          <span id={helperId} className={styles.helperText}>
            {helperText}
          </span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
