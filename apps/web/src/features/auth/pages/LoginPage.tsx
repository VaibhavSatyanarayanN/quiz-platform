import { useNavigate, useLocation, Link } from 'react-router';
import { useLogin } from '../hooks/use-auth';
import { LoginForm } from '../components/LoginForm';
import { ThemeToggle } from '@/components/ui/ThemeToggle/ThemeToggle';
import { Alert } from '@/components/feedback/Alert';
import { extractErrorMessage } from '@/lib/api/errors';
import type { LoginRequest } from '../types/auth.types';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();

  const isRegisteredSuccess = Boolean(location.state?.registered);
  const registeredEmail = location.state?.registeredEmail;

  const handleLogin = (data: LoginRequest) => {
    loginMutation.mutate(data, {
      onSuccess: () => {
        navigate('/dashboard', { replace: true });
      },
    });
  };

  const errorMessage = loginMutation.error
    ? extractErrorMessage(loginMutation.error)
    : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-base, #f8fafc)',
        padding: '24px',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
        <ThemeToggle />
      </div>

      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isRegisteredSuccess && (
          <Alert variant="success" title="Account Created Successfully!">
            Your account {registeredEmail ? `(${registeredEmail}) ` : ''}has been created. Please sign in below to access your workspace.
          </Alert>
        )}

        <LoginForm
          onSubmit={handleLogin}
          isLoading={loginMutation.isPending}
          error={errorMessage}
        />

        <p
          style={{
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary, #6b7280)',
            marginTop: '8px',
          }}
        >
          Don't have an account?{' '}
          <Link
            to="/register"
            style={{
              color: 'var(--brand-600, #4f46e5)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
