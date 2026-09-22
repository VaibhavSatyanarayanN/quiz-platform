export type UserRole = 'student' | 'creator' | 'admin';

export interface User {
  userId: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}
