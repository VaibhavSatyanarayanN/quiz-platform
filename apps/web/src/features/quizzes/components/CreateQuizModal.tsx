import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useCreateQuiz } from '../hooks/use-quizzes';
import { Modal } from '@/components/ui/Modal/Modal';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';

interface CreateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateQuizModal({ isOpen, onClose }: CreateQuizModalProps) {
  const navigate = useNavigate();
  const createQuizMutation = useCreateQuiz();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | ''>(10);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Quiz title is required.');
      return;
    }

    const timeLimitSeconds =
      typeof timeLimitMinutes === 'number' && timeLimitMinutes > 0
        ? timeLimitMinutes * 60
        : undefined;

    createQuizMutation.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        timeLimitSeconds,
      },
      {
        onSuccess: (data) => {
          onClose();
          navigate(`/quizzes/${data.id}`);
        },
        onError: (err) => {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to create quiz');
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Quiz"
      description="Initialize a new quiz assessment with an initial draft version."
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

        <Input
          label="Quiz Title *"
          id="quiz-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Advanced JavaScript & TypeScript"
          required
          maxLength={200}
          disabled={createQuizMutation.isPending}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="quiz-desc"
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text-primary, #111827)',
            }}
          >
            Description (Optional)
          </label>
          <textarea
            id="quiz-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief summary of topics and competencies evaluated in this quiz..."
            maxLength={5000}
            disabled={createQuizMutation.isPending}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #d1d5db)',
              background: 'var(--color-surface, #ffffff)',
              color: 'var(--color-text-primary, #111827)',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              resize: 'vertical',
            }}
          />
        </div>

        <Input
          label="Time Limit (Minutes)"
          id="quiz-time"
          type="number"
          min={1}
          max={300}
          value={timeLimitMinutes}
          onChange={(e) =>
            setTimeLimitMinutes(e.target.value ? Number(e.target.value) : '')
          }
          placeholder="e.g., 15 (leave empty for untimed)"
          helperText="Leave empty to make the assessment untimed."
          disabled={createQuizMutation.isPending}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--color-border, #e5e7eb)',
          }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createQuizMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={createQuizMutation.isPending}
          >
            Create & Setup Questions
          </Button>
        </div>
      </form>
    </Modal>
  );
}
