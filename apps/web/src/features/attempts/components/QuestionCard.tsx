import { useEffect } from 'react';
import type { AttemptQuestionResponse } from '../types/attempt.types';
import { QuestionType } from '@/features/quizzes/types/quiz.types';
import { Badge } from '@/components/ui/Badge/Badge';
import styles from './QuestionCard.module.css';

interface QuestionCardProps {
  question: AttemptQuestionResponse;
  questionNumber: number;
  totalQuestions: number;
  selectedOptionIds: string[];
  onOptionSelect: (optionId: string) => void;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionIds,
  onOptionSelect,
}: QuestionCardProps) {
  const isMultiple = question.questionType === QuestionType.MULTIPLE_CHOICE;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      let index = -1;

      if (e.key >= '1' && e.key <= '9') {
        index = parseInt(e.key, 10) - 1;
      } else if (key >= 'A' && key <= 'Z') {
        index = key.charCodeAt(0) - 65;
      }

      if (index >= 0 && index < question.options.length) {
        e.preventDefault();
        onOptionSelect(question.options[index].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [question.options, onOptionSelect]);

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
    <article className={styles.card} aria-labelledby={`question-${question.id}-title`}>
      <div className={styles.header}>
        <div className={styles.meta}>
          <span className={styles.numberBadge}>
            Question {questionNumber} of {totalQuestions}
          </span>
          <Badge variant="neutral" size="sm">
            {getTypeLabel(question.questionType)}
          </Badge>
          <Badge variant="brand" size="sm">
            {question.marks} mark{question.marks > 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      <div className={styles.prompt}>
        <h2 id={`question-${question.id}-title`} style={{ fontSize: 'inherit', fontWeight: 'inherit' }}>
          {question.text}
        </h2>
      </div>

      {isMultiple && (
        <div className={styles.hint}>
          <svg className={styles.hintIcon} viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v2.25a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75h-1.5Z" clipRule="evenodd" />
          </svg>
          Select all options that apply. You can also use keys 1, 2, 3... or A, B, C...
        </div>
      )}

      <div className={styles.optionsList} role="group" aria-label="Answer options">
        {question.options.map((option, index) => {
          const isSelected = selectedOptionIds.includes(option.id);
          const letter = getOptionLetter(index);

          return (
            <div
              key={option.id}
              onClick={() => onOptionSelect(option.id)}
              className={`${styles.optionRow} ${isSelected ? styles.optionSelected : ''}`}
              role={isMultiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onOptionSelect(option.id);
                }
              }}
            >
              <div className={styles.optionControl}>
                <div
                  className={`
                    ${styles.customControlBox}
                    ${isMultiple ? styles.controlCheckbox : styles.controlRadio}
                  `}
                >
                  {isSelected && (
                    <svg className={styles.controlCheckIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={styles.optionLetter}>{letter}</span>
              </div>

              <div className={styles.optionContent}>
                <span className={styles.optionText}>{option.text}</span>
              </div>

              <div className={styles.optionKeyHint} aria-hidden="true">
                <kbd>{index + 1}</kbd>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
