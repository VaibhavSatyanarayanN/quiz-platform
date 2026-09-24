import React from 'react';
import type { ScoreDistribution } from '../types/analytics.types.js';
import { Card, CardHeader, CardTitle, CardBody } from '../../../components/ui/Card/Card.js';
import styles from './AnalyticsComponents.module.css';

interface Props {
  distribution: ScoreDistribution;
  totalCompleted: number;
}

interface BucketItem {
  label: string;
  count: number;
  percentage: number;
  colorClass: string;
}

export const ScoreDistributionChart: React.FC<Props> = ({ distribution, totalCompleted }) => {
  const buckets: BucketItem[] = [
    {
      label: '90% – 100%',
      count: distribution.range90To100.count,
      percentage: distribution.range90To100.percentage,
      colorClass: styles.barSuccess,
    },
    {
      label: '80% – 89%',
      count: distribution.range80To89.count,
      percentage: distribution.range80To89.percentage,
      colorClass: styles.barGood,
    },
    {
      label: '70% – 79%',
      count: distribution.range70To79.count,
      percentage: distribution.range70To79.percentage,
      colorClass: styles.barAverage,
    },
    {
      label: '60% – 69%',
      count: distribution.range60To69.count,
      percentage: distribution.range60To69.percentage,
      colorClass: styles.barWarning,
    },
    {
      label: 'Below 60%',
      count: distribution.rangeBelow60.count,
      percentage: distribution.rangeBelow60.percentage,
      colorClass: styles.barDanger,
    },
  ];

  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Score Distribution</CardTitle>
      </CardHeader>
      <CardBody>
        <div className={styles.chartContainer}>
          {buckets.map((b) => (
            <div key={b.label} className={styles.chartRow}>
              <div className={styles.chartLabel}>{b.label}</div>
              <div className={styles.chartTrack}>
                <div
                  className={`${styles.chartFill} ${b.colorClass}`}
                  style={{ width: `${Math.min(100, Math.max(0, b.percentage))}%` }}
                />
              </div>
              <div className={styles.chartValue}>
                {b.count} ({b.percentage}%)
              </div>
            </div>
          ))}
        </div>
        {totalCompleted === 0 && (
          <p className={styles.emptyNotice}>No completed attempts yet to display distribution.</p>
        )}
      </CardBody>
    </Card>
  );
};
