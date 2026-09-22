import React from 'react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({
  message = 'Loading...',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        padding: '32px',
        gap: '16px',
        color: 'var(--color-text-secondary, #6b7280)',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid var(--color-border, #e5e7eb)',
          borderTopColor: 'var(--brand-600, #4f46e5)',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }}
      />
      {message && <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{message}</span>}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
