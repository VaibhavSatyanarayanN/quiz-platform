import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
