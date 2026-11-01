import { useNavigate, useLocation, Link } from 'react-router';
import { useLogin } from '../hooks/use-auth';
import { LoginForm } from '../components/LoginForm';
import { AuthShowcase } from '../components/AuthShowcase';
import { ThemeToggle } from '@/components/ui/ThemeToggle/ThemeToggle';
import { Alert } from '@/components/feedback/Alert';
import { extractErrorMessage } from '@/lib/api/errors';
import type { LoginRequest } from '../types/auth.types';
import styles from '../styles/Auth.module.css';

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
    <div className={styles.pageContainer}>
      {/* Left: Product & Assessment Showcase */}
      <AuthShowcase
        headline="Automated quiz authoring, delivery, and verification."
        subtext="Structured assessments with schema-validated AI question generation, server-synchronized timers, and deterministic scoring."
      />

      {/* Right: Auth Form Panel */}
      <div className={styles.formColumn}>
        <div className={styles.topBarActions}>
          <ThemeToggle />
        </div>

        <div className={styles.formWrapper}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Sign In</h2>
            <p className={styles.formDescription}>
              Enter your credentials to access your assessment studio
            </p>
          </div>

          {isRegisteredSuccess && (
            <Alert variant="success" title="Account Created Successfully!">
              Your account {registeredEmail ? `(${registeredEmail}) ` : ''}has been created. Please sign in below.
            </Alert>
          )}

          <LoginForm
            onSubmit={handleLogin}
            isLoading={loginMutation.isPending}
            error={errorMessage}
          />

          <p className={styles.switchAuthPrompt}>
            Don't have an account?{' '}
            <Link to="/register" className={styles.switchAuthLink}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
