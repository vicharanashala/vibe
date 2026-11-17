import { ChevronRightIcon, PartyPopperIcon } from 'lucide-react';

import { GeneratedAvatar } from '@/components/generated-art';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ChartPanel } from './chart-panel';
import { count, days } from './format';
import type { CheckOnStudent } from './types';

const SHOWN = 10;

/** Students who've gone quiet or are stuck on one lesson. Each opens People filtered to them. */
export function StudentsToCheckOn({
  students,
  onOpenStudent,
}: {
  students: CheckOnStudent[];
  onOpenStudent: (email: string) => void;
}) {
  const inactive = students.filter((s) => s.reason === 'inactive').length;
  const stuck = students.length - inactive;
  return (
    <ChartPanel
      title="Students to check on"
      summary={
        students.length
          ? `${count(inactive, 'student')} inactive for a week or more, ${stuck.toLocaleString()} on the same lesson for 3+ days.`
          : 'Everyone is active and moving.'
      }
    >
      {students.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <PartyPopperIcon aria-hidden className="size-4" /> No one has gone quiet or got stuck.
        </p>
      ) : (
        <ul className="-mx-2 divide-y divide-border">
          {students.slice(0, SHOWN).map((s) => (
            <li key={s.userId}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-3 rounded-lg px-2 py-2.5 text-left font-normal whitespace-normal"
                onClick={() => onOpenStudent(s.email)}
              >
                <GeneratedAvatar seed={s.userId} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.reason === 'stuck' && s.item
                      ? `On “${s.item.name}” for ${days(s.daysOnItem ?? 0)}`
                      : `Last active ${days(s.daysSinceActive)} ago${s.item ? ` · on “${s.item.name}”` : ''}`}
                  </span>
                </span>
                <Badge variant={s.reason === 'stuck' ? 'secondary' : 'outline'} className="shrink-0">
                  {s.reason === 'stuck' ? 'Stuck' : 'Inactive'}
                </Badge>
                <ChevronRightIcon aria-hidden className="shrink-0 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {students.length > SHOWN && (
        <p className="mt-2 text-xs text-muted-foreground">And {count(students.length - SHOWN, 'more student')}.</p>
      )}
    </ChartPanel>
  );
}
