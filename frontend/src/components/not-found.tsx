import { FC, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useNavigate } from '@tanstack/react-router';

export const NotFoundComponent: FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  // Determine the home route based on user role
  const getHomeRoute = () => {
    if (isAuthenticated && user?.role) {
      return `/${user.role.toLowerCase()}`;
    }
    return '/auth';
  };

  // Handle the redirect when the user clicks the button
  const handleRedirect = () => {
    navigate({ to: getHomeRoute() });
  };

  // Auto-redirect after a few seconds (optional)
  useEffect(() => {
    const timer = setTimeout(() => {
      handleRedirect();
    }, 5000); // Auto-redirect after 5 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center p-8 bg-gray-50 rounded-lg shadow-lg max-w-md">
        <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
        <p className="text-gray-600 mb-6">The page you're looking for doesn't exist or has been moved.</p>
        {isAuthenticated && user?.role && (
          <p className="text-gray-500 mb-4">
            You will be redirected to your {user.role} dashboard automatically.
          </p>
        )}
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={handleRedirect}
        >
          {isAuthenticated && user?.role 
            ? `Go to ${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard` 
            : 'Go to Login'}
        </button>
      </div>
    </div>
  );
};
