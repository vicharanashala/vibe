import { cn } from '@/lib/utils';

/** Text wordmark until ViBe has a proper logo asset. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-primary font-aleo text-sm font-semibold text-primary-foreground"
      >
        V
      </span>
      <span className="font-aleo text-xl font-semibold tracking-tight">ViBe</span>
    </span>
  );
}
