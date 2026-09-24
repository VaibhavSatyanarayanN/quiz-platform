import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { tokens } from '@/lib/storage/tokens';
import type { LoginResponse } from '../types/auth.types';
import { AuthContext, authKeys, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [hasToken, setHasToken] = useState(() => !!tokens.getAccessToken());

  const { data: user, isLoading } = useQuery({
    queryKey: authKeys.me(),
    queryFn: authApi.getMe,
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = useCallback((tokenResponse: LoginResponse) => {
    tokens.setTokens(tokenResponse.accessToken, tokenResponse.refreshToken);
    setHasToken(true);
  }, []);

  const logout = useCallback(() => {
    tokens.clearTokens();
    setHasToken(false);
    queryClient.removeQueries({ queryKey: authKeys.me() });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const isPlatformAdmin = user?.role === 'admin' || user?.platformRole === 'admin';
    const hasOrg = Boolean(user?.organizations && user.organizations.length > 0);
    const isOrganizationCreator = hasOrg;
    const isIndependentCreator = user?.role === 'creator' && !hasOrg;
    const currentOrganization = user?.organizations?.[0] ?? null;

    return {
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading: hasToken && isLoading,
      isPlatformAdmin,
      isOrganizationCreator,
      isIndependentCreator,
      currentOrganization,
      login,
      logout,
    };
  }, [user, isLoading, hasToken, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
