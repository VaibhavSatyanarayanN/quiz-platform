import React from 'react';
import type { QuestionAnalytics } from '../types/analytics.types.js';
import { Card, CardHeader, CardTitle, CardBody } from '../../../components/ui/Card/Card.js';
import { Badge } from '../../../components/ui/Badge/Badge.js';
import styles from './AnalyticsComponents.module.css';

interface Props {
  questions: QuestionAnalytics[];
}

export const QuestionAnalyticsList: React.FC<Props> = ({ questions }) => {
  return (
    <div className={styles.questionsContainer}>
      <div className={styles.sectionHeader}>
        <h2>Question Performance & Option Selection Breakdown</h2>
        <p>Analyze how takers answered each question and how choices were distributed.</p>
      </div>

      {questions.length === 0 ? (
        <Card variant="outlined">
          <CardBody>
            <p className={styles.emptyNotice}>No questions in this version.</p>
          </CardBody>
        </Card>
      ) : (
        questions.map((q) => {
          const isMultiple = q.questionType === 'multiple_choice';
          return (
            <Card key={q.questionId} variant="outlined" className={styles.questionCard}>
              <CardHeader className={styles.questionCardHeader}>
                <div>
                  <div className={styles.questionTitleRow}>
                    <span className={styles.questionNumber}>Q{q.order}.</span>
                    <CardTitle className={styles.questionText}>{q.questionText}</CardTitle>
                  </div>
                  <div className={styles.questionMeta}>
                    <Badge variant="neutral">{q.questionType.replace('_', ' ')}</Badge>
                    <Badge variant="brand">{q.marks} mark{q.marks > 1 ? 's' : ''}</Badge>
                    {q.difficultyEstimate && (
                      <Badge
                        variant={
                          q.difficultyEstimate === 'EASY'
                            ? 'success'
                            : q.difficultyEstimate === 'HARD'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {q.difficultyEstimate} ({q.observedAccuracy ?? q.correctPercentage}% accuracy)
                      </Badge>
                    )}
                    {isMultiple && (
                      <span className={styles.multipleNote}>
                        (Multiple selections allowed per attempt)
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.questionStatsSummary}>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>Correct</span>
                    <span className={`${styles.statValue} ${styles.textSuccess}`}>
                      {q.correctPercentage}% ({q.correctCount})
                    </span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>Wrong</span>
                    <span className={`${styles.statValue} ${styles.textDanger}`}>
                      {q.wrongPercentage}% ({q.wrongCount})
                    </span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>Unanswered</span>
                    <span className={`${styles.statValue} ${styles.textMuted}`}>
                      {q.unansweredPercentage}% ({q.unansweredCount})
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <div className={styles.optionsSection}>
                  <h4 className={styles.optionsTitle}>Option Distribution</h4>
                  <div className={styles.optionsList}>
                    {q.options.map((opt) => (
                      <div key={opt.optionId} className={styles.optionRow}>
                        <div className={styles.optionInfo}>
                          <span className={styles.optionText}>{opt.optionText}</span>
                          {opt.isCorrect && (
                            <Badge variant="success" size="sm" className={styles.correctBadge}>
                              ✓ Correct Option
                            </Badge>
                          )}
                        </div>
                        <div className={styles.optionTrack}>
                          <div
                            className={`${styles.optionFill} ${
                              opt.isCorrect ? styles.optionFillCorrect : styles.optionFillNeutral
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, opt.selectionPercentage))}%` }}
                          />
                        </div>
                        <div className={styles.optionStats}>
                          {opt.selectionCount} choice{opt.selectionCount !== 1 ? 's' : ''} ({opt.selectionPercentage}%)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
};
