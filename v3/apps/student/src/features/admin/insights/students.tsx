import { ChevronRightIcon, PartyPopperIcon } from 'lucide-react';

import { GeneratedAvatar } from '@/components/generated-art';
import { cn } from '@/lib/utils';

import { ShowMoreList } from './bars';
import { ChartPanel } from './chart-panel';
import { days } from './format';
import type { CheckOnStudent } from './types';

const STATUS = {
  stuck: { label: 'Stuck', dot: 'bg-amber-500' },
  inactive: { label: 'Inactive', dot: 'bg-slate-400 dark:bg-slate-500' },
} as const;

/** Students who've gone quiet or are stuck on one lesson. Each opens People filtered to them. */
export function StudentsToCheckOn({
  students,
  totals,
  onOpenStudent,
}: {
  students: CheckOnStudent[];
  /** Totals per reason from the backend; the list itself is capped at 50. */
  totals?: { inactive: number; stuck: number };
  onOpenStudent: (email: string) => void;
}) {
  const inactive =
    totals?.inactive ?? students.filter((s) => s.reason === 'inactive').length;
  const stuck =
    totals?.stuck ?? students.filter((s) => s.reason === 'stuck').length;
  return (
    <ChartPanel
      title="Students to check on"
      summary={
        students.length
          ? `${inactive.toLocaleString()} inactive 7+ days, ${stuck.toLocaleString()} stuck 3+ days.`
          : 'Everyone is active and moving.'
      }
    >
      {students.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <PartyPopperIcon aria-hidden className="size-4" /> No one has gone
          quiet or got stuck.
        </p>
      ) : (
        <ShowMoreList
          items={students}
          noun="students"
          render={(s) => {
            const status = STATUS[s.reason];
            const detail =
              s.reason === 'stuck' && s.item
                ? `${days(s.daysOnItem ?? 0)} on “${s.item.name}”`
                : `Last active ${days(s.daysSinceActive)} ago`;
            return (
              <li key={s.userId}>
                <button
                  type="button"
                  onClick={() => onOpenStudent(s.email)}
                  className="group/row -mx-2 flex w-[calc(100%+1rem)] min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <GeneratedAvatar seed={s.userId} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {s.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {detail}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span
                      aria-hidden
                      className={cn('size-1.5 rounded-full', status.dot)}
                    />
                    {status.label}
                  </span>
                  <ChevronRightIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-hover/row:translate-x-0.5"
                  />
                </button>
              </li>
            );
          }}
        />
      )}
    </ChartPanel>
  );
}
