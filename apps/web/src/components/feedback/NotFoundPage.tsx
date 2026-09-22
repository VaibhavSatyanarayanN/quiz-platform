import { Link } from 'react-router';
import { Button } from '../ui/Button/Button';

export default function NotFoundPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: '4rem',
          fontWeight: 900,
          color: 'var(--brand-600, #4f46e5)',
          margin: 0,
          lineHeight: 1,
        }}
      >
        404
      </h1>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '16px 0 8px 0' }}>
        Page Not Found
      </h2>
      <p
        style={{
          color: 'var(--color-text-secondary, #6b7280)',
          maxWidth: '440px',
          margin: '0 0 24px 0',
          lineHeight: 1.5,
        }}
      >
        The page or resource you requested could not be found. It may have been moved, deleted, or does not exist.
      </p>
      <Link to="/dashboard">
        <Button variant="primary">Return to Dashboard</Button>
      </Link>
    </div>
  );
}
