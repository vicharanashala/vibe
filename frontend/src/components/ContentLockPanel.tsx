import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ContentLockState } from '@/utils/contentLock';

type Choice = 'inherit' | 'locked' | 'open';
const VALUE: Record<Choice, boolean | null> = { inherit: null, locked: true, open: false };

/**
 * Lock: Inherit / Locked / Open for a module, section or lesson, in the
 * selected-entity side panel. Shows the saved value only, so a failed save
 * simply leaves the old choice selected (with a toast).
 */
export function ContentLockPanel({
  level,
  state,
  isPending,
  save,
}: {
  level: 'module' | 'section' | 'lesson';
  state: ContentLockState;
  isPending: boolean;
  save: (isLocked: boolean | null) => Promise<unknown>;
}) {
  const current: Choice = state.own === null ? 'inherit' : state.own ? 'locked' : 'open';
  const word = (locked: boolean) => (locked ? 'locked' : 'open');
  const summary = state.isInherited
    ? `This ${level} is ${word(state.effective)} (inherited)`
    : `This ${level} is ${word(state.effective)}`;

  const choose = async (next: string) => {
    if (next === current || !(next in VALUE)) return;
    try {
      await save(VALUE[next as Choice]);
    } catch (error) {
      toast.error(`The lock wasn’t saved: ${(error as Error).message}`);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <Label className="text-sm font-medium leading-none">Lock</Label>
        <p className="text-xs text-muted-foreground">
          {summary}. {state.effective ? 'Students can’t open it. Their progress is kept.' : 'Students can reach it as usual.'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-label="Saving" />}
        <Select value={current} onValueChange={choose} disabled={isPending}>
          <SelectTrigger className="w-[150px]" aria-label={`Lock for this ${level}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">Inherit ({word(state.inherited)})</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
            <SelectItem value="open">Open</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
