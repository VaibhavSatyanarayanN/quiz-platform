import type { AttemptQuestionResponse } from '../types/attempt.types';

interface QuestionPaletteProps {
  questions: AttemptQuestionResponse[];
  currentIndex: number;
  answersMap: Record<string, string[]>;
  onSelectQuestion: (index: number) => void;
}

export function QuestionPalette({
  questions,
  currentIndex,
  answersMap,
  onSelectQuestion,
}: QuestionPaletteProps) {
  const total = questions.length;
  const answeredCount = questions.filter((q) => {
    const selected = answersMap[q.id];
    return selected && selected.length > 0;
  }).length;
  const unansweredCount = total - answeredCount;

  return (
    <aside className="question-palette">
      <div className="palette-header">
        <h4>Question Navigator</h4>
        <div className="palette-summary">
          <span className="summary-item answered-stat">
            <span className="dot dot-answered" /> {answeredCount} Answered
          </span>
          <span className="summary-item unanswered-stat">
            <span className="dot dot-unanswered" /> {unansweredCount} Left
          </span>
        </div>
      </div>

      <div className="palette-grid">
        {questions.map((question, index) => {
          const isCurrent = index === currentIndex;
          const isAnswered = (answersMap[question.id] || []).length > 0;

          let btnClass = 'palette-btn';
          if (isCurrent) btnClass += ' palette-btn-current';
          if (isAnswered) btnClass += ' palette-btn-answered';

          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelectQuestion(index)}
              className={btnClass}
              title={`Question ${index + 1}: ${isAnswered ? 'Answered' : 'Unanswered'}`}
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
