import { useState, type FormEvent } from 'react';
import type { LoginRequest } from '../types/auth.types';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';
import styles from '../styles/Auth.module.css';

interface LoginFormProps {
  onSubmit: (data: LoginRequest) => void;
  isLoading: boolean;
  error: string | null;
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.authForm}>
      {error && <Alert variant="danger">{error}</Alert>}

      <Input
        id="login-email"
        type="email"
        label="Email Address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={isLoading}
        placeholder="name@example.com"
        autoComplete="email"
      />

      <Input
        id="login-password"
        type="password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={isLoading}
        minLength={8}
        placeholder="••••••••"
        autoComplete="current-password"
      />

      <div className={styles.formActions}>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className={styles.submitBtn}
        >
          Sign In to Workspace
        </Button>
      </div>
    </form>
  );
}
