import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useCreateQuiz } from '../hooks/use-quizzes';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';

export default function CreateQuizPage() {
  const navigate = useNavigate();
  const createQuizMutation = useCreateQuiz();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | ''>(15);
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
          navigate(`/quizzes/${data.id}`);
        },
        onError: (err) => {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to create quiz.');
        },
      },
    );
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <Link to="/quizzes">
          <Button variant="ghost" size="sm">
            ← Back to Quizzes
          </Button>
        </Link>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle style={{ fontSize: '1.5rem', fontWeight: 700 }}>Create New Quiz</CardTitle>
          <CardDescription>
            Configure initial settings, title, description, and time limit for your new assessment.
          </CardDescription>
        </CardHeader>

        <CardBody>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

            <Input
              label="Quiz Title *"
              id="create-quiz-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Data Structures & Algorithms Assessment"
              required
              maxLength={200}
              disabled={createQuizMutation.isPending}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="create-quiz-desc"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary, #111827)',
                }}
              >
                Description (Optional)
              </label>
              <textarea
                id="create-quiz-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed summary of topics, audience, and instructions for this quiz..."
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="create-quiz-time"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary, #111827)',
                }}
              >
                Time Limit Preset
              </label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                  id="create-quiz-time-select"
                  value={timeLimitMinutes}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTimeLimitMinutes(val === '' ? '' : Number(val));
                  }}
                  disabled={createQuizMutation.isPending}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #d1d5db)',
                    background: 'var(--color-surface, #ffffff)',
                    color: 'var(--color-text-primary, #111827)',
                    fontSize: '0.875rem',
                    flex: 1,
                  }}
                >
                  <option value="">No Time Limit (Untimed)</option>
                  <option value="5">5 Minutes</option>
                  <option value="10">10 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="45">45 Minutes</option>
                  <option value="60">60 Minutes (1 Hour)</option>
                  <option value="90">90 Minutes (1.5 Hours)</option>
                  <option value="120">120 Minutes (2 Hours)</option>
                </select>

                <Input
                  id="create-quiz-time"
                  type="number"
                  min={1}
                  max={300}
                  value={timeLimitMinutes}
                  onChange={(e) =>
                    setTimeLimitMinutes(e.target.value ? Number(e.target.value) : '')
                  }
                  placeholder="Custom mins"
                  disabled={createQuizMutation.isPending}
                  style={{ width: '120px' }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #6b7280)' }}>
                Set the duration for timed assessments, or leave untimed.
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '12px',
                paddingTop: '16px',
                borderTop: '1px solid var(--color-border, #e5e7eb)',
              }}
            >
              <Link to="/quizzes">
                <Button type="button" variant="outline" disabled={createQuizMutation.isPending}>
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                variant="primary"
                isLoading={createQuizMutation.isPending}
              >
                Create Quiz & Add Questions →
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
