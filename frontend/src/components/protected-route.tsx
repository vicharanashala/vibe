import { ReactNode, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth-store';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'teacher' | 'student' | 'admin' | ('teacher' | 'student' | 'admin')[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user, hasRole } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      navigate({ to: '/auth' });
      return;
    }

    // If a specific role is required, check it
    if (requiredRole && !hasRole(requiredRole)) {
      // Check if user has any role before redirecting
      if (user?.role) {
        const userRole = user.role;
        // Only redirect if user has a role that doesn't match the required role
        navigate({ to: `/${userRole.toLowerCase()}` });
      } else {
        navigate({ to: '/auth' });
      }
    }
  }, [isAuthenticated, user, requiredRole, navigate, hasRole]);

  // Only render children if conditions are met
  if (isAuthenticated && (!requiredRole || hasRole(requiredRole))) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
}
