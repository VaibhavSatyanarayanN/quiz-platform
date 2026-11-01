import { useState, type FormEvent } from 'react';
import type { RegisterRequest } from '../types/auth.types';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';
import styles from '../styles/Auth.module.css';

interface RegisterFormProps {
  onSubmit: (data: RegisterRequest) => void;
  isLoading: boolean;
  error: string | null;
}

export function RegisterForm({ onSubmit, isLoading, error }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ email, username, password });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.authForm}>
      {error && <Alert variant="danger">{error}</Alert>}

      <Input
        id="register-email"
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
        id="register-username"
        type="text"
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        disabled={isLoading}
        minLength={3}
        maxLength={30}
        pattern="^[a-zA-Z0-9_]+$"
        helperText="3-30 alphanumeric characters or underscores"
        placeholder="johndoe"
        autoComplete="username"
      />

      <Input
        id="register-password"
        type="password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={isLoading}
        minLength={8}
        helperText="Minimum 8 characters"
        placeholder="••••••••"
        autoComplete="new-password"
      />

      <div className={styles.formActions}>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className={styles.submitBtn}
        >
          Create Platform Account
        </Button>
      </div>
    </form>
  );
}
