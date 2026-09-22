import { Modal } from '@/components/ui/Modal/Modal';
import { Button } from '@/components/ui/Button/Button';

interface SubmitConfirmModalProps {
  isOpen: boolean;
  totalQuestions: number;
  answeredCount: number;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function SubmitConfirmModal({
  isOpen,
  totalQuestions,
  answeredCount,
  onClose,
  onConfirm,
  isSubmitting,
}: SubmitConfirmModalProps) {
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Assessment"
      description="Finalize and submit your answers for immediate grading."
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Keep Reviewing
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            isLoading={isSubmitting}
          >
            Confirm & Submit
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem', lineHeight: '1.5', margin: 0 }}>
          Are you sure you want to finalize your submission? You will not be able to modify your answers once confirmed.
        </p>

        <div
          style={{
            background: 'var(--color-bg-subtle, #f9fafb)',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span>Total Questions:</span>
            <strong>{totalQuestions}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span>Answered:</span>
            <strong style={{ color: 'var(--success-text, #047857)' }}>{answeredCount}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span>Unanswered:</span>
            <strong style={{ color: unansweredCount > 0 ? 'var(--danger-accent, #dc2626)' : 'inherit' }}>
              {unansweredCount}
            </strong>
          </div>
        </div>

        {unansweredCount > 0 && (
          <div
            style={{
              background: 'var(--warning-bg, #fffbeb)',
              border: '1px solid var(--warning-border, #fde68a)',
              color: 'var(--warning-text, #b45309)',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            ⚠️ You have <strong>{unansweredCount}</strong> unanswered question
            {unansweredCount > 1 ? 's' : ''}. Unanswered questions will receive 0 marks.
          </div>
        )}
      </div>
    </Modal>
  );
}
