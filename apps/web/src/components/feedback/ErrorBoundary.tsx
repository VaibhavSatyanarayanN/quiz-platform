import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '../ui/Button/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              padding: '16px',
              borderRadius: '50%',
              backgroundColor: 'var(--danger-bg, #fef2f2)',
              color: 'var(--danger-accent, #dc2626)',
              marginBottom: '20px',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
            Something went wrong
          </h2>
          <p
            style={{
              color: 'var(--color-text-secondary, #6b7280)',
              maxWidth: '480px',
              marginBottom: '24px',
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred. Please refresh or return to the dashboard.
          </p>
          <Button onClick={this.handleReset} variant="primary">
            Return to Dashboard
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
