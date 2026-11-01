import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuizAnalytics } from '../hooks/use-analytics.js';
import { AnalyticsSummaryCards } from '../components/AnalyticsSummaryCards.js';
import { ScoreDistributionChart } from '../components/ScoreDistributionChart.js';
import { TopScorersTable } from '../components/TopScorersTable.js';
import { QuestionAnalyticsList } from '../components/QuestionAnalyticsList.js';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner.js';
import { Alert } from '../../../components/feedback/Alert.js';
import { Button } from '../../../components/ui/Button/Button.js';
import styles from './QuizAnalyticsPage.module.css';

export const QuizAnalyticsPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(undefined);

  const { data: analytics, isLoading, isError, error, refetch, isFetching } = useQuizAnalytics(
    quizId ?? '',
    selectedVersionId,
  );

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner message="Loading quiz performance telemetry..." />
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <div className={styles.container}>
        <Button variant="ghost" onClick={() => navigate(-1)} className={styles.backButton}>
          Back
        </Button>
        <Alert variant="danger" title="Failed to load analytics">
          {(error as Error)?.message || 'Quiz analytics could not be retrieved.'}
        </Alert>
        <div className={styles.errorActions}>
          <Button variant="primary" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVersionId(e.target.value);
  };

  const hasZeroAttempts = analytics.summary.totalAttempts === 0;

  return (
    <div className={styles.container}>
      {/* Top Header & Breadcrumbs */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumbBar}>
            <button
              type="button"
              onClick={() => navigate(`/creator/quizzes/${analytics.quizId}`)}
              className={styles.backLink}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Back to Quiz Editor</span>
            </button>
            <span className={styles.breadcrumbDivider}>/</span>
            <span className={styles.breadcrumbCurrent}>Analytics Workbench</span>
          </div>

          <div className={styles.titleRow}>
            <h1 className={styles.title}>{analytics.quizTitle}</h1>
            <span className={styles.versionBadge}>v{analytics.versionNumber}</span>
            <span className={styles.analyticsBadge}>Telemetry Active</span>
          </div>
          <p className={styles.subtitle}>
            Comprehensive learner cohort analytics, score distributions, and item-level option
            frequencies.
          </p>
        </div>

        {/* Right Header Toolbar: Version Switcher & Refetch */}
        <div className={styles.headerToolbar}>
          <div className={styles.versionSelectorContainer}>
            <label htmlFor="version-select" className={styles.versionLabel}>
              Version:
            </label>
            <select
              id="version-select"
              value={analytics.versionId}
              onChange={handleVersionChange}
              className={styles.versionSelect}
            >
              {analytics.availableVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} ({v.status})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh telemetry"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isFetching ? styles.spinIcon : undefined}
              aria-hidden="true"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Band & Lifecycle Funnel */}
      <AnalyticsSummaryCards summary={analytics.summary} />

      {/* Empty State Banner if 0 attempts */}
      {hasZeroAttempts && (
        <div className={styles.emptyCard}>
          <div className={styles.emptyCardBody}>
            <div className={styles.emptyIconBadge}>0</div>
            <h3 className={styles.emptyTitle}>No attempts recorded yet for this version</h3>
            <p className={styles.emptyText}>
              Learner submissions, score distributions, top scorers leaderboard, and question-level
              accuracy will populate automatically once learners start attempting version{' '}
              <strong>v{analytics.versionNumber}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Multi-Version Performance Comparison (when > 1 version exists) */}
      {analytics.versionSummaries && analytics.versionSummaries.length > 1 && (
        <div className={styles.sectionSpacer}>
          <div className={styles.versionSection}>
            <div className={styles.sectionHeaderRow}>
              <div>
                <h2 className={styles.sectionTitle}>Multi-Version Performance Comparison</h2>
                <p className={styles.sectionSubtitle}>
                  Comparative cohort telemetry across published versions
                </p>
              </div>
              <span className={`${styles.statusPill} ${styles.badgeNeutral}`}>
                {analytics.publishedVersionsCount} Published / {analytics.versionSummaries.length}{' '}
                Total Versions
              </span>
            </div>

            <div className={styles.versionTableWrapper}>
              <table className={styles.versionTable}>
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Status</th>
                    <th className={styles.thRight}>Questions</th>
                    <th className={styles.thRight}>Total Marks</th>
                    <th className={styles.thRight}>Time Limit</th>
                    <th className={styles.thRight}>Total Attempts</th>
                    <th className={styles.thRight}>Submitted</th>
                    <th className={styles.thRight}>Expired</th>
                    <th className={styles.thRight}>Avg Score</th>
                    <th className={styles.thRight}>Accuracy %</th>
                    <th className={styles.thCenter}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.versionSummaries.map((vs) => {
                    const isSelected = vs.versionId === analytics.versionId;
                    const accuracyBadgeClass =
                      vs.avgPercentage >= 75
                        ? styles.badgeSuccess
                        : vs.avgPercentage >= 50
                        ? styles.badgeWarning
                        : styles.badgeDanger;

                    return (
                      <tr
                        key={vs.versionId}
                        className={`${styles.versionRow} ${
                          isSelected ? styles.versionRowActive : ''
                        }`}
                        onClick={() => setSelectedVersionId(vs.versionId)}
                      >
                        <td className={styles.tdVersionName}>
                          <strong>v{vs.versionNumber}</strong>
                          {isSelected && (
                            <span className={`${styles.statusPill} ${styles.badgeBrand}`}>
                              Current
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${
                              vs.status === 'published' ? styles.badgeSuccess : styles.badgeNeutral
                            }`}
                          >
                            {vs.status}
                          </span>
                        </td>
                        <td className={styles.tdRight}>{vs.totalQuestions}</td>
                        <td className={styles.tdRight}>{vs.totalMarks} pts</td>
                        <td className={styles.tdRight}>
                          {vs.timeLimitSeconds
                            ? `${Math.round(vs.timeLimitSeconds / 60)}m`
                            : 'Untimed'}
                        </td>
                        <td className={styles.tdRight}>
                          <strong>{vs.totalAttempts}</strong>
                        </td>
                        <td className={styles.tdRight}>{vs.submittedAttempts}</td>
                        <td className={styles.tdRight}>{vs.expiredAttempts}</td>
                        <td className={styles.tdRight}>
                          {vs.avgScore} / {vs.totalMarks}
                        </td>
                        <td className={styles.tdRight}>
                          <span className={`${styles.statusPill} ${accuracyBadgeClass}`}>
                            {vs.avgPercentage}%
                          </span>
                        </td>
                        <td className={styles.tdCenter}>
                          <button
                            type="button"
                            className={
                              isSelected ? styles.actionButtonActive : styles.actionButtonGhost
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVersionId(vs.versionId);
                            }}
                          >
                            {isSelected ? 'Viewing' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Question Format Performance Breakdown */}
      {analytics.questionTypeBreakdown &&
        Object.keys(analytics.questionTypeBreakdown).length > 0 && (
          <div className={styles.sectionSpacer}>
            <div className={styles.formatSection}>
              <div className={styles.sectionHeaderRow}>
                <div>
                  <h2 className={styles.sectionTitle}>Question Format Performance Breakdown</h2>
                  <p className={styles.sectionSubtitle}>
                    Accuracy comparison partitioned by question format
                  </p>
                </div>
                <span className={`${styles.statusPill} ${styles.badgeNeutral}`}>
                  {Object.keys(analytics.questionTypeBreakdown).length} Formats
                </span>
              </div>
              <div className={styles.formatGrid}>
                {Object.entries(analytics.questionTypeBreakdown).map(([typeKey, perf]) => {
                  const acc = perf.accuracyPercentage ?? 0;
                  const accBadgeClass =
                    acc >= 75
                      ? styles.badgeSuccess
                      : acc >= 50
                      ? styles.badgeWarning
                      : styles.badgeDanger;

                  return (
                    <div key={typeKey} className={styles.formatCard}>
                      <div className={styles.formatCardHeader}>
                        <span className={styles.formatCardLabel}>
                          {typeKey.replace(/_/g, ' ')}
                        </span>
                        <span className={`${styles.statusPill} ${accBadgeClass}`}>
                          {acc}% Acc
                        </span>
                      </div>
                      <div className={styles.formatAccuracyRow}>
                        <span className={styles.formatAccuracyValue}>{acc}%</span>
                        <span className={styles.formatAccuracyLabel}>Observed Accuracy</span>
                      </div>
                      {/* Mini visual accuracy progress track */}
                      <div className={styles.formatTrack}>
                        <div
                          className={styles.formatFill}
                          style={{ width: `${Math.min(100, Math.max(0, acc))}%` }}
                        />
                      </div>
                      <div className={styles.formatMeta}>
                        {perf.questionCount} {perf.questionCount === 1 ? 'question' : 'questions'} ·{' '}
                        {perf.correctResponses} / {perf.totalResponses} correct responses
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      {/* Two Column Grid: Score Distribution Histogram & Top Scorers Leaderboard */}
      <div className={styles.gridTwoColumns}>
        <ScoreDistributionChart
          distribution={analytics.scoreDistribution}
          totalCompleted={analytics.summary.completedAttempts}
          avgPercentage={analytics.summary.avgPercentage}
        />
        <TopScorersTable scorers={analytics.topScorers} />
      </div>

      {/* Question Breakdown Matrix */}
      <div className={styles.sectionSpacer}>
        <QuestionAnalyticsList questions={analytics.questionAnalytics} />
      </div>
    </div>
  );
};

export default QuizAnalyticsPage;
