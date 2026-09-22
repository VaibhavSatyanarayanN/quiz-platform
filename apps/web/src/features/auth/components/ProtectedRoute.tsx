import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../hooks/use-auth';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { AppLayout } from '@/components/layout/AppLayout';
import type { UserRole } from '@/types/user.types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Authenticating session..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role as UserRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
