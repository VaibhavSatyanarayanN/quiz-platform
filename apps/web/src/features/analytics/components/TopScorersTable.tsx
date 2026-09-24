import React from 'react';
import type { TopScorer } from '../types/analytics.types.js';
import { Card, CardHeader, CardTitle, CardBody } from '../../../components/ui/Card/Card.js';
import { Table } from '../../../components/ui/Table/Table.js';
import { Badge } from '../../../components/ui/Badge/Badge.js';
import styles from './AnalyticsComponents.module.css';

interface Props {
  scorers: TopScorer[];
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export const TopScorersTable: React.FC<Props> = ({ scorers }) => {
  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Top Scorers Leaderboard</CardTitle>
      </CardHeader>
      <CardBody>
        {scorers.length === 0 ? (
          <p className={styles.emptyNotice}>No attempts completed yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Taker</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Duration</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {scorers.map((s, idx) => {
                const rank = idx + 1;
                return (
                  <tr key={s.attemptId}>
                    <td>
                      <span
                        className={`${styles.rankBadge} ${
                          rank === 1 ? styles.rank1 : rank === 2 ? styles.rank2 : rank === 3 ? styles.rank3 : ''
                        }`}
                      >
                        #{rank}
                      </span>
                    </td>
                    <td>
                      <div className={styles.userName}>{s.username}</div>
                      <div className={styles.userEmail}>{s.email}</div>
                    </td>
                    <td>
                      <strong>
                        {s.score} / {s.totalMarks}
                      </strong>
                    </td>
                    <td>
                      <Badge
                        variant={
                          s.percentage >= 80 ? 'success' : s.percentage >= 60 ? 'warning' : 'neutral'
                        }
                      >
                        {s.percentage}%
                      </Badge>
                    </td>
                    <td>{formatDuration(s.durationSeconds)}</td>
                    <td>{new Date(s.submittedAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
};
