import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';

export default function AttemptHistoryPage() {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Attempt History</h1>
        <p style={{ color: 'var(--color-text-secondary, #6b7280)', margin: '4px 0 0 0' }}>
          View all your past quiz attempts, scores, performance metrics, and timestamps.
        </p>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>My Past Quiz Attempts</CardTitle>
          <CardDescription>Paginated history of submitted and in-progress attempts.</CardDescription>
        </CardHeader>
        <CardBody>
          <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontStyle: 'italic' }}>
            Attempt history listing placeholder. (Full backend pagination integration in Phase 5).
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
