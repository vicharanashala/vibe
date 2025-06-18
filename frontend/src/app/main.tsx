import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/app/routes/router';
import { initAuth } from '@/utils/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/client';
import { AuthProvider } from '@/store/context/auth';
import { ThemeProvider } from '@/components/theme-provider';
import '@/assets/globals.css';

export function App() {
  // Initialize Firebase auth listener
  // useEffect(() => {
  //   const unsubscribe = initAuth();
  //   return () => unsubscribe();
  // }, []);
  if (localStorage.getItem('isAuth') !== 'true' || !localStorage.getItem('isAuth')) {
      initAuth();
  }
   
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <RouterProvider router={router} />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
