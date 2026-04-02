import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth-store';

import type { ProtectedRouteProps } from '@/types/auth.types';

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect to auth if we are NOT already on the auth page
    if (!isAuthenticated && window.location.pathname !== '/auth') {
      navigate({ to: '/auth' });
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return null;
}
