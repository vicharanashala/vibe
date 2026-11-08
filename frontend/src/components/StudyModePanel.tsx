import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StudyModeState } from '@/utils/studyMode';

type Choice = 'inherit' | 'on' | 'off';
const VALUE: Record<Choice, boolean | null> = { inherit: null, on: true, off: false };

/**
 * Study mode On / Off / Inherit for a module, section or lesson, in the
 * selected-entity side panel. Shows the saved value only, so a failed save
 * simply leaves the old choice selected (with a toast).
 */
export function StudyModePanel({
  level,
  state,
  isPending,
  save,
}: {
  level: 'module' | 'section' | 'lesson';
  state: StudyModeState;
  isPending: boolean;
  save: (studyModeEnabled: boolean | null) => Promise<unknown>;
}) {
  const current: Choice = state.own === null ? 'inherit' : state.own ? 'on' : 'off';
  const onOff = (v: boolean) => (v ? 'on' : 'off');
  const summary = state.isInherited
    ? `Study mode ${onOff(state.effective)} (inherited)`
    : `Study mode ${onOff(state.effective)} for this ${level}`;

  const choose = async (next: string) => {
    if (next === current || !(next in VALUE)) return;
    try {
      await save(VALUE[next as Choice]);
    } catch (error) {
      toast.error(`Study mode wasn’t saved: ${(error as Error).message}`);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <Label className="text-sm font-medium leading-none">Study mode</Label>
        <p className="text-xs text-muted-foreground">
          {summary}. {state.effective ? 'Students may watch it on any device, without progress.' : 'Strict mode only, on a computer.'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-label="Saving" />}
        <Select value={current} onValueChange={choose} disabled={isPending}>
          <SelectTrigger className="w-[150px]" aria-label={`Study mode for this ${level}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">Inherit ({onOff(state.inherited)})</SelectItem>
            <SelectItem value="on">On</SelectItem>
            <SelectItem value="off">Off</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
