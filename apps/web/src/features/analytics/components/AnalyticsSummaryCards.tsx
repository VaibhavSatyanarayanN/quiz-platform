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
  return (
    <div className={styles.kpiGrid}>
      <Card variant="outlined">
        <CardBody className={styles.kpiCardBody}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total Attempts</span>
            <Badge variant="brand">{summary.completionRate}% Completed</Badge>
          </div>
          <div className={styles.kpiValue}>{summary.totalAttempts}</div>
          <div className={styles.kpiSubtext}>
            {summary.completedAttempts} completed, {summary.totalAttempts - summary.completedAttempts} in progress
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
            Across all completed attempts
          </div>
        </CardBody>
      </Card>

      <Card variant="outlined">
        <CardBody className={styles.kpiCardBody}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Score Range</span>
            <Badge variant="neutral">Highest & Lowest</Badge>
          </div>
          <div className={styles.kpiValue}>
            {summary.highestScore} <span className={styles.kpiUnit}>High</span> / {summary.lowestScore} <span className={styles.kpiUnit}>Low</span>
          </div>
          <div className={styles.kpiSubtext}>
            Total questions: {summary.totalQuestions} ({summary.totalMarks} total marks)
          </div>
        </CardBody>
      </Card>

      <Card variant="outlined">
        <CardBody className={styles.kpiCardBody}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Avg Duration</span>
            <Badge variant="neutral">Completion Time</Badge>
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
