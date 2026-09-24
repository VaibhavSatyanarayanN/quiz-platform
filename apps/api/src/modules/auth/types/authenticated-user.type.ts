export type AuthenticatedUser = {
  userId: string;
  role: string;
  platformRole?: string;
};