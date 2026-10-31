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
import { Badge } from '../../../components/ui/Badge/Badge.js';
import { Card, CardBody } from '../../../components/ui/Card/Card.js';
import {
  TableContainer,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '../../../components/ui/Table/Table.js';
import styles from './QuizAnalyticsPage.module.css';

export const QuizAnalyticsPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(undefined);

  const { data: analytics, isLoading, isError, error, refetch } = useQuizAnalytics(
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

      {/* Empty State Banner if 0 attempts */}
      {hasZeroAttempts && (
        <Card variant="outlined" className={styles.emptyCard}>
          <CardBody className={styles.emptyCardBody}>
            <h3 className={styles.emptyTitle}>No attempts recorded yet for this version</h3>
            <p className={styles.emptyText}>
              Learner submissions, score distributions, top scorers, and question-level accuracy will populate automatically once learners start attempting this version.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Multi-Version Performance Comparison (when > 1 version exists) */}
      {analytics.versionSummaries && analytics.versionSummaries.length > 1 && (
        <div className={styles.sectionSpacer}>
          <div className={styles.typeSection}>
            <div className={styles.typeSectionHeader}>
              <h2 className={styles.typeSectionTitle}>Multi-Version Performance Comparison</h2>
              <Badge variant="neutral">
                {analytics.publishedVersionsCount} Published / {analytics.versionSummaries.length} Total Versions
              </Badge>
            </div>
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Version</Th>
                    <Th>Status</Th>
                    <Th>Questions</Th>
                    <Th>Total Marks</Th>
                    <Th>Time Limit</Th>
                    <Th>Total Attempts</Th>
                    <Th>Submitted</Th>
                    <Th>Expired</Th>
                    <Th>In Progress</Th>
                    <Th>Avg Score</Th>
                    <Th>Avg %</Th>
                    <Th>Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {analytics.versionSummaries.map((vs) => {
                    const isSelected = vs.versionId === analytics.versionId;
                    return (
                      <Tr
                        key={vs.versionId}
                        className={isSelected ? styles.activeVersionRow : styles.clickableRow}
                        onClick={() => setSelectedVersionId(vs.versionId)}
                      >
                        <Td>
                          <strong>v{vs.versionNumber}</strong>
                          {isSelected && (
                            <Badge variant="brand" size="sm" style={{ marginLeft: 6 }}>
                              Current
                            </Badge>
                          )}
                        </Td>
                        <Td>
                          <Badge variant={vs.status === 'published' ? 'success' : 'neutral'}>
                            {vs.status}
                          </Badge>
                        </Td>
                        <Td>{vs.totalQuestions}</Td>
                        <Td>{vs.totalMarks} pts</Td>
                        <Td>
                          {vs.timeLimitSeconds
                            ? `${Math.round(vs.timeLimitSeconds / 60)}m`
                            : 'Untimed'}
                        </Td>
                        <Td>
                          <strong>{vs.totalAttempts}</strong>
                        </Td>
                        <Td>{vs.submittedAttempts}</Td>
                        <Td>{vs.expiredAttempts}</Td>
                        <Td>{vs.inProgressAttempts}</Td>
                        <Td>
                          {vs.avgScore} / {vs.totalMarks}
                        </Td>
                        <Td>
                          <Badge
                            variant={
                              vs.avgPercentage >= 70
                                ? 'success'
                                : vs.avgPercentage >= 50
                                  ? 'warning'
                                  : 'neutral'
                            }
                          >
                            {vs.avgPercentage}%
                          </Badge>
                        </Td>
                        <Td>
                          <Button
                            variant={isSelected ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVersionId(vs.versionId);
                            }}
                          >
                            {isSelected ? 'Viewing' : 'Inspect'}
                          </Button>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
          </div>
        </div>
      )}

      {/* Question Type Performance Breakdown */}
      {analytics.questionTypeBreakdown &&
        Object.keys(analytics.questionTypeBreakdown).length > 0 && (
          <div className={styles.sectionSpacer}>
            <div className={styles.typeSection}>
              <div className={styles.typeSectionHeader}>
                <h2 className={styles.typeSectionTitle}>Question Type Performance Breakdown</h2>
                <Badge variant="neutral">By Format</Badge>
              </div>
              <div className={styles.typeGrid}>
                {Object.entries(analytics.questionTypeBreakdown).map(([typeKey, perf]) => (
                  <div key={typeKey} className={styles.typeCard}>
                    <div className={styles.typeCardHeader}>
                      <span className={styles.typeCardLabel}>
                        {typeKey.replace(/_/g, ' ')}
                      </span>
                      <Badge
                        variant={
                          perf.accuracyPercentage >= 70
                            ? 'success'
                            : perf.accuracyPercentage >= 40
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {perf.accuracyPercentage}%
                      </Badge>
                    </div>
                    <div className={styles.typeAccuracy}>{perf.accuracyPercentage}% Accuracy</div>
                    <div className={styles.typeMeta}>
                      {perf.questionCount} question{perf.questionCount !== 1 ? 's' : ''} ·{' '}
                      {perf.correctResponses} / {perf.totalResponses} correct response
                      {perf.totalResponses !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
