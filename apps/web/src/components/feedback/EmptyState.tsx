import React from 'react';
import { Button } from '../ui/Button/Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        border: '1px dashed var(--color-border, #d1d5db)',
        borderRadius: '12px',
        backgroundColor: 'var(--color-bg-subtle, #f9fafb)',
        margin: '16px 0',
      }}
    >
      {icon && (
        <div
          style={{
            fontSize: '32px',
            marginBottom: '16px',
            color: 'var(--color-text-muted, #9ca3af)',
          }}
        >
          {icon}
        </div>
      )}
      <h3
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--color-text-primary, #111827)',
          margin: '0 0 8px 0',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary, #6b7280)',
            maxWidth: '400px',
            margin: '0 0 20px 0',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
