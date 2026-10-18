import { ApiError } from '@vibe/api';
import { MonitorIcon, XIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/** Shared building blocks for the studio (teacher/admin) pages. */

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export function ErrorText({
  error,
  className,
}: {
  error: unknown;
  className?: string;
}) {
  return (
    <p role="alert" className={cn('text-sm text-destructive', className)}>
      {errorMessage(error)}
    </p>
  );
}

/** Centred reading column, like Substack's dashboard. */
export function StudioPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-sm text-muted-foreground">{eyebrow}</div>
        )}
        <h1 className="font-aleo text-3xl tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Substack-style overview strip: a row of numbers joined in one card. */
export function StatStrip({
  stats,
}: {
  stats: { label: string; value: ReactNode; hint?: string }[];
}) {
  return (
    <dl className="grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] sm:divide-x max-sm:divide-y divide-border">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            'relative px-5 py-4',
            i === 0 &&
              'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary',
          )}
        >
          <dt className="text-xs font-medium text-muted-foreground">
            {s.label}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {s.value}
          </dd>
          {s.hint && (
            <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
          )}
        </div>
      ))}
    </dl>
  );
}

/** Small section heading inside a page, with an optional action on the right. */
export function SectionHeading({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const r = role.toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium tracking-wide',
        r === 'ADMIN' || r === 'INSTRUCTOR'
          ? 'bg-blush text-blush-foreground'
          : r === 'STUDENT' || r === 'USER'
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {r.charAt(0) + r.slice(1).toLowerCase()}
    </span>
  );
}

export function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

/** Confirm-before-delete. `onConfirm` may return a promise; the dialog stays open (with a spinner) until it settles. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ErrorText error={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {busy && <Spinner className="size-4" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Phones only: a dismissible note that a task is easier on a computer. The
 * page still works; this just sets expectations. Dismissal is remembered.
 */
export function DesktopHint({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const key = `desktop-hint:${id}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <Alert className="mb-5 md:hidden">
      <MonitorIcon />
      <AlertTitle>Easier on a computer</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
      <AlertAction>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(key, '1');
            } catch {
              // ignore
            }
          }}
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  );
}

/**
 * Text clamped to a few lines, with a "Show more" / "Show less" button when it
 * doesn't fit. A tap target rather than a hover tooltip, so it works on phones.
 * Long unbroken words (URLs) wrap instead of widening the page.
 */
export function ClampedText({ children, className }: { children: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [children, expanded]);

  return (
    <div className={className}>
      <p ref={ref} className={cn('text-sm break-words whitespace-pre-line text-muted-foreground', !expanded && 'line-clamp-2')}>
        {children}
      </p>
      {(overflows || expanded) && (
        <Button
          variant="link"
          size="xs"
          className="h-auto p-0 text-xs text-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
}
