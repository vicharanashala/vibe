import { CheckCircle2Icon, CopyIcon, InfoIcon, RotateCcwIcon, TriangleAlertIcon, XCircleIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';

import { formatReport, runDiagnostics, type CheckResult, type CheckStatus } from './diagnostics';
import { FixMenu, type FixActions } from './proctoring-setup';

const STATUS_LABEL: Record<CheckStatus, string> = { pass: 'Passed', warn: 'Warning', fail: 'Problem', info: 'Info' };

function ResultIcon({ status }: { status: CheckStatus }) {
  const label = STATUS_LABEL[status];
  if (status === 'pass') return <CheckCircle2Icon className="text-emerald-600" aria-label={label} />;
  if (status === 'fail') return <XCircleIcon className="text-destructive" aria-label={label} />;
  if (status === 'warn') return <TriangleAlertIcon className="text-amber-600" aria-label={label} />;
  return <InfoIcon className="text-muted-foreground" aria-label={label} />;
}

/** Runs the device checks, shows each result as it arrives, and offers the report and fixes. */
export function DiagnosticsPanel({ actions }: { actions: FixActions }) {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const run = useRef(0);

  const start = useCallback(async () => {
    const id = ++run.current;
    setResults([]);
    setRunning(true);
    for await (const result of runDiagnostics()) {
      if (id !== run.current) return; // A newer run started.
      setResults((rs) => [...rs, result]);
    }
    if (id === run.current) setRunning(false);
  }, []);

  useEffect(() => {
    void start();
    return () => {
      run.current += 1;
    };
  }, [start]);

  const problems = results.filter((r) => r.status === 'fail').length;
  const warnings = results.filter((r) => r.status === 'warn').length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatReport(results));
      toast.success('Report copied. Paste it into your message to support.');
    } catch {
      toast.error('Couldn’t copy the report. Select the results and copy them instead.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {running
          ? 'Checking your device…'
          : problems
            ? `Found ${problems} problem${problems === 1 ? '' : 's'}${warnings ? ` and ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}. Each one says how to fix it.`
            : warnings
              ? `No problems found, but ${warnings} warning${warnings === 1 ? '' : 's'}.`
              : 'No problems found.'}
      </p>
      <ItemGroup className="gap-2" aria-label="Diagnostics results">
        {results.map((r) => (
          <Item key={r.id} size="sm" variant="outline" role="listitem" aria-label={r.label}>
            <ItemMedia variant="icon">
              <ResultIcon status={r.status} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{r.label}</ItemTitle>
              <ItemDescription>{r.detail}</ItemDescription>
              {r.fix && <p className="text-sm font-medium">{r.fix}</p>}
            </ItemContent>
          </Item>
        ))}
        {running && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Spinner /> Running the remaining checks…
          </div>
        )}
      </ItemGroup>
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} disabled={running}>
          <CopyIcon /> Copy report
        </Button>
        <Button variant="outline" onClick={() => void start()} disabled={running}>
          <RotateCcwIcon /> Run again
        </Button>
        <FixMenu actions={actions} label="Fixes" />
      </div>
      <p className="text-xs text-muted-foreground">
        These checks run only in your browser. Nothing is sent to ViBe, and the camera and microphone aren’t opened.
      </p>
    </div>
  );
}

/** The diagnostics, opened from the setup checklist without leaving the lesson. */
export function DiagnosticsSheet({ open, onOpenChange, actions }: { open: boolean; onOpenChange: (open: boolean) => void; actions: FixActions }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Check my device</SheetTitle>
          <SheetDescription>Finds what’s stopping proctoring from starting, and how to fix it.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{open && <DiagnosticsPanel actions={actions} />}</div>
      </SheetContent>
    </Sheet>
  );
}
