import React from 'react';
import type { QuizAnalyticsSummary } from '../types/analytics.types.js';
import { Card, CardBody } from '../../../components/ui/Card/Card.js';
import { Badge } from '../../../components/ui/Badge/Badge.js';
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
  const submitted = summary.submittedAttempts ?? summary.completedAttempts;
  const expired = summary.expiredAttempts ?? 0;
  const inProgress = summary.inProgressAttempts ?? Math.max(0, summary.totalAttempts - summary.completedAttempts);
  const finalized = summary.completedAttempts;
  const finalizedPct = summary.finalizedRate ?? (summary.totalAttempts > 0 ? Math.round((finalized / summary.totalAttempts) * 100) : 0);
  const completionPct = summary.completionRate ?? (summary.totalAttempts > 0 ? Math.round((submitted / summary.totalAttempts) * 100) : 0);

  return (
    <div className={styles.kpiGrid}>
      <Card variant="outlined">
        <CardBody className={styles.kpiCardBody}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total Attempts</span>
            <Badge variant="brand">{finalizedPct}% Finalized</Badge>
          </div>
          <div className={styles.kpiValue}>{summary.totalAttempts}</div>
          <div className={styles.kpiSubtext}>
            {submitted} submitted ({completionPct}%), {expired} expired, {inProgress} in progress
          </div>
        </CardBody>
      </Card>

      <Card variant="outlined">
        <CardBody className={styles.kpiCardBody}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Average Score</span>
            <Badge variant={summary.avgPercentage >= 70 ? 'success' : summary.avgPercentage >= 50 ? 'warning' : 'danger'}>
              {summary.avgPercentage}% Avg
            </Badge>
          </div>
          <div className={styles.kpiValue}>
            {summary.avgScore} <span className={styles.kpiUnit}>/ {summary.totalMarks} pts</span>
          </div>
          <div className={styles.kpiSubtext}>
            Across all {finalized} finalized attempt{finalized !== 1 ? 's' : ''}
          </div>
        </CardBody>
      </Card>

      <Card variant="outlined">
        <CardBody className={styles.kpiCardBody}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Score Range</span>
            <Badge variant="neutral">
              {summary.lowestPercentage ?? 0}% – {summary.highestPercentage ?? 0}%
            </Badge>
          </div>
          <div className={styles.kpiValue}>
            {summary.highestScore} <span className={styles.kpiUnit}>High</span> / {summary.lowestScore} <span className={styles.kpiUnit}>Low</span>
          </div>
          <div className={styles.kpiSubtext}>
            {summary.totalQuestions} question{summary.totalQuestions !== 1 ? 's' : ''} ({summary.totalMarks} total marks)
          </div>
        </CardBody>
      </Card>

      <Card variant="outlined">
        <CardBody className={styles.kpiCardBody}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Avg Duration</span>
            <Badge variant="neutral">Active Time</Badge>
          </div>
          <div className={styles.kpiValue}>{formatDuration(summary.avgDurationSeconds)}</div>
          <div className={styles.kpiSubtext}>
            Total answers: {summary.totalCorrectAnswers} correct, {summary.totalWrongAnswers} wrong
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
