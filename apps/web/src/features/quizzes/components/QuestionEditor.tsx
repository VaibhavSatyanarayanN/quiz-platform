import React, { useState } from 'react';
import type {
  CreateQuestionRequest,
  CreateOptionRequest,
} from '../types/quiz.types';
import { QuestionType } from '../types/quiz.types';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import styles from './QuestionEditor.module.css';

interface QuestionEditorProps {
  questions: CreateQuestionRequest[];
  onChange: (questions: CreateQuestionRequest[]) => void;
  onSave?: () => void;
  isSaving?: boolean;
  disabled?: boolean;
}

export function QuestionEditor({
  questions,
  onChange,
  onSave,
  isSaving = false,
  disabled = false,
}: QuestionEditorProps) {
  const [collapsedMap, setCollapsedMap] = useState<Record<number, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }
    const updated = [...questions];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, removed);
    onChange(updated);
    setDraggedIndex(null);
  };

  const toggleCollapse = (idx: number) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleCollapseAll = () => {
    const all: Record<number, boolean> = {};
    questions.forEach((_, idx) => {
      all[idx] = true;
    });
    setCollapsedMap(all);
  };

  const handleExpandAll = () => {
    setCollapsedMap({});
  };

  const handleAddQuestion = (type: QuestionType = QuestionType.SINGLE_CHOICE) => {
    const defaultOptions: CreateOptionRequest[] =
      type === QuestionType.TRUE_FALSE
        ? [
            { text: 'True', isCorrect: true },
            { text: 'False', isCorrect: false },
          ]
        : [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
          ];

    const newQuestion: CreateQuestionRequest = {
      text: '',
      questionType: type,
      marks: 1,
      options: defaultOptions,
    };
    onChange([...questions, newQuestion]);
  };

  const handleDuplicateQuestion = (qIndex: number) => {
    const q = questions[qIndex];
    const duplicated: CreateQuestionRequest = {
      text: q.text ? `${q.text} (Copy)` : '',
      questionType: q.questionType,
      marks: q.marks,
      options: q.options.map((opt) => ({
        text: opt.text,
        isCorrect: opt.isCorrect,
      })),
    };
    const updated = [...questions];
    updated.splice(qIndex + 1, 0, duplicated);
    onChange(updated);
  };

  const handleRemoveQuestion = (qIndex: number) => {
    const updated = questions.filter((_, idx) => idx !== qIndex);
    onChange(updated);
    setConfirmRemoveIndex(null);
  };

  const handleMoveQuestion = (fromIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(targetIndex, 0, moved);
    onChange(updated);
  };

  const handleQuestionChange = <K extends keyof CreateQuestionRequest>(
    qIndex: number,
    field: K,
    value: CreateQuestionRequest[K],
  ) => {
    const updated = [...questions];
    updated[qIndex] = {
      ...updated[qIndex],
      [field]: value,
    };
    onChange(updated);
  };

  const handleTypeChange = (qIndex: number, newType: QuestionType) => {
    const q = questions[qIndex];
    if (q.questionType === newType) return;

    let updatedOptions = [...q.options];
    if (newType === QuestionType.TRUE_FALSE) {
      updatedOptions = [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ];
    } else if (q.questionType === QuestionType.TRUE_FALSE) {
      updatedOptions = [
        { text: 'Option A', isCorrect: true },
        { text: 'Option B', isCorrect: false },
        { text: 'Option C', isCorrect: false },
        { text: 'Option D', isCorrect: false },
      ];
    } else if (newType === QuestionType.SINGLE_CHOICE) {
      let foundFirst = false;
      updatedOptions = updatedOptions.map((opt) => {
        if (opt.isCorrect && !foundFirst) {
          foundFirst = true;
          return opt;
        }
        return { ...opt, isCorrect: false };
      });
      if (!foundFirst && updatedOptions.length > 0) {
        updatedOptions[0].isCorrect = true;
      }
    }

    const updated = [...questions];
    updated[qIndex] = {
      ...q,
      questionType: newType,
      options: updatedOptions,
    };
    onChange(updated);
  };

  const handleAddOption = (qIndex: number) => {
    const q = questions[qIndex];
    if (q.questionType === QuestionType.TRUE_FALSE) return;
    if (q.options.length >= 8) return;

    const newOption: CreateOptionRequest = {
      text: '',
      isCorrect: false,
    };
    const updated = [...questions];
    updated[qIndex] = {
      ...q,
      options: [...q.options, newOption],
    };
    onChange(updated);
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const q = questions[qIndex];
    if (q.questionType === QuestionType.TRUE_FALSE) return;
    if (q.options.length <= 2) return;

    let updatedOptions = q.options.filter((_, idx) => idx !== optIndex);
    const hasCorrect = updatedOptions.some((opt) => opt.isCorrect);
    if (!hasCorrect && updatedOptions.length > 0) {
      updatedOptions = updatedOptions.map((opt, idx) => ({
        ...opt,
        isCorrect: idx === 0,
      }));
    }

    const updated = [...questions];
    updated[qIndex] = {
      ...q,
      options: updatedOptions,
    };
    onChange(updated);
  };

  const handleOptionTextChange = (
    qIndex: number,
    optIndex: number,
    text: string,
  ) => {
    const q = questions[qIndex];
    const updatedOptions = [...q.options];
    updatedOptions[optIndex] = {
      ...updatedOptions[optIndex],
      text,
    };
    const updated = [...questions];
    updated[qIndex] = {
      ...q,
      options: updatedOptions,
    };
    onChange(updated);
  };

  const handleOptionCorrectToggle = (qIndex: number, optIndex: number) => {
    if (disabled) return;
    const q = questions[qIndex];
    let updatedOptions = [...q.options];

    if (q.questionType === QuestionType.MULTIPLE_CHOICE) {
      updatedOptions[optIndex] = {
        ...updatedOptions[optIndex],
        isCorrect: !updatedOptions[optIndex].isCorrect,
      };
    } else {
      updatedOptions = updatedOptions.map((opt, idx) => ({
        ...opt,
        isCorrect: idx === optIndex,
      }));
    }

    const updated = [...questions];
    updated[qIndex] = {
      ...q,
      options: updatedOptions,
    };
    onChange(updated);
  };

  const getQuestionValidationStatus = (q: CreateQuestionRequest) => {
    if (!q.text.trim()) return { valid: false, message: 'Question prompt is empty' };
    if (q.options.length < 2) return { valid: false, message: 'Needs at least 2 options' };
    const correctCount = q.options.filter((o) => o.isCorrect).length;

    if (q.questionType === QuestionType.SINGLE_CHOICE || q.questionType === QuestionType.TRUE_FALSE) {
      if (correctCount !== 1) {
        return { valid: false, message: 'Must mark exactly 1 correct option' };
      }
    } else if (q.questionType === QuestionType.MULTIPLE_CHOICE) {
      if (correctCount < 1) {
        return { valid: false, message: 'Must mark at least 1 correct option' };
      }
    }

    const hasEmptyOpt = q.options.some((o) => !o.text.trim());
    if (hasEmptyOpt) return { valid: false, message: 'Some option texts are empty' };

    return { valid: true, message: 'Ready' };
  };

  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);

  return (
    <div className={styles.editorContainer}>
      {/* Editor Header Toolbar */}
      <div className={styles.headerBar}>
        <div className={styles.headerStats}>
          <h3 className={styles.headerTitle}>Questions ({questions.length})</h3>
          <Badge variant="neutral" size="sm">
            Total: {totalMarks} Marks
          </Badge>
        </div>

        <div className={styles.headerActions}>
          {questions.length > 1 && (
            <div className={styles.actionGroup}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExpandAll}
                title="Expand all questions"
              >
                Expand All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCollapseAll}
                title="Collapse all questions"
              >
                Collapse All
              </Button>
            </div>
          )}

          <div className={styles.actionGroup}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddQuestion(QuestionType.SINGLE_CHOICE)}
              disabled={disabled}
            >
              Add Question
            </Button>
            {onSave && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onSave}
                disabled={disabled || isSaving}
                isLoading={isSaving}
              >
                Save Draft Questions
              </Button>
            )}
          </div>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className={styles.emptyStateCard}>
          <h3 className={styles.emptyStateTitle}>No questions in this draft version</h3>
          <p className={styles.emptyStateText}>
            Add your first question manually or use AI generation to draft questions directly from topics or documents.
          </p>
          <div className={styles.emptyStateActions}>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleAddQuestion(QuestionType.SINGLE_CHOICE)}
              disabled={disabled}
            >
              Add Single Choice
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddQuestion(QuestionType.MULTIPLE_CHOICE)}
              disabled={disabled}
            >
              Add Multiple Choice
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddQuestion(QuestionType.TRUE_FALSE)}
              disabled={disabled}
            >
              Add True/False
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.questionsList}>
          {questions.map((question, qIdx) => {
            const isCollapsed = Boolean(collapsedMap[qIdx]);
            const validation = getQuestionValidationStatus(question);

            return (
              <div
                key={question.id || `q-${qIdx}`}
                draggable={!disabled}
                onDragStart={(e) => handleDragStart(e, qIdx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, qIdx)}
                className={`${styles.questionCard} ${
                  !validation.valid ? styles.cardHasWarning : ''
                } ${draggedIndex === qIdx ? styles.cardDragging : ''}`}
              >
                {/* Card Top Bar */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    {!disabled && (
                      <span
                        className={styles.dragHandle}
                        title="Drag to reorder question"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <circle cx="8" cy="5" r="1.5" />
                          <circle cx="16" cy="5" r="1.5" />
                          <circle cx="8" cy="12" r="1.5" />
                          <circle cx="16" cy="12" r="1.5" />
                          <circle cx="8" cy="19" r="1.5" />
                          <circle cx="16" cy="19" r="1.5" />
                        </svg>
                      </span>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCollapse(qIdx)}
                      title={isCollapsed ? 'Expand Question' : 'Collapse Question'}
                      aria-label={isCollapsed ? 'Expand Question' : 'Collapse Question'}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {isCollapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="6 9 12 15 18 9" />}
                      </svg>
                    </Button>

                    <Badge variant="brand">Question {qIdx + 1}</Badge>

                    {validation.valid ? (
                      <Badge variant="success" size="sm">Ready</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">{validation.message}</Badge>
                    )}
                  </div>

                  {/* Actions: Reorder, Duplicate, Remove */}
                  <div className={styles.cardHeaderActions}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleMoveQuestion(qIdx, 'up')}
                      disabled={disabled || qIdx === 0}
                      title="Move Question Up"
                      aria-label={`Move question ${qIdx + 1} up`}
                    >
                      ↑ Up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleMoveQuestion(qIdx, 'down')}
                      disabled={disabled || qIdx === questions.length - 1}
                      title="Move Question Down"
                      aria-label={`Move question ${qIdx + 1} down`}
                    >
                      ↓ Down
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateQuestion(qIdx)}
                      disabled={disabled}
                      title="Duplicate Question"
                    >
                      Duplicate
                    </Button>

                    {confirmRemoveIndex === qIdx ? (
                      <>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          disabled={disabled}
                        >
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRemoveIndex(null)}
                          disabled={disabled}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmRemoveIndex(qIdx)}
                        disabled={disabled}
                        title="Delete Question"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                {/* Collapsed Preview */}
                {isCollapsed ? (
                  <div
                    className={styles.collapsedPreview}
                    onClick={() => toggleCollapse(qIdx)}
                  >
                    <span className={styles.collapsedPrompt}>
                      {question.text || '(Untitled question prompt)'}
                    </span>
                    <span className={styles.collapsedMeta}>
                      {question.options.length} options · {question.marks} marks · {question.questionType.replace('_', ' ')}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Question Prompt Input */}
                    <div className={styles.fieldGroup}>
                      <label htmlFor={`q-text-${qIdx}`} className={styles.fieldLabel}>
                        Question Prompt
                      </label>
                      <textarea
                        id={`q-text-${qIdx}`}
                        rows={3}
                        value={question.text}
                        onChange={(e) =>
                          handleQuestionChange(qIdx, 'text', e.target.value)
                        }
                        placeholder="Type your question prompt here..."
                        required
                        disabled={disabled}
                        className={styles.promptTextarea}
                      />
                    </div>

                    {/* Metadata Controls Grid */}
                    <div className={styles.metaGrid}>
                      <div className={styles.fieldGroup}>
                        <label htmlFor={`type-${qIdx}`} className={styles.fieldLabel}>
                          Question Type
                        </label>
                        <select
                          id={`type-${qIdx}`}
                          value={question.questionType}
                          onChange={(e) =>
                            handleTypeChange(qIdx, e.target.value as QuestionType)
                          }
                          disabled={disabled}
                          className={styles.selectInput}
                        >
                          <option value={QuestionType.SINGLE_CHOICE}>Single Choice</option>
                          <option value={QuestionType.MULTIPLE_CHOICE}>Multiple Choice</option>
                          <option value={QuestionType.TRUE_FALSE}>True / False</option>
                        </select>
                      </div>

                      <div className={styles.fieldGroup}>
                        <label htmlFor={`marks-${qIdx}`} className={styles.fieldLabel}>
                          Marks (1–100)
                        </label>
                        <input
                          id={`marks-${qIdx}`}
                          type="number"
                          min={1}
                          max={100}
                          value={question.marks}
                          onChange={(e) =>
                            handleQuestionChange(
                              qIdx,
                              'marks',
                              Math.max(1, Number(e.target.value) || 1),
                            )
                          }
                          disabled={disabled}
                          className={styles.numberInput}
                        />
                      </div>
                    </div>

                    {/* Options Builder Section */}
                    <div className={styles.optionsSection}>
                      <div className={styles.optionsHeader}>
                        <div className={styles.optionsTitleGroup}>
                          <span className={styles.fieldLabel}>Answer Options</span>
                          <span className={styles.fieldSubtext}>
                            {question.questionType === QuestionType.MULTIPLE_CHOICE
                              ? 'Check all options that apply'
                              : 'Select exactly one correct option'}
                          </span>
                        </div>

                        {question.questionType !== QuestionType.TRUE_FALSE &&
                          question.options.length < 8 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddOption(qIdx)}
                              disabled={disabled}
                            >
                              Add Option
                            </Button>
                          )}
                      </div>

                      <div className={styles.optionsList}>
                        {question.options.map((option, optIdx) => (
                          <div
                            key={option.id || `opt-${optIdx}`}
                            className={`${styles.optionRow} ${
                              option.isCorrect ? styles.optionRowCorrect : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleOptionCorrectToggle(qIdx, optIdx)}
                              disabled={disabled}
                              className={`${styles.correctToggleBtn} ${
                                option.isCorrect ? styles.correctToggleBtnActive : ''
                              }`}
                              title={
                                option.isCorrect
                                  ? 'Marked as correct option'
                                  : 'Click to mark this option as correct'
                              }
                            >
                              {option.isCorrect ? '✓ Correct' : String.fromCharCode(65 + optIdx)}
                            </button>

                            <input
                              type="text"
                              value={option.text}
                              onChange={(e) =>
                                handleOptionTextChange(qIdx, optIdx, e.target.value)
                              }
                              placeholder={`Option ${String.fromCharCode(65 + optIdx)} text`}
                              disabled={
                                disabled ||
                                question.questionType === QuestionType.TRUE_FALSE
                              }
                              className={styles.optionInput}
                            />

                            {question.questionType !== QuestionType.TRUE_FALSE && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(qIdx, optIdx)}
                                disabled={disabled || question.options.length <= 2}
                                className={styles.removeOptionBtn}
                                title="Remove this option"
                                aria-label={`Remove option ${String.fromCharCode(65 + optIdx)}`}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
