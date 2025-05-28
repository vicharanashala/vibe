import { AuthContext } from '@/context/auth';
import { useContext } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useNavigate } from '@tanstack/react-router';

export function useAuth() {
  const context = useContext(AuthContext);
  const { user, isAuthenticated, hasRole} = useAuthStore();
  const navigate = useNavigate();

  // Check if user has a specific role
  const checkRole = (requiredRole: string | string[]): boolean => {
    return hasRole(requiredRole);
  };

  // Redirect if user doesn't have required role
  const requireRole = (requiredRole: string | string[]): boolean => {
    if (!isAuthenticated) {
      navigate({ to: '/auth' });
      return false;
    }
    
    if (!checkRole(requiredRole)) {
      // If user has a role, redirect to their appropriate dashboard
      if (user?.role) {
        navigate({ to: `/${user.role.toLowerCase()}` });
      } else {
        navigate({ to: '/auth' });
      }
      return false;
    }
    return true;
  };

  return {
    user,
    checkRole,
    requireRole,
    // Include context methods for backward compatibility
    ...context
  };
}
