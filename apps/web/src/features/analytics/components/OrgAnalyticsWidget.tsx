import React from 'react';
import type { OrganizationAnalyticsResponse } from '../types/analytics.types.js';
import { Card, CardHeader, CardTitle, CardBody } from '../../../components/ui/Card/Card.js';
import { Badge } from '../../../components/ui/Badge/Badge.js';
import { Table } from '../../../components/ui/Table/Table.js';
import { Link } from 'react-router';
import styles from './AnalyticsComponents.module.css';

interface Props {
  analytics: OrganizationAnalyticsResponse;
}

export const OrgAnalyticsWidget: React.FC<Props> = ({ analytics }) => {
  return (
    <div className={styles.orgWidgetContainer}>
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Organization Analytics — {analytics.organizationName}</CardTitle>
        </CardHeader>
        <CardBody>
          <div className={styles.kpiGrid}>
            <div className={styles.orgKpiBox}>
              <span className={styles.kpiLabel}>Total Quizzes</span>
              <span className={styles.kpiValue}>{analytics.totalQuizzes}</span>
              <span className={styles.kpiSubtext}>{analytics.publishedQuizzes} published</span>
            </div>

            <div className={styles.orgKpiBox}>
              <span className={styles.kpiLabel}>Total Attempts</span>
              <span className={styles.kpiValue}>{analytics.totalAttempts}</span>
              <span className={styles.kpiSubtext}>{analytics.completedAttempts} completed</span>
            </div>

            <div className={styles.orgKpiBox}>
              <span className={styles.kpiLabel}>Overall Avg Score</span>
              <span className={styles.kpiValue}>{analytics.avgPercentage}%</span>
              <span className={styles.kpiSubtext}>Across all org quizzes</span>
            </div>

            <div className={styles.orgKpiBox}>
              <span className={styles.kpiLabel}>Team Members</span>
              <span className={styles.kpiValue}>{analytics.totalMembers}</span>
              <span className={styles.kpiSubtext}>Active org creators</span>
            </div>
          </div>

          <div className={styles.topQuizzesSection}>
            <h4 className={styles.sectionSubTitle}>Top Performing Quizzes</h4>
            {analytics.topQuizzes.length === 0 ? (
              <p className={styles.emptyNotice}>No quizzes created in this organization yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Quiz Title</th>
                    <th>Attempts</th>
                    <th>Average Score</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topQuizzes.map((q) => (
                    <tr key={q.quizId}>
                      <td>
                        <strong>{q.title}</strong>
                      </td>
                      <td>{q.attemptCount}</td>
                      <td>
                        <Badge
                          variant={
                            q.avgPercentage >= 70
                              ? 'success'
                              : q.avgPercentage >= 50
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {q.avgPercentage}%
                        </Badge>
                      </td>
                      <td>
                        <Link
                          to={`/creator/quizzes/${q.quizId}/analytics`}
                          className={styles.analyticsLink}
                        >
                          View Analytics →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
