import { useState, type FormEvent } from 'react';
import type { LoginRequest } from '../types/auth.types';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/Card/Card';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Alert } from '@/components/feedback/Alert';

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
    <Card variant="elevated">
      <CardHeader style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--color-peach)', color: '#8C4B33', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0, 0, 0, 0.06)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            QuizPlatform
          </span>
        </div>
        <CardTitle style={{ textAlign: 'center', fontSize: '1.5rem' }}>
          Welcome Back
        </CardTitle>
        <CardDescription style={{ textAlign: 'center' }}>
          Enter your credentials to access your quiz workspace
        </CardDescription>
      </CardHeader>

      <CardBody>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            Sign In
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
