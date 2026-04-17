import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/app/routes/router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/client';
import { AuthProvider } from '@/store/context/auth';
import { ThemeProvider } from '@/components/theme-provider';
import '@/assets/globals.css';
import { Toaster } from '@/components/ui/sonner';
import { hasFirebaseEnv } from '@/lib/firebase';
import { DemoApp } from '@/app/demo';

export function App(){
  // Token refresh is now handled in AuthProvider
  if (!hasFirebaseEnv) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <DemoApp />
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    );
  }
   
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
