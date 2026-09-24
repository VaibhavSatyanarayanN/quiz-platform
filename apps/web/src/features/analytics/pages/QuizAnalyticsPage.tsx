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

  const { data: analytics, isLoading, isError, error } = useQuizAnalytics(
    quizId ?? '',
    selectedVersionId,
  );

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner message="Loading quiz analytics..." />
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <div className={styles.container}>
        <Button variant="ghost" onClick={() => navigate(-1)} className={styles.backButton}>
          ← Back
        </Button>
        <Alert variant="danger" title="Failed to load analytics">
          {(error as Error)?.message || 'Quiz analytics could not be retrieved.'}
        </Alert>
      </div>
    );
  }

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVersionId(e.target.value);
  };

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/creator/quizzes/${analytics.quizId}`)}
            className={styles.backButton}
          >
            ← Back to Quiz
          </Button>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{analytics.quizTitle}</h1>
            <span className={styles.analyticsBadge}>Analytics Dashboard</span>
          </div>
        </div>

        {/* Version Switcher */}
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
      </div>

      {/* Summary KPI Cards */}
      <AnalyticsSummaryCards summary={analytics.summary} />

      {/* Two column layout: Score Distribution & Top Scorers */}
      <div className={styles.gridTwoColumns}>
        <ScoreDistributionChart
          distribution={analytics.scoreDistribution}
          totalCompleted={analytics.summary.completedAttempts}
        />
        <TopScorersTable scorers={analytics.topScorers} />
      </div>

      {/* Question Breakdown List */}
      <div className={styles.sectionSpacer}>
        <QuestionAnalyticsList questions={analytics.questionAnalytics} />
      </div>
    </div>
  );
};

export default QuizAnalyticsPage;
