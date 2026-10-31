import { Link } from '@tanstack/react-router';
import { CircleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { PartnerLogos } from '@/components/partner-logos';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldSeparator } from '@/components/ui/field';
import { Wordmark } from '@/features/landing/wordmark';

/** Uxcel-style auth frame: logo, centred narrow column, partner strip below. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent"
      />
      <header className="relative flex items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" aria-label="ViBe home" className="rounded-md">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 pt-8 pb-12 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="font-aleo text-3xl tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>

      <footer className="relative px-4 pb-8">
        <p className="mb-4 text-center text-xs text-muted-foreground">In association with</p>
        <PartnerLogos size="sm" />
      </footer>
    </div>
  );
}

/** "or" divider between social and email sign-in. */
export function OrDivider() {
  return <FieldSeparator className="my-5">or</FieldSeparator>;
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
