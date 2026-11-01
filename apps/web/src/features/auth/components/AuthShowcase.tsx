import React from 'react';
import { Link } from 'react-router';
import styles from '../styles/Auth.module.css';

interface AuthShowcaseProps {
  headline: string;
  subtext: string;
}

export const AuthShowcase: React.FC<AuthShowcaseProps> = ({
  headline,
  subtext,
}) => {
  return (
    <div className={styles.showcaseColumn}>
      <div className={styles.showcaseInner}>
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <Link to="/" className={styles.brandLogo}>
            <div className={styles.logoIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 19 21 12 17 5 21 12 2" />
              </svg>
            </div>
            <span className={styles.brandTitle}>QuizPlatform</span>
          </Link>
          <span className={styles.brandBadge}>Assessment Workbench</span>
        </div>

        {/* Main Pitch & Live Assessment Artifact */}
        <div className={styles.showcaseBody}>
          <div className={styles.headlineGroup}>
            <h1 className={styles.showcaseHeadline}>{headline}</h1>
            <p className={styles.showcaseSubtext}>{subtext}</p>
          </div>

          {/* Authentic Quiz Interface Fragment */}
          <div className={styles.artifactCard} aria-label="Assessment Preview">
            <div className={styles.artifactHeader}>
              <div className={styles.artifactMeta}>
                <span className={styles.artifactTitle}>Distributed Consensus & State Machines</span>
                <span className={styles.artifactTag}>v2 · Published</span>
              </div>
              <div className={styles.artifactTimer}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>08:45</span>
              </div>
            </div>

            <div className={styles.artifactQuestionBar}>
              <span className={styles.questionIndex}>Question 4 of 12</span>
              <span className={styles.questionMarks}>2 marks</span>
            </div>

            <p className={styles.artifactQuestion}>
              In the Raft consensus protocol, when does a leader safely commit an entry to the state machine?
            </p>

            <div className={styles.artifactOptionsList} role="list">
              <div className={`${styles.artifactOptionItem} ${styles.artifactOptionActive}`} role="listitem">
                <div className={styles.optionIndicator} aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className={styles.optionLabel}>Replicated on a majority of cluster nodes from current term</span>
              </div>
              <div className={styles.artifactOptionItem} role="listitem">
                <div className={styles.optionIndicator} aria-hidden="true">
                  <span>B</span>
                </div>
                <span className={styles.optionLabel}>Written to local write-ahead log without remote heartbeats</span>
              </div>
            </div>

            <div className={styles.artifactFooter}>
              <div className={styles.artifactTelemetry}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>PostgreSQL autosave confirmed</span>
              </div>
              <span className={styles.artifactIntegrity}>Version lock active</span>
            </div>
          </div>

          {/* System Capabilities Specification */}
          <div className={styles.specSection}>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Authoring</span>
              <span className={styles.specVal}>Multi-agent AI question generation with schema verification & versioning</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Delivery</span>
              <span className={styles.specVal}>Server-enforced timer countdowns, Redis state sync, and zero answer leaks</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Grading</span>
              <span className={styles.specVal}>Deterministic grading, immutable attempt snapshots, and cohort analytics</span>
            </div>
          </div>
        </div>

        {/* Footer Meta */}
        <div className={styles.showcaseFooter}>
          <span>QuizPlatform Enterprise · Controlled Beta</span>
        </div>
      </div>
    </div>
  );
};
