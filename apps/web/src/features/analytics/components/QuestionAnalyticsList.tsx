import React, { useState, useMemo } from 'react';
import type { QuestionAnalytics } from '../types/analytics.types.js';
import styles from './AnalyticsComponents.module.css';

interface Props {
  questions: QuestionAnalytics[];
}

type SortMode = 'order' | 'hardest' | 'easiest';

function formatQuestionType(typeStr: string): string {
  if (!typeStr) return 'Question';
  return typeStr.replace(/_/g, ' ');
}

export const QuestionAnalyticsList: React.FC<Props> = ({ questions }) => {
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('ALL');

  // Compute summary stats
  const totalQuestions = questions.length;
  const avgAccuracy =
    totalQuestions > 0
      ? Math.round(
          questions.reduce((acc, q) => acc + (q.observedAccuracy ?? q.correctPercentage ?? 0), 0) /
            totalQuestions,
        )
      : 0;

  // Find hardest question
  const hardestQuestion = useMemo(() => {
    if (questions.length === 0) return null;
    return [...questions].sort(
      (a, b) =>
        (a.observedAccuracy ?? a.correctPercentage ?? 0) -
        (b.observedAccuracy ?? b.correctPercentage ?? 0),
    )[0];
  }, [questions]);

  // Sort and filter questions
  const displayedQuestions = useMemo(() => {
    let result = [...questions];

    if (filterDifficulty !== 'ALL') {
      result = result.filter((q) => q.difficultyEstimate === filterDifficulty);
    }

    if (sortMode === 'hardest') {
      result.sort(
        (a, b) =>
          (a.observedAccuracy ?? a.correctPercentage ?? 0) -
          (b.observedAccuracy ?? b.correctPercentage ?? 0),
      );
    } else if (sortMode === 'easiest') {
      result.sort(
        (a, b) =>
          (b.observedAccuracy ?? b.correctPercentage ?? 0) -
          (a.observedAccuracy ?? a.correctPercentage ?? 0),
      );
    } else {
      result.sort((a, b) => a.order - b.order);
    }

    return result;
  }, [questions, sortMode, filterDifficulty]);

  return (
    <div className={styles.questionsContainer}>
      {/* Section Header */}
      <div className={styles.questionSectionHeader}>
        <div className={styles.questionHeaderInfo}>
          <div className={styles.headerTagRow}>
            <span className={styles.sectionSuperLabel}>Item Analysis</span>
            <span className={`${styles.statusPill} ${styles.badgeNeutral}`}>
              {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'}
            </span>
            <span className={`${styles.statusPill} ${styles.badgeBrand}`}>
              Avg Accuracy: {avgAccuracy}%
            </span>
            {hardestQuestion && (
              <span className={`${styles.statusPill} ${styles.badgeDanger}`}>
                Hardest: Q{hardestQuestion.order} (
                {hardestQuestion.observedAccuracy ?? hardestQuestion.correctPercentage}%)
              </span>
            )}
          </div>
          <h2 className={styles.questionSectionTitle}>
            Question Accuracy & Distractor Analysis Matrix
          </h2>
          <p className={styles.questionSectionSubtitle}>
            Evaluate learner accuracy per question, identify difficult concepts, and inspect option
            selection frequencies to detect misleading distractors.
          </p>
        </div>

        {/* Filter & Sort Controls */}
        <div className={styles.questionControls}>
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Sort:</span>
            <button
              type="button"
              className={`${styles.filterButton} ${sortMode === 'order' ? styles.filterButtonActive : ''}`}
              onClick={() => setSortMode('order')}
            >
              Sequence
            </button>
            <button
              type="button"
              className={`${styles.filterButton} ${sortMode === 'hardest' ? styles.filterButtonActive : ''}`}
              onClick={() => setSortMode('hardest')}
            >
              Hardest First
            </button>
            <button
              type="button"
              className={`${styles.filterButton} ${sortMode === 'easiest' ? styles.filterButtonActive : ''}`}
              onClick={() => setSortMode('easiest')}
            >
              Easiest First
            </button>
          </div>

          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Difficulty:</span>
            <button
              type="button"
              className={`${styles.filterButton} ${filterDifficulty === 'ALL' ? styles.filterButtonActive : ''}`}
              onClick={() => setFilterDifficulty('ALL')}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterButton} ${filterDifficulty === 'HARD' ? styles.filterButtonActive : ''}`}
              onClick={() => setFilterDifficulty('HARD')}
            >
              Hard
            </button>
            <button
              type="button"
              className={`${styles.filterButton} ${filterDifficulty === 'MEDIUM' ? styles.filterButtonActive : ''}`}
              onClick={() => setFilterDifficulty('MEDIUM')}
            >
              Medium
            </button>
            <button
              type="button"
              className={`${styles.filterButton} ${filterDifficulty === 'EASY' ? styles.filterButtonActive : ''}`}
              onClick={() => setFilterDifficulty('EASY')}
            >
              Easy
            </button>
          </div>
        </div>
      </div>

      {/* Accuracy Horizon Chart (Horizontal Bar Comparison Overview) */}
      {questions.length > 0 && (
        <div className={styles.horizonPanel}>
          <div className={styles.horizonHeader}>
            <span className={styles.horizonTitle}>Question Accuracy Horizon</span>
            <span className={styles.horizonBenchmarkText}>
              Benchmark dashed line: {avgAccuracy}% average
            </span>
          </div>
          <div className={styles.horizonList}>
            {questions.map((q) => {
              const acc = q.observedAccuracy ?? q.correctPercentage ?? 0;
              const barColorClass =
                acc >= 75
                  ? styles.horizonFillSuccess
                  : acc >= 50
                  ? styles.horizonFillWarning
                  : styles.horizonFillDanger;

              return (
                <div key={q.questionId} className={styles.horizonRow}>
                  <span className={styles.horizonQNumber}>Q{q.order}</span>
                  <div className={styles.horizonTrack}>
                    <div
                      className={`${styles.horizonFill} ${barColorClass}`}
                      style={{ width: `${Math.min(100, Math.max(0, acc))}%` }}
                    />
                    {/* Benchmark tick mark */}
                    <div
                      className={styles.horizonBenchmarkMarker}
                      style={{ left: `${avgAccuracy}%` }}
                      title={`Cohort Average: ${avgAccuracy}%`}
                    />
                  </div>
                  <span className={styles.horizonValue}>{acc}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Question Cards List */}
      {displayedQuestions.length === 0 ? (
        <div className={styles.emptyNotice}>
          No questions match the current filter selection.
        </div>
      ) : (
        <div className={styles.questionsGrid}>
          {displayedQuestions.map((q) => {
            const acc = q.observedAccuracy ?? q.correctPercentage ?? 0;
            const diffClass =
              q.difficultyEstimate === 'EASY'
                ? styles.badgeSuccess
                : q.difficultyEstimate === 'HARD'
                ? styles.badgeDanger
                : styles.badgeWarning;

            const isMultiple = q.questionType === 'multiple_choice';

            return (
              <div key={q.questionId} className={styles.questionCard}>
                {/* Question Card Header */}
                <div className={styles.questionCardHeader}>
                  <div className={styles.questionTitleBlock}>
                    <div className={styles.qNumberPill}>Q{q.order}</div>
                    <div className={styles.questionPromptBlock}>
                      <h4 className={styles.questionPromptText}>{q.questionText}</h4>
                      <div className={styles.questionMetaTags}>
                        <span className={`${styles.statusPill} ${styles.badgeNeutral}`}>
                          {formatQuestionType(q.questionType)}
                        </span>
                        <span className={`${styles.statusPill} ${styles.badgeBrand}`}>
                          {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                        </span>
                        {q.difficultyEstimate && (
                          <span className={`${styles.statusPill} ${diffClass}`}>
                            {q.difficultyEstimate} ({acc}% accuracy)
                          </span>
                        )}
                        {isMultiple && (
                          <span className={styles.multipleNotePill}>
                            Multi-select allowed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className={styles.questionStatStrip}>
                    <div className={styles.statChip}>
                      <span className={styles.statChipLabel}>Correct</span>
                      <span className={`${styles.statChipValue} ${styles.textSuccess}`}>
                        {q.correctPercentage}% ({q.correctCount})
                      </span>
                    </div>
                    <div className={styles.statChip}>
                      <span className={styles.statChipLabel}>Wrong</span>
                      <span className={`${styles.statChipValue} ${styles.textDanger}`}>
                        {q.wrongPercentage}% ({q.wrongCount})
                      </span>
                    </div>
                    <div className={styles.statChip}>
                      <span className={styles.statChipLabel}>Skipped</span>
                      <span className={`${styles.statChipValue} ${styles.textMuted}`}>
                        {q.unansweredPercentage}% ({q.unansweredCount})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Option Choice Distribution Breakdown */}
                <div className={styles.optionsBlock}>
                  <div className={styles.optionsHeader}>
                    <span className={styles.optionsTitle}>Option Selection Distribution</span>
                    <span className={styles.optionsMeta}>
                      Taker selections across {q.options.length} choices
                    </span>
                  </div>

                  <div className={styles.optionsList}>
                    {q.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <div
                          key={opt.optionId}
                          className={`${styles.optionItem} ${
                            opt.isCorrect ? styles.optionItemCorrect : ''
                          }`}
                        >
                          <div className={styles.optionLeft}>
                            <span
                              className={`${styles.optionLetter} ${
                                opt.isCorrect ? styles.optionLetterCorrect : ''
                              }`}
                            >
                              {letter}
                            </span>
                            <span className={styles.optionPrompt}>{opt.optionText}</span>
                            {opt.isCorrect && (
                              <span className={styles.correctIndicatorPill}>
                                ✓ Correct Option
                              </span>
                            )}
                          </div>

                          <div className={styles.optionBarCol}>
                            <div className={styles.optionTrack}>
                              <div
                                className={`${styles.optionFill} ${
                                  opt.isCorrect
                                    ? styles.optionFillCorrect
                                    : styles.optionFillNeutral
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, opt.selectionPercentage))}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className={styles.optionStatsCol}>
                            <span className={styles.optionCountText}>
                              {opt.selectionCount} choice{opt.selectionCount !== 1 ? 's' : ''}
                            </span>
                            <span className={styles.optionPctText}>
                              ({opt.selectionPercentage}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
