import { useNavigate, Link } from 'react-router';
import { useRegister } from '../hooks/use-auth';
import { RegisterForm } from '../components/RegisterForm';
import { ThemeToggle } from '@/components/ui/ThemeToggle/ThemeToggle';
import { extractErrorMessage } from '@/lib/api/errors';
import type { RegisterRequest } from '../types/auth.types';

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegister();

  const handleRegister = (data: RegisterRequest) => {
    registerMutation.mutate(data, {
      onSuccess: () => {
        navigate('/login', {
          state: { registered: true, registeredEmail: data.email },
          replace: true,
        });
      },
    });
  };

  const errorMessage = registerMutation.error
    ? extractErrorMessage(registerMutation.error)
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

      <div style={{ width: '100%', maxWidth: '440px' }}>
        <RegisterForm
          onSubmit={handleRegister}
          isLoading={registerMutation.isPending}
          error={errorMessage}
        />
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary, #6b7280)',
            marginTop: '20px',
          }}
        >
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: 'var(--brand-600, #4f46e5)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
