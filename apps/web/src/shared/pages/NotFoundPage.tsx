import { Link } from 'react-router';
import { Layout } from '@/shared/components/Layout';
import { Card, CardBody } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';

export default function NotFoundPage() {
  return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Card variant="default" style={{ maxWidth: 480, textAlign: 'center', padding: 'var(--space-10) var(--space-8)' }}>
          <CardBody>
            <div
              style={{
                fontSize: '5.5rem',
                fontWeight: '900',
                letterSpacing: '-0.05em',
                lineHeight: 1,
                marginBottom: 'var(--space-2)',
                background: 'linear-gradient(135deg, var(--brand-600) 0%, var(--brand-400) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              404
            </div>
            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-extrabold)', marginBottom: 'var(--space-2)' }}>
              Page Not Found
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
              The page you are looking for doesn't exist, has been removed, or is temporarily unavailable.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link to="/" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg">
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
}
