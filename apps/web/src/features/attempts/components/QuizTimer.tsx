import { useEffect, useRef } from 'react';
import {
  useCountdown,
  type TimerUrgencyLevel,
} from '../../../hooks/use-countdown.ts';

export interface QuizTimerProps {
  expiresAt: string | null;
  remainingTimeSeconds?: number | null;
  onExpire?: () => void;
  onUrgencyChange?: (urgency: TimerUrgencyLevel, totalSeconds: number) => void;
}

export function QuizTimer({
  expiresAt,
  remainingTimeSeconds,
  onExpire,
  onUrgencyChange,
}: QuizTimerProps) {
  const {
    totalSeconds,
    isExpired,
    isWarning,
    isUrgent,
    urgency,
    formatted,
  } = useCountdown(expiresAt, remainingTimeSeconds);
  const onExpireCalledRef = useRef(false);
  const previousExpiresAtRef = useRef<string | null>(expiresAt);

  useEffect(() => {
    if (previousExpiresAtRef.current !== expiresAt) {
      previousExpiresAtRef.current = expiresAt;
      onExpireCalledRef.current = false;
    }
  }, [expiresAt]);

  useEffect(() => {
    if (onUrgencyChange) {
      onUrgencyChange(urgency, totalSeconds);
    }
  }, [urgency, totalSeconds, onUrgencyChange]);

  useEffect(() => {
    if (isExpired && !onExpireCalledRef.current && onExpire) {
      onExpireCalledRef.current = true;
      onExpire();
    }
  }, [isExpired, onExpire]);

  if (!expiresAt) {
    return (
      <div
        role="timer"
        aria-label="Quiz timer: Untimed"
        data-timer-urgency="untimed"
        data-expired="false"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
            clipRule="evenodd"
          />
        </svg>
        <span>Untimed</span>
      </div>
    );
  }

  const color =
    isExpired || isUrgent
      ? 'var(--danger-accent, #dc2626)'
      : isWarning
        ? 'var(--warning-text, #b45309)'
        : 'var(--brand-600, #2563eb)';

  const backgroundColor =
    isExpired || isUrgent
      ? 'var(--danger-bg, #fef2f2)'
      : isWarning
        ? 'var(--warning-bg, #fffbeb)'
        : 'var(--color-surface, #ffffff)';

  return (
    <div
      role="timer"
      aria-live={isUrgent || isExpired ? 'assertive' : 'off'}
      aria-label={`Time remaining: ${isExpired ? '00:00 (Expired)' : formatted}`}
      data-timer-urgency={urgency}
      data-expired={isExpired ? 'true' : 'false'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 10px',
        borderRadius: '4px',
        border: `1px solid ${color}`,
        color,
        fontSize: '0.875rem',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        backgroundColor,
      }}
      title="Time remaining before auto-submission"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
          clipRule="evenodd"
        />
      </svg>
      <span>Time Remaining: {isExpired ? '00:00' : formatted}</span>
      {isExpired && (
        <span
          style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          • Expired
        </span>
      )}
      {!isExpired && isUrgent && (
        <span
          style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          • Final minute
        </span>
      )}
      {!isExpired && isWarning && (
        <span
          style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          • Low time
        </span>
      )}
    </div>
  );
}
