/**
 * Format duration in seconds to human readable string (e.g. 1800 -> "30 minutes", 0 -> "Untimed")
 */
export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return 'Untimed';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0 && remainingSeconds > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`;
}

/**
 * Format time limit countdown timer (e.g. 125 -> "02:05")
 */
export function formatCountdownTimer(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Format ISO date string to localized display date
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Format score percentage nicely
 */
export function formatPercentage(score: number, total: number): string {
  if (!total || total === 0) return '0%';
  const pct = Math.round((score / total) * 100);
  return `${pct}%`;
}
