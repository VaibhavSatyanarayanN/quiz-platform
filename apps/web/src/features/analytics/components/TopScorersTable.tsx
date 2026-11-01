import React from 'react';
import type { TopScorer } from '../types/analytics.types.js';
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

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

function getInitial(name: string, email: string): string {
  if (name && name.trim().length > 0) return name.trim()[0].toUpperCase();
  if (email && email.trim().length > 0) return email.trim()[0].toUpperCase();
  return '?';
}

export const TopScorersTable: React.FC<Props> = ({ scorers }) => {
  return (
    <div className={styles.tablePanel}>
      <div className={styles.tablePanelHeader}>
        <div>
          <h3 className={styles.tablePanelTitle}>Top Scorers Leaderboard</h3>
          <p className={styles.tablePanelSubtitle}>
            Top-performing learners ranked by total score and completion efficiency
          </p>
        </div>
        <span className={`${styles.statusPill} ${styles.badgeNeutral}`}>
          {scorers.length} {scorers.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {scorers.length === 0 ? (
        <div className={styles.emptyNotice}>
          No completed attempts recorded yet. The leaderboard updates automatically.
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th className={styles.thRank}>Rank</th>
                <th className={styles.thLearner}>Learner</th>
                <th className={styles.thRight}>Score</th>
                <th className={styles.thRight}>Accuracy</th>
                <th className={styles.thRight}>Duration</th>
                <th className={styles.thRight}>Date</th>
              </tr>
            </thead>
            <tbody>
              {scorers.map((s, idx) => {
                const rank = idx + 1;
                const rankClass =
                  rank === 1
                    ? styles.rankGold
                    : rank === 2
                    ? styles.rankSilver
                    : rank === 3
                    ? styles.rankBronze
                    : styles.rankStandard;

                const pctBadgeClass =
                  s.percentage >= 80
                    ? styles.badgeSuccess
                    : s.percentage >= 60
                    ? styles.badgeWarning
                    : styles.badgeNeutral;

                const initial = getInitial(s.username, s.email);

                return (
                  <tr key={s.attemptId} className={styles.dataRow}>
                    <td className={styles.tdRank}>
                      <span className={`${styles.rankChip} ${rankClass}`}>#{rank}</span>
                    </td>
                    <td className={styles.tdLearner}>
                      <div className={styles.learnerCluster}>
                        <div className={styles.avatarCircle} aria-hidden="true">
                          {initial}
                        </div>
                        <div className={styles.learnerIdentity}>
                          <span className={styles.learnerName}>
                            {s.username || 'Anonymous Learner'}
                          </span>
                          <span className={styles.learnerEmail}>{s.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className={styles.tdScore}>
                      <span className={styles.scoreNumber}>{s.score}</span>
                      <span className={styles.scoreTotal}> / {s.totalMarks}</span>
                    </td>
                    <td className={styles.tdAccuracy}>
                      <span className={`${styles.statusPill} ${pctBadgeClass}`}>
                        {s.percentage}%
                      </span>
                    </td>
                    <td className={styles.tdDuration}>
                      <span className={styles.tabularFigure}>
                        {formatDuration(s.durationSeconds)}
                      </span>
                    </td>
                    <td className={styles.tdDate}>
                      <span className={styles.tabularFigure}>{formatDate(s.submittedAt)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
