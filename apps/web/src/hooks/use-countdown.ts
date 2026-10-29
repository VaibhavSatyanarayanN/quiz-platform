import { useState, useEffect, useMemo } from 'react';
import {
  calculateCountdownSnapshot,
  computeServerClockSkewOffsetMs,
  LOW_TIME_WARNING_THRESHOLD_SECONDS,
  URGENT_TIME_WARNING_THRESHOLD_SECONDS,
  type CountdownResult,
  type TimerUrgencyLevel,
} from '../features/attempts/utils/attempt-persistence.ts';

export {
  calculateCountdownSnapshot,
  computeServerClockSkewOffsetMs,
  LOW_TIME_WARNING_THRESHOLD_SECONDS,
  URGENT_TIME_WARNING_THRESHOLD_SECONDS,
  type CountdownResult,
  type TimerUrgencyLevel,
};

export function useCountdown(
  expiresAt: string | null,
  serverRemainingTimeSeconds?: number | null,
): CountdownResult {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const clockSkewOffsetMs = useMemo(
    () =>
      computeServerClockSkewOffsetMs(expiresAt, serverRemainingTimeSeconds),
    [expiresAt, serverRemainingTimeSeconds],
  );

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const tick = () => {
      const currentNow = Date.now();
      setNowMs(currentNow);
      const currentSnap = calculateCountdownSnapshot(
        expiresAt,
        currentNow,
        clockSkewOffsetMs,
      );
      return currentSnap.isExpired;
    };

    const interval = setInterval(() => {
      if (tick()) {
        clearInterval(interval);
      }
    }, 1000);

    const handleVisibilityOrFocus = () => {
      if (
        typeof document === 'undefined' ||
        document.visibilityState === 'visible'
      ) {
        if (tick()) {
          clearInterval(interval);
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityOrFocus,
        );
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus);
      }
    };
  }, [expiresAt, clockSkewOffsetMs]);

  return calculateCountdownSnapshot(expiresAt, nowMs, clockSkewOffsetMs);
}
