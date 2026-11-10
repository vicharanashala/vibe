import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { MotionConfig } from 'motion/react';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/features/auth/auth-provider';
import { queryClient } from '@/lib/query-client';
import { router as defaultRouter, type createAppRouter } from '@/router';

export function App({ router = defaultRouter }: { router?: ReturnType<typeof createAppRouter> }) {
  return (
    <ThemeProvider>
      {/* Every motion/react animation drops its movement for students who ask their OS for less motion. */}
      <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
            {/* Top-centre keeps toasts clear of the phone tab bar and lesson action bars. */}
            <Toaster position="top-center" />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

export default App;
