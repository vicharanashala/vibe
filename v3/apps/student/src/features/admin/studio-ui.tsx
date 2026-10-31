import { ApiError } from '@vibe/api';
import { ChevronLeftIcon, ChevronRightIcon, MonitorIcon, XIcon } from 'lucide-react';
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

export function RoleBadge({ role }: { role: unknown }) {
  // Never trust the shape: roles have been seen as arrays and as null in production data.
  const r = (Array.isArray(role) ? role.join(', ') : typeof role === 'string' ? role : '').toUpperCase() || 'USER';
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

const DAY_MS = 24 * 60 * 60 * 1000;
const count = new Intl.NumberFormat();

/** "Joined / Created within" choices shared by the studio's lists. */
export type Since = 'any' | '1' | '7' | '30' | '90' | '365';
export const SINCE_OPTIONS: { value: Since; label: string }[] = [
  { value: 'any', label: 'any time' },
  { value: '1', label: 'in the last 24 hours' },
  { value: '7', label: 'in the last 7 days' },
  { value: '30', label: 'in the last 30 days' },
  { value: '90', label: 'in the last 90 days' },
  { value: '365', label: 'in the last year' },
];

/** Earliest timestamp (ms) a `since` choice allows, or null for any time. */
export function sinceCutoff(since: Since): number | null {
  return since === 'any' ? null : Date.now() - Number(since) * DAY_MS;
}

/** The slice of `items` for `page` (0-based, clamped to the last page). */
export function pageOf<T>(items: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages - 1);
  return { rows: items.slice(current * pageSize, (current + 1) * pageSize), current, pages };
}

/** "1–50 of 16,000 · Page 1 of 320 · Previous / Next" under a list. */
export function Pager({
  current,
  pages,
  pageSize,
  shownOnPage,
  total,
  onPage,
  className,
}: {
  current: number;
  pages: number;
  pageSize: number;
  shownOnPage: number;
  total: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  if (total === 0) return null;
  const first = current * pageSize + 1;
  return (
    <nav aria-label="Pages" className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm', className)}>
      <p className="text-muted-foreground tabular-nums">
        {count.format(first)}–{count.format(first + shownOnPage - 1)} of {count.format(total)}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground tabular-nums max-sm:hidden">
          Page {count.format(current + 1)} of {count.format(pages)}
        </span>
        <Button variant="outline" size="sm" disabled={current === 0} onClick={() => onPage(current - 1)}>
          <ChevronLeftIcon aria-hidden /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => onPage(current + 1)}>
          Next <ChevronRightIcon aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
