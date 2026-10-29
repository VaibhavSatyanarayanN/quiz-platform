import type {
  AttemptQuestionResponse,
  QuestionSaveStatus,
} from '../types/attempt.types.ts';

export interface QuestionPaletteProps {
  questions: AttemptQuestionResponse[];
  currentIndex: number;
  answersMap: Record<string, string[]>;
  saveStatusMap?: Record<string, QuestionSaveStatus>;
  onSelectQuestion: (index: number) => void;
  disabled?: boolean;
}

export function QuestionPalette({
  questions,
  currentIndex,
  answersMap,
  saveStatusMap = {},
  onSelectQuestion,
  disabled = false,
}: QuestionPaletteProps) {
  const total = questions.length;
  const answeredCount = questions.filter((q) => {
    const selected = answersMap[q.id];
    return Array.isArray(selected) && selected.length > 0;
  }).length;
  const unansweredCount = Math.max(0, total - answeredCount);
  const errorCount = questions.filter(
    (q) => saveStatusMap[q.id] === 'error',
  ).length;
  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <aside className="question-palette" aria-label="Question navigator">
      <div className="palette-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h4 style={{ margin: 0 }}>Question Navigator</h4>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-600, #2563eb)' }}>
            {progressPercent}%
          </span>
        </div>

        <div
          className="quiz-progress-track"
          style={{ marginBottom: '10px', height: '6px' }}
          role="progressbar"
          aria-label="Attempt completion progress"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="quiz-progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="palette-summary" style={{ flexWrap: 'wrap' }}>
          <span className="summary-item answered-stat">
            <span className="dot dot-answered" /> {answeredCount} Answered
          </span>
          <span className="summary-item unanswered-stat">
            <span className="dot dot-unanswered" /> {unansweredCount} Left
          </span>
          {errorCount > 0 && (
            <span
              className="summary-item"
              style={{ color: 'var(--danger-accent, #dc2626)' }}
            >
              ⚠️ {errorCount} Unsaved
            </span>
          )}
        </div>
      </div>

      <div className="palette-grid" role="navigation" aria-label="Jump to question">
        {questions.map((question, index) => {
          const isCurrent = index === currentIndex;
          const isAnswered = (answersMap[question.id] || []).length > 0;
          const saveStatus = saveStatusMap[question.id] ?? 'idle';
          const hasError = saveStatus === 'error';
          const isSaving = saveStatus === 'saving';

          let btnClass = 'palette-btn';
          if (isCurrent) btnClass += ' palette-btn-current';
          if (isAnswered && !hasError) btnClass += ' palette-btn-answered';

          const statusText = hasError
            ? 'Save failed'
            : isSaving
              ? 'Saving'
              : isAnswered
                ? 'Answered'
                : 'Unanswered';

          return (
            <button
              key={question.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectQuestion(index)}
              className={btnClass}
              style={
                hasError
                  ? {
                      borderColor: 'var(--danger-accent, #dc2626)',
                      backgroundColor: 'var(--danger-bg, #fef2f2)',
                      color: 'var(--danger-text, #b91c1c)',
                    }
                  : undefined
              }
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Question ${index + 1}: ${statusText}${isCurrent ? ', Current question' : ''}`}
              title={`Question ${index + 1}: ${statusText}`}
              data-question-index={index}
              data-answered={isAnswered ? 'true' : 'false'}
              data-current={isCurrent ? 'true' : 'false'}
              data-save-status={saveStatus}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className="palette-legend">
        <div className="legend-item">
          <span className="legend-box legend-answered" />
          <span>Answered</span>
        </div>
        <div className="legend-item">
          <span className="legend-box legend-current" />
          <span>Current</span>
        </div>
        <div className="legend-item">
          <span className="legend-box legend-unanswered" />
          <span>Unanswered</span>
        </div>
      </div>
    </aside>
  );
}
