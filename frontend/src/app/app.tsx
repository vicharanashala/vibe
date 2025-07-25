import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/app/routes/router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/client';
import { AuthProvider } from '@/store/context/auth';
import { ThemeProvider } from '@/components/theme-provider';
import '@/assets/globals.css';
import { Toaster } from '@/components/ui/sonner';

export function App(){
  // Token refresh is now handled in AuthProvider
   
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <RouterProvider router={router} />
          <Toaster />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}