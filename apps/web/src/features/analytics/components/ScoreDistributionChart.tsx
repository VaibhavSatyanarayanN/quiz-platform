import React, { useState } from 'react';
import type { ScoreDistribution } from '../types/analytics.types.js';
import styles from './AnalyticsComponents.module.css';

interface Props {
  distribution: ScoreDistribution;
  totalCompleted: number;
  avgPercentage?: number;
}

interface BucketItem {
  id: string;
  label: string;
  shortLabel: string;
  count: number;
  percentage: number;
  rangeMin: number;
  rangeMax: number;
}

export const ScoreDistributionChart: React.FC<Props> = ({
  distribution,
  totalCompleted,
  avgPercentage,
}) => {
  const [hoveredBucket, setHoveredBucket] = useState<string | null>(null);

  // Order from lowest to highest score along standard histogram horizontal axis
  const buckets: BucketItem[] = [
    {
      id: 'below60',
      label: 'Below 60%',
      shortLabel: '<60%',
      count: distribution.rangeBelow60?.count ?? 0,
      percentage: distribution.rangeBelow60?.percentage ?? 0,
      rangeMin: 0,
      rangeMax: 59,
    },
    {
      id: '60to69',
      label: '60% – 69%',
      shortLabel: '60–69%',
      count: distribution.range60To69?.count ?? 0,
      percentage: distribution.range60To69?.percentage ?? 0,
      rangeMin: 60,
      rangeMax: 69,
    },
    {
      id: '70to79',
      label: '70% – 79%',
      shortLabel: '70–79%',
      count: distribution.range70To79?.count ?? 0,
      percentage: distribution.range70To79?.percentage ?? 0,
      rangeMin: 70,
      rangeMax: 79,
    },
    {
      id: '80to89',
      label: '80% – 89%',
      shortLabel: '80–89%',
      count: distribution.range80To89?.count ?? 0,
      percentage: distribution.range80To89?.percentage ?? 0,
      rangeMin: 80,
      rangeMax: 89,
    },
    {
      id: '90to100',
      label: '90% – 100%',
      shortLabel: '90–100%',
      count: distribution.range90To100?.count ?? 0,
      percentage: distribution.range90To100?.percentage ?? 0,
      rangeMin: 90,
      rangeMax: 100,
    },
  ];

  // Maximum count for histogram scaling
  const rawMax = Math.max(...buckets.map((b) => b.count), 0);
  const yMax = rawMax === 0 ? 5 : rawMax <= 4 ? 4 : Math.ceil(rawMax * 1.25);
  const yTicks = [0, Math.round(yMax * 0.5), yMax];

  // SVG dimensions
  const svgWidth = 520;
  const svgHeight = 180;
  const plotLeft = 40;
  const plotRight = 500;
  const plotTop = 20;
  const plotBottom = 145;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const colWidth = plotWidth / buckets.length;
  const barWidth = Math.min(54, colWidth * 0.68);

  return (
    <div className={styles.chartPanel}>
      <div className={styles.chartPanelHeader}>
        <div>
          <h3 className={styles.chartPanelTitle}>Score Distribution</h3>
          <p className={styles.chartPanelSubtitle}>
            Learner frequency across score percentiles ({totalCompleted} finalized)
          </p>
        </div>
        {avgPercentage !== undefined && totalCompleted > 0 && (
          <span className={`${styles.statusPill} ${styles.badgeBrand}`}>
            Cohort Avg: {avgPercentage}%
          </span>
        )}
      </div>

      <div className={styles.chartSvgWrapper}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className={styles.histogramSvg}
          role="img"
          aria-label="Score Distribution Histogram"
        >
          {/* Horizontal Hairline Gridlines */}
          {yTicks.map((tick) => {
            const yPos = plotBottom - (tick / yMax) * plotHeight;
            return (
              <g key={tick} className={styles.gridLineGroup}>
                <line
                  x1={plotLeft}
                  y1={yPos}
                  x2={plotRight}
                  y2={yPos}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                  className={tick === 0 ? styles.axisBaseline : styles.gridLine}
                />
                <text
                  x={plotLeft - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className={styles.axisTickText}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Vertical Columns */}
          {buckets.map((bucket, idx) => {
            const colCenterX = plotLeft + idx * colWidth + colWidth / 2;
            const barX = colCenterX - barWidth / 2;
            const barHeight =
              yMax > 0 && bucket.count > 0 ? (bucket.count / yMax) * plotHeight : 0;
            const barY = plotBottom - barHeight;
            const isHovered = hoveredBucket === bucket.id;
            const hasData = bucket.count > 0;

            return (
              <g
                key={bucket.id}
                className={styles.barGroup}
                onMouseEnter={() => setHoveredBucket(bucket.id)}
                onMouseLeave={() => setHoveredBucket(null)}
              >
                {/* Column background hover hit area */}
                <rect
                  x={plotLeft + idx * colWidth}
                  y={plotTop}
                  width={colWidth}
                  height={plotHeight}
                  fill="transparent"
                  className={styles.hoverTarget}
                />

                {/* Column Bar */}
                {hasData && (
                  <rect
                    x={barX}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    rx={3}
                    ry={3}
                    className={`${styles.histogramBar} ${
                      isHovered ? styles.histogramBarHover : ''
                    }`}
                  />
                )}

                {/* Bar Value Count above bar */}
                {hasData && (
                  <text
                    x={colCenterX}
                    y={barY - 6}
                    textAnchor="middle"
                    className={styles.barTopLabel}
                  >
                    {bucket.count}
                  </text>
                )}

                {/* X-Axis Bucket Label */}
                <text
                  x={colCenterX}
                  y={plotBottom + 20}
                  textAnchor="middle"
                  className={`${styles.xAxisLabel} ${isHovered ? styles.xAxisLabelHover : ''}`}
                >
                  {bucket.shortLabel}
                </text>
              </g>
            );
          })}

          {/* Average Reference Line (Benchmark indicator) */}
          {avgPercentage !== undefined && totalCompleted > 0 && (
            (() => {
              // Map avgPercentage (0-100) to horizontal x coordinate across plotWidth
              const avgX = plotLeft + (Math.min(100, Math.max(0, avgPercentage)) / 100) * plotWidth;
              return (
                <g className={styles.benchmarkGroup}>
                  <line
                    x1={avgX}
                    y1={plotTop - 6}
                    x2={avgX}
                    y2={plotBottom}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    className={styles.benchmarkLine}
                  />
                  <text
                    x={avgX}
                    y={plotTop - 10}
                    textAnchor="middle"
                    className={styles.benchmarkLabel}
                  >
                    Avg {avgPercentage}%
                  </text>
                </g>
              );
            })()
          )}
        </svg>
      </div>

      {/* Score Bands Telemetry Matrix */}
      <div className={styles.breakdownMatrix}>
        {buckets.map((b) => (
          <div
            key={b.id}
            className={`${styles.breakdownRow} ${hoveredBucket === b.id ? styles.breakdownRowActive : ''}`}
            onMouseEnter={() => setHoveredBucket(b.id)}
            onMouseLeave={() => setHoveredBucket(null)}
          >
            <div className={styles.breakdownLabelCol}>
              <span className={styles.breakdownLabel}>{b.label}</span>
            </div>
            <div className={styles.breakdownTrackCol}>
              <div className={styles.miniTrack}>
                <div
                  className={styles.miniFill}
                  style={{ width: `${Math.min(100, Math.max(0, b.percentage))}%` }}
                />
              </div>
            </div>
            <div className={styles.breakdownStatCol}>
              <span className={styles.breakdownCount}>{b.count}</span>
              <span className={styles.breakdownPct}>({b.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>

      {totalCompleted === 0 && (
        <div className={styles.emptyNotice}>
          No completed attempts recorded yet. Distribution will populate as submissions finalize.
        </div>
      )}
    </div>
  );
};
