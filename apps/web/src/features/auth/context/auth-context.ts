import { createContext } from 'react';
import type { AuthUser, LoginResponse } from '../types/auth.types';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginResponse) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
