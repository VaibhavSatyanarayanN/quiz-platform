import { useEffect } from 'react';
import type {
  AttemptQuestionResponse,
  QuestionSaveStatus,
} from '../types/attempt.types.ts';
import { QuestionType } from '../../quizzes/types/quiz.types.ts';
import { sanitizeLearnerQuestion } from '../utils/attempt-persistence.ts';

export interface QuestionCardProps {
  question: AttemptQuestionResponse;
  questionNumber: number;
  totalQuestions: number;
  selectedOptionIds: string[];
  onOptionSelect: (optionId: string) => void;
  saveStatus?: QuestionSaveStatus;
  saveError?: string | null;
  onRetrySave?: () => void;
  disabled?: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionIds,
  onOptionSelect,
  saveStatus = 'idle',
  saveError = null,
  onRetrySave,
  disabled = false,
}: QuestionCardProps) {
  const safeQuestion = sanitizeLearnerQuestion(question);
  const isMultiple = safeQuestion.questionType === QuestionType.MULTIPLE_CHOICE;

  useEffect(() => {
    if (disabled) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const key = e.key.toUpperCase();
      let index = -1;

      if (e.key >= '1' && e.key <= '9') {
        index = parseInt(e.key, 10) - 1;
      } else if (key >= 'A' && key <= 'Z') {
        index = key.charCodeAt(0) - 65;
      }

      if (index >= 0 && index < safeQuestion.options.length) {
        e.preventDefault();
        onOptionSelect(safeQuestion.options[index].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safeQuestion.options, onOptionSelect, disabled]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case QuestionType.MULTIPLE_CHOICE:
        return 'Multiple Choice';
      case QuestionType.TRUE_FALSE:
        return 'True / False';
      default:
        return 'Single Choice';
    }
  };

  const getOptionLetter = (index: number) => {
    return String.fromCharCode(65 + index);
  };

  return (
    <article
      className="question-card"
      aria-labelledby={`question-${safeQuestion.id}-title`}
      data-question-id={safeQuestion.id}
      data-question-type={safeQuestion.questionType}
    >
      <div className="question-card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="question-meta">
          <span className="question-number-badge">
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className="badge badge-secondary badge-sm">
            {getTypeLabel(safeQuestion.questionType)}
          </span>
          <span className="badge badge-primary badge-sm">
            {safeQuestion.marks} mark{safeQuestion.marks > 1 ? 's' : ''}
          </span>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          aria-live="polite"
          data-save-status={saveStatus}
        >
          {saveStatus === 'saving' && (
            <span className="saving-pill" role="status">
              <span className="saving-spinner" aria-hidden="true" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="saved-pill" role="status">
              <svg className="saved-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                  clipRule="evenodd"
                />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="badge badge-danger badge-sm" role="alert">
              Save failed
            </span>
          )}
          {saveStatus === 'error' && onRetrySave && !disabled && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onRetrySave}
              aria-label={`Retry saving answer for question ${questionNumber}`}
            >
              Retry Save
            </button>
          )}
        </div>
      </div>

      <div className="question-prompt">
        <h2
          id={`question-${safeQuestion.id}-title`}
          style={{ fontSize: 'inherit', fontWeight: 'inherit', margin: 0 }}
        >
          {safeQuestion.text}
        </h2>
      </div>

      <div className="question-hint">
        <svg className="hint-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v2.25a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75h-1.5Z"
            clipRule="evenodd"
          />
        </svg>
        <span>
          {isMultiple
            ? 'Select all options that apply. Click a selected option again to remove it.'
            : 'Select one option. You can change your choice before submitting.'}
        </span>
      </div>

      {saveStatus === 'error' && saveError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            backgroundColor: 'var(--danger-bg, #fef2f2)',
            border: '1px solid var(--danger-border, #fecaca)',
            color: 'var(--danger-text, #b91c1c)',
            fontSize: '0.875rem',
          }}
        >
          <span>
            <strong>Answer not yet saved:</strong> {saveError} Your selection is preserved locally.
          </span>
          {onRetrySave && !disabled && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onRetrySave}
            >
              Retry Now
            </button>
          )}
        </div>
      )}

      <div
        className="options-list"
        role={isMultiple ? 'group' : 'radiogroup'}
        aria-label={`Answer options for question ${questionNumber}`}
      >
        {safeQuestion.options.map((option, index) => {
          const isSelected = selectedOptionIds.includes(option.id);
          const letter = getOptionLetter(index);

          return (
            <div
              key={option.id}
              onClick={() => {
                if (!disabled) {
                  onOptionSelect(option.id);
                }
              }}
              className={`option-row ${isSelected ? 'option-selected' : ''}`}
              style={
                disabled
                  ? { opacity: 0.65, cursor: 'not-allowed' }
                  : undefined
              }
              role={isMultiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              aria-disabled={disabled}
              aria-label={`Option ${letter}: ${option.text}`}
              data-option-id={option.id}
              data-selected={isSelected ? 'true' : 'false'}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onOptionSelect(option.id);
                }
              }}
            >
              <div className="option-control">
                <div
                  className={`custom-control-box ${
                    isMultiple ? 'control-checkbox' : 'control-radio'
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="control-check-icon"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="option-letter">{letter}</span>
              </div>

              <div className="option-content">
                <span className="option-text">{option.text}</span>
              </div>

              <div className="option-key-hint" aria-hidden="true">
                <kbd>{index + 1}</kbd>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
