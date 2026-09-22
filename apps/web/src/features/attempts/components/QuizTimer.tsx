import { useEffect, useRef } from 'react';
import { useCountdown } from '@/hooks/use-countdown';

interface QuizTimerProps {
  expiresAt: string | null;
  onExpire?: () => void;
}

export function QuizTimer({ expiresAt, onExpire }: QuizTimerProps) {
  const { totalSeconds, isExpired, formatted } = useCountdown(expiresAt);
  const onExpireCalledRef = useRef(false);

  useEffect(() => {
    if (isExpired && !onExpireCalledRef.current && onExpire) {
      onExpireCalledRef.current = true;
      onExpire();
    }
  }, [isExpired, onExpire]);

  if (!expiresAt) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
        </svg>
        <span>Untimed</span>
      </div>
    );
  }

  const isUrgent = totalSeconds > 0 && totalSeconds <= 60;
  const isWarning = totalSeconds > 60 && totalSeconds <= 300;

  const color = isUrgent ? 'var(--danger-accent, #dc2626)' : isWarning ? 'var(--warning-text, #b45309)' : 'var(--brand-600, #2563eb)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '4px',
        border: `1px solid ${color}`,
        color,
        fontSize: '0.875rem',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        backgroundColor: 'var(--color-surface, #ffffff)',
      }}
      title="Time remaining before auto-submission"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
      </svg>
      <span>Time Remaining: {isExpired ? '00:00' : formatted}</span>
    </div>
  );
}
