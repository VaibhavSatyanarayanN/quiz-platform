import { useState, useEffect, useCallback } from 'react';

interface CountdownResult {
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  formatted: string;
}

export function useCountdown(expiresAt: string | null): CountdownResult {
  const calculateRemaining = useCallback((): number => {
    if (!expiresAt) return -1;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  }, [expiresAt]);

  const [totalSeconds, setTotalSeconds] = useState<number>(() => calculateRemaining());

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTotalSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, calculateRemaining]);

  if (!expiresAt || totalSeconds < 0) {
    return {
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: false,
      formatted: '--:--',
    };
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    minutes,
    seconds,
    totalSeconds,
    isExpired: totalSeconds <= 0,
    formatted: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
}
