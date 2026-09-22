import { apiClient } from '@/lib/api/client';
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, AuthUser } from '../types/auth.types';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  refresh: async (refreshToken: string): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },

  getMe: async (): Promise<AuthUser> => {
    const response = await apiClient.get<AuthUser>('/auth/me');
    return response.data;
  },
};
