import { useNavigate, Link } from 'react-router';
import { useRegister } from '../hooks/use-auth';
import { RegisterForm } from '../components/RegisterForm';
import { AuthShowcase } from '../components/AuthShowcase';
import { ThemeToggle } from '@/components/ui/ThemeToggle/ThemeToggle';
import { extractErrorMessage } from '@/lib/api/errors';
import type { RegisterRequest } from '../types/auth.types';
import styles from '../styles/Auth.module.css';

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
    <div className={styles.pageContainer}>
      {/* Left: Product & Assessment Showcase */}
      <AuthShowcase
        headline="Create, deliver, and evaluate assessments with precision."
        subtext="Join organizations using version-locked quizzes, multi-agent AI drafting from prompts or PDFs, and real-time answer persistence."
      />

      {/* Right: Auth Form Panel */}
      <div className={styles.formColumn}>
        <div className={styles.topBarActions}>
          <ThemeToggle />
        </div>

        <div className={styles.formWrapper}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Create Account</h2>
            <p className={styles.formDescription}>
              Sign up to take assessments and author quizzes
            </p>
          </div>

          <RegisterForm
            onSubmit={handleRegister}
            isLoading={registerMutation.isPending}
            error={errorMessage}
          />

          <p className={styles.switchAuthPrompt}>
            Already have an account?{' '}
            <Link to="/login" className={styles.switchAuthLink}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
