import {AlertTriangle, CheckCircle2, Lock, PenLine, Trophy} from 'lucide-react';
import {cn} from '@/utils/utils';
import type {CaseListEntry} from '@/lib/api/case-studies';

interface CaseListProps {
  cases: CaseListEntry[];
  activeCaseId: string | null;
  onSelectCase: (caseStudyId: string) => void;
}

const STATE_META: Record<
  CaseListEntry['state'],
  {icon: React.ElementType; label: string; className: string}
> = {
  locked: {icon: Lock, label: 'Locked', className: 'text-muted-foreground'},
  writable: {icon: PenLine, label: 'Up next', className: 'text-primary'},
  'submitted-awaiting-verdict': {
    icon: CheckCircle2,
    label: 'Submitted',
    className: 'text-muted-foreground',
  },
  won: {icon: Trophy, label: 'Completed', className: 'text-emerald-600 dark:text-emerald-400'},
  withdrawn: {icon: AlertTriangle, label: 'Flagged — revise', className: 'text-destructive'},
};

/** The drawer-tab list — locked/writable/awaiting-verdict/won/withdrawn per case. */
export default function CaseList({cases, activeCaseId, onSelectCase}: CaseListProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      {cases.map(c => {
        const needsRevision =
          c.myResponse?.eligibleForRevision === true &&
          c.state !== 'won' &&
          c.state !== 'withdrawn';
        const meta = needsRevision
          ? {
              icon: AlertTriangle,
              label: 'Might need revision',
              className: 'text-amber-600 dark:text-amber-400',
            }
          : STATE_META[c.state];
        const Icon = meta.icon;
        const isWithdrawn = c.state === 'withdrawn';
        const isLocked = c.state === 'locked';
        const isActive = c.caseStudyId === activeCaseId;
        return (
          <button
            key={c.caseStudyId}
            type="button"
            data-testid="case-list-item"
            data-case-state={needsRevision ? 'needs-revision' : c.state}
            data-sequence-index={c.sequenceIndex}
            disabled={isLocked}
            onClick={() => onSelectCase(c.caseStudyId)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
              isLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted',
              isActive && 'bg-muted',
              needsRevision && 'ring-1 ring-amber-400/50',
              isWithdrawn && 'ring-1 ring-destructive/50',
            )}
          >
            <span
              className={cn(
                'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                meta.className,
                needsRevision && 'border-amber-400/60 bg-amber-50 dark:bg-amber-950/30',
                isWithdrawn && 'border-destructive/60 bg-destructive/5',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.state === 'writable' && !needsRevision ? (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-primary" />
              ) : null}
              {needsRevision ? (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              ) : null}
              {isWithdrawn ? (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-destructive" />
              ) : null}
            </span>
            <span className="flex-1 truncate">
              <span className="block truncate font-medium">
                Case {c.sequenceIndex}: {c.title}
              </span>
              <span className={cn('text-xs', meta.className)}>{meta.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
