import React from 'react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const stylesMap = {
    info: {
      bg: 'var(--brand-50, #eef2ff)',
      border: 'var(--brand-200, #c7d2fe)',
      text: 'var(--brand-700, #3730a3)',
    },
    success: {
      bg: 'var(--success-bg, #ecfdf5)',
      border: 'var(--success-border, #a7f3d0)',
      text: 'var(--success-text, #047857)',
    },
    warning: {
      bg: 'var(--warning-bg, #fffbeb)',
      border: 'var(--warning-border, #fde68a)',
      text: 'var(--warning-text, #b45309)',
    },
    danger: {
      bg: 'var(--danger-bg, #fef2f2)',
      border: 'var(--danger-border, #fecaca)',
      text: 'var(--danger-text, #b91c1c)',
    },
  };

  const style = stylesMap[variant];

  return (
    <div
      role="alert"
      className={className}
      style={{
        padding: '14px 16px',
        borderRadius: '8px',
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '0.875rem',
        lineHeight: '1.4',
      }}
    >
      <div>
        {title && <div style={{ fontWeight: 600, marginBottom: '4px' }}>{title}</div>}
        <div>{children}</div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          style={{
            background: 'none',
            border: 'none',
            color: 'currentColor',
            cursor: 'pointer',
            padding: '2px',
            opacity: 0.8,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};
