export const UserRole = {
  USER: 'user',
  CREATOR: 'creator',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthUser {
  userId: string;
  role: UserRole;
  platformRole?: UserRole;
  email?: string;
  username?: string;
  mustChangePassword?: boolean;
  organizations?: OrganizationMembership[];
}
