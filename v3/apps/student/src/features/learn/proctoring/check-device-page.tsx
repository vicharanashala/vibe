import { StethoscopeIcon } from 'lucide-react';

import { DiagnosticsPanel } from './diagnostics-view';
import { fixActions } from './fix-actions';

/** "Check my device": the proctoring diagnostics, available any time from the profile. */
export function CheckDevicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <StethoscopeIcon className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-aleo text-3xl tracking-tight">Check my device</h1>
          <p className="text-sm text-muted-foreground">Finds what could stop proctored lessons from starting, and how to fix it.</p>
        </div>
      </div>
      <div className="mt-6">
        <DiagnosticsPanel actions={fixActions()} />
      </div>
    </div>
  );
}
