import React from 'react';
import type { QuizAnalyticsSummary } from '../types/analytics.types.js';
import styles from './AnalyticsComponents.module.css';

interface Props {
  summary: QuizAnalyticsSummary;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export const AnalyticsSummaryCards: React.FC<Props> = ({ summary }) => {
  const total = summary.totalAttempts;
  const submitted = summary.submittedAttempts ?? summary.completedAttempts;
  const expired = summary.expiredAttempts ?? 0;
  const inProgress = summary.inProgressAttempts ?? Math.max(0, total - summary.completedAttempts);
  const finalized = summary.completedAttempts;

  const finalizedPct =
    summary.finalizedRate ?? (total > 0 ? Math.round((finalized / total) * 100) : 0);
  const submittedPct = total > 0 ? ((submitted / total) * 100).toFixed(1) : '0.0';
  const inProgressPct = total > 0 ? ((inProgress / total) * 100).toFixed(1) : '0.0';
  const expiredPct = total > 0 ? ((expired / total) * 100).toFixed(1) : '0.0';

  const avgPct = summary.avgPercentage ?? 0;
  const avgBadgeClass =
    avgPct >= 75 ? styles.badgeSuccess : avgPct >= 50 ? styles.badgeWarning : styles.badgeDanger;

  return (
    <div className={styles.kpiContainer}>
      {/* 4 Primary Metric Cells */}
      <div className={styles.kpiGrid}>
        {/* KPI 1: Average Score */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Average Score</span>
            <span className={`${styles.statusPill} ${avgBadgeClass}`}>
              {avgPct}% avg
            </span>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{avgPct}%</span>
            <span className={styles.kpiSuffix}>
              ({summary.avgScore} / {summary.totalMarks} pts)
            </span>
          </div>
          <div className={styles.kpiSubtext}>
            Calculated across {finalized} finalized attempt{finalized !== 1 ? 's' : ''}
          </div>
        </div>

        {/* KPI 2: Total Attempts */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total Attempts</span>
            <span className={`${styles.statusPill} ${styles.badgeBrand}`}>
              {finalizedPct}% finalized
            </span>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{total}</span>
            <span className={styles.kpiSuffix}>learners</span>
          </div>
          <div className={styles.kpiSubtext}>
            {submitted} submitted · {expired} expired · {inProgress} active
          </div>
        </div>

        {/* KPI 3: Score Spread */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Score Dispersion</span>
            <span className={`${styles.statusPill} ${styles.badgeNeutral}`}>
              {summary.lowestPercentage ?? 0}% – {summary.highestPercentage ?? 0}%
            </span>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{summary.highestScore}</span>
            <span className={styles.kpiSuffix}>
              high / {summary.lowestScore} low pts
            </span>
          </div>
          <div className={styles.kpiSubtext}>
            {summary.totalQuestions} questions · {summary.totalMarks} max marks
          </div>
        </div>

        {/* KPI 4: Average Duration */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Average Duration</span>
            <span className={`${styles.statusPill} ${styles.badgeNeutral}`}>
              Active Session
            </span>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {formatDuration(summary.avgDurationSeconds)}
            </span>
          </div>
          <div className={styles.kpiSubtext}>
            {summary.totalCorrectAnswers} correct · {summary.totalWrongAnswers} wrong ·{' '}
            {summary.totalUnanswered} skipped
          </div>
        </div>
      </div>

      {/* Attempt Funnel Telemetry Bar (if attempts > 0) */}
      {total > 0 && (
        <div className={styles.funnelCard}>
          <div className={styles.funnelHeader}>
            <span className={styles.funnelTitle}>Attempt Lifecycle Breakdown</span>
            <span className={styles.funnelMeta}>
              {finalized} of {total} completed ({finalizedPct}%)
            </span>
          </div>
          <div className={styles.funnelTrack} role="img" aria-label="Attempt lifecycle distribution">
            {submitted > 0 && (
              <div
                className={styles.funnelSegmentSubmitted}
                style={{ width: `${submittedPct}%` }}
                title={`Submitted: ${submitted} (${submittedPct}%)`}
              />
            )}
            {inProgress > 0 && (
              <div
                className={styles.funnelSegmentInProgress}
                style={{ width: `${inProgressPct}%` }}
                title={`In Progress: ${inProgress} (${inProgressPct}%)`}
              />
            )}
            {expired > 0 && (
              <div
                className={styles.funnelSegmentExpired}
                style={{ width: `${expiredPct}%` }}
                title={`Expired: ${expired} (${expiredPct}%)`}
              />
            )}
          </div>
          <div className={styles.funnelLegend}>
            <div className={styles.funnelLegendItem}>
              <span className={`${styles.legendDot} ${styles.dotSubmitted}`} />
              <span className={styles.legendLabel}>Submitted</span>
              <span className={styles.legendValue}>
                {submitted} ({submittedPct}%)
              </span>
            </div>
            <div className={styles.funnelLegendItem}>
              <span className={`${styles.legendDot} ${styles.dotInProgress}`} />
              <span className={styles.legendLabel}>In Progress</span>
              <span className={styles.legendValue}>
                {inProgress} ({inProgressPct}%)
              </span>
            </div>
            <div className={styles.funnelLegendItem}>
              <span className={`${styles.legendDot} ${styles.dotExpired}`} />
              <span className={styles.legendLabel}>Expired</span>
              <span className={styles.legendValue}>
                {expired} ({expiredPct}%)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
