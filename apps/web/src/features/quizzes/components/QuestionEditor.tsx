import { useState } from 'react';
import type {
  CreateQuestionRequest,
  CreateOptionRequest,
} from '../types/quiz.types';
import { QuestionType } from '../types/quiz.types';

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
  disabled,
}: QuestionEditorProps) {
  const [collapsedMap, setCollapsedMap] = useState<Record<number, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
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
      text: `${q.text} (Copy)`,
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

  const handleMoveQuestion = (qIndex: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && qIndex === 0) ||
      (direction === 'down' && qIndex === questions.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? qIndex - 1 : qIndex + 1;
    const updated = [...questions];
    const temp = updated[qIndex];
    updated[qIndex] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChange(updated);
  };

  const handleRemoveQuestion = (qIndex: number) => {
    const updated = questions.filter((_, idx) => idx !== qIndex);
    onChange(updated);
  };

  const handleQuestionChange = (
    qIndex: number,
    field: keyof CreateQuestionRequest,
    value: unknown,
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
    let newOptions = [...q.options];

    if (newType === QuestionType.TRUE_FALSE) {
      newOptions = [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ];
    } else if (newType === QuestionType.SINGLE_CHOICE) {
      let foundCorrect = false;
      newOptions = newOptions.map((opt) => {
        if (opt.isCorrect && !foundCorrect) {
          foundCorrect = true;
          return opt;
        }
        return { ...opt, isCorrect: false };
      });
      if (!foundCorrect && newOptions.length > 0) {
        newOptions[0].isCorrect = true;
      }
    }

    const updated = [...questions];
    updated[qIndex] = {
      ...updated[qIndex],
      questionType: newType,
      options: newOptions,
    };
    onChange(updated);
  };

  const handleAddOption = (qIndex: number) => {
    const q = questions[qIndex];
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
    if (q.options.length <= 2) return;

    const updatedOptions = q.options.filter((_, idx) => idx !== optIndex);
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
    <div className="question-editor-container">
      {/* Editor Header Stats & Quick Add */}
      <div className="editor-header-bar">
        <div className="editor-header-stats">
          <h3>Questions ({questions.length})</h3>
          <span className="editor-marks-pill">Total: {totalMarks} Marks</span>
        </div>

        <div className="editor-header-actions">
          {questions.length > 1 && (
            <div className="accordion-toggle-group">
              <button
                type="button"
                onClick={handleExpandAll}
                className="btn btn-sm btn-outline"
                title="Expand all questions"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="btn btn-sm btn-outline"
                title="Collapse all questions"
              >
                Collapse All
              </button>
            </div>
          )}

          <div className="dropdown-add-group">
            <button
              type="button"
              onClick={() => handleAddQuestion(QuestionType.SINGLE_CHOICE)}
              disabled={disabled}
              className="btn btn-sm btn-outline"
            >
              + Add Question
            </button>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={disabled || isSaving}
                className="btn btn-sm btn-primary"
              >
                {isSaving ? 'Saving...' : 'Save Questions'}
              </button>
            )}
          </div>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="empty-state-card" style={{ padding: '36px' }}>
          <span className="empty-state-icon">✍️</span>
          <h3>No questions in this draft</h3>
          <p className="text-muted">
            Add your first question to start crafting your quiz assessment.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => handleAddQuestion(QuestionType.SINGLE_CHOICE)}
              disabled={disabled}
              className="btn btn-primary btn-sm"
            >
              + Single Choice Question
            </button>
            <button
              type="button"
              onClick={() => handleAddQuestion(QuestionType.MULTIPLE_CHOICE)}
              disabled={disabled}
              className="btn btn-outline btn-sm"
            >
              + Multiple Choice Question
            </button>
            <button
              type="button"
              onClick={() => handleAddQuestion(QuestionType.TRUE_FALSE)}
              disabled={disabled}
              className="btn btn-outline btn-sm"
            >
              + True/False Question
            </button>
          </div>
        </div>
      ) : (
        <div className="editor-questions-list">
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
                className={`editor-question-item ${
                  !validation.valid ? 'item-has-validation-warning' : ''
                } ${draggedIndex === qIdx ? 'item-dragging' : ''}`}
              >
                {/* Question Row Header */}
                <div className="editor-q-header">
                  <span
                    className="drag-handle-grip"
                    title="Drag to reorder question"
                    style={{ cursor: 'grab', userSelect: 'none', padding: '0 4px', fontWeight: 'bold', color: 'var(--color-text-muted)' }}
                  >
                    ⋮⋮
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleCollapse(qIdx)}
                    className="collapse-toggle-btn"
                    title={isCollapsed ? 'Expand Question' : 'Collapse Question'}
                  >
                    {isCollapsed ? '▶' : '▼'}
                  </button>

                  <span className="q-number-pill">Q{qIdx + 1}</span>

                  <div className="q-type-select-group">
                    <label htmlFor={`type-${qIdx}`}>Type:</label>
                    <select
                      id={`type-${qIdx}`}
                      value={question.questionType}
                      onChange={(e) =>
                        handleTypeChange(qIdx, e.target.value as QuestionType)
                      }
                      disabled={disabled}
                    >
                      <option value={QuestionType.SINGLE_CHOICE}>Single Choice</option>
                      <option value={QuestionType.MULTIPLE_CHOICE}>Multiple Choice</option>
                      <option value={QuestionType.TRUE_FALSE}>True / False</option>
                    </select>
                  </div>

                  <div className="q-marks-group">
                    <label htmlFor={`marks-${qIdx}`}>Marks:</label>
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
                          Math.max(1, Number(e.target.value)),
                        )
                      }
                      disabled={disabled}
                    />
                  </div>

                  <div className="q-validity-status">
                    {validation.valid ? (
                      <span className="badge badge-success">✓ Ready</span>
                    ) : (
                      <span className="badge badge-warning">⚠️ {validation.message}</span>
                    )}
                  </div>

                  {/* Reorder and Action Buttons */}
                  <div className="q-header-actions">
                    <button
                      type="button"
                      onClick={() => handleMoveQuestion(qIdx, 'up')}
                      disabled={disabled || qIdx === 0}
                      className="icon-action-btn"
                      title="Move Question Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveQuestion(qIdx, 'down')}
                      disabled={disabled || qIdx === questions.length - 1}
                      className="icon-action-btn"
                      title="Move Question Down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateQuestion(qIdx)}
                      disabled={disabled}
                      className="icon-action-btn"
                      title="Duplicate Question"
                    >
                      📄
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIdx)}
                      disabled={disabled}
                      className="icon-action-btn text-danger"
                      title="Delete Question"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Collapsed Preview */}
                {isCollapsed ? (
                  <div
                    className="collapsed-q-preview"
                    onClick={() => toggleCollapse(qIdx)}
                  >
                    <span className="preview-prompt-text">
                      {question.text || '(Untitled question prompt)'}
                    </span>
                    <span className="text-muted text-xs">
                      {question.options.length} options ({question.marks} marks)
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Question Prompt Input */}
                    <div className="form-group" style={{ marginBottom: '14px' }}>
                      <textarea
                        rows={2}
                        value={question.text}
                        onChange={(e) =>
                          handleQuestionChange(qIdx, 'text', e.target.value)
                        }
                        placeholder="Type your question prompt here..."
                        required
                        disabled={disabled}
                      />
                    </div>

                    {/* Options Builder Box */}
                    <div className="editor-options-box">
                      <div className="options-title-row">
                        <span className="text-sm font-semibold">Answer Options:</span>
                        <span className="text-muted text-xs">
                          {question.questionType === QuestionType.MULTIPLE_CHOICE
                            ? 'Check all options that apply'
                            : 'Select exactly one correct option'}
                        </span>
                      </div>

                      {question.options.map((option, optIdx) => (
                        <div
                          key={option.id || `opt-${optIdx}`}
                          className={`editor-option-row ${
                            option.isCorrect ? 'option-row-correct' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleOptionCorrectToggle(qIdx, optIdx)}
                            disabled={disabled}
                            className={`correct-toggle-btn ${
                              option.isCorrect ? 'correct-active' : ''
                            }`}
                            title={
                              option.isCorrect
                                ? 'Marked as correct option'
                                : 'Click to mark this option as correct'
                            }
                          >
                            {option.isCorrect ? '✓ Correct' : 'Mark Correct'}
                          </button>

                          <span className="option-letter-tag">
                            {String.fromCharCode(65 + optIdx)}
                          </span>

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
                            className="editor-opt-input"
                          />

                          {question.questionType !== QuestionType.TRUE_FALSE && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(qIdx, optIdx)}
                              disabled={disabled || question.options.length <= 2}
                              className="opt-remove-btn"
                              title="Remove this option"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}

                      {question.questionType !== QuestionType.TRUE_FALSE && (
                        <button
                          type="button"
                          onClick={() => handleAddOption(qIdx)}
                          disabled={disabled}
                          className="btn btn-sm btn-outline"
                          style={{ marginTop: '8px', alignSelf: 'flex-start' }}
                        >
                          + Add Option
                        </button>
                      )}
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
