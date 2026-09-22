import { useContext } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { AuthContext, type AuthContextValue } from '../context/auth-context';
import type { LoginRequest, RegisterRequest } from '../types/auth.types';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useLogin() {
  const { login } = useAuth();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (data) => {
      login(data);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
  });
}
