import { CheckCircle2Icon, CopyIcon, InfoIcon, RotateCcwIcon, TriangleAlertIcon, XCircleIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';

import { formatReport, runDiagnostics, type CheckResult, type CheckStatus } from './diagnostics';
import { MODEL_CHECK_LABELS } from './assets';
import { fixActions } from './fix-actions';
import { EntryRow, FixMenu, modelEntry, type FixActions } from './proctoring-setup';
import { REDOWNLOAD_CHECKS, useModelRedownload } from './redownload';

const STATUS_LABEL: Record<CheckStatus, string> = { pass: 'Passed', warn: 'Warning', fail: 'Problem', info: 'Info' };

function ResultIcon({ status }: { status: CheckStatus }) {
  const label = STATUS_LABEL[status];
  if (status === 'pass') return <CheckCircle2Icon className="text-emerald-600" aria-label={label} />;
  if (status === 'fail') return <XCircleIcon className="text-destructive" aria-label={label} />;
  if (status === 'warn') return <TriangleAlertIcon className="text-amber-600" aria-label={label} />;
  return <InfoIcon className="text-muted-foreground" aria-label={label} />;
}

/**
 * Runs the device checks, shows each result as it arrives, and offers the
 * report and fixes. "Download models again" downloads every model right here,
 * with progress, then runs the checks again; `restartChecks` (in a lesson)
 * then restarts the lesson's checks, which load the fresh copies.
 */
export function DiagnosticsPanel({ restartChecks }: { restartChecks?: () => void }) {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const run = useRef(0);
  const redownload = useModelRedownload();
  const downloadsRef = useRef<HTMLElement>(null);

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

  const downloadAgain = useCallback(async () => {
    const { failed } = await redownload.run();
    if (failed) toast.error(`${failed} model${failed === 1 ? '' : 's'} couldn’t be downloaded. See the reasons above.`);
    else toast.success('Models downloaded and saved on this device.');
    restartChecks?.();
    void start();
  }, [redownload, restartChecks, start]);
  // Bring the download progress into view as it starts: the Fixes menu sits below the results.
  const hasDownloads = redownload.progress !== null;
  useEffect(() => {
    if (redownload.running && hasDownloads) downloadsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [redownload.running, hasDownloads]);
  const base = fixActions();
  const actions: FixActions = { ...base, downloadAgain: () => void downloadAgain() };

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
      {redownload.progress && (
        <section ref={downloadsRef} aria-label="Downloading models" className="flex scroll-mt-4 flex-col gap-2">
          <h3 className="text-sm font-medium">{redownload.running ? 'Downloading models again…' : 'Models downloaded again'}</h3>
          <ItemGroup className="gap-2" aria-label="Model downloads">
            {REDOWNLOAD_CHECKS.map((check) => {
              const readiness = redownload.progress?.[check];
              return readiness ? (
                <EntryRow key={check} entry={modelEntry(check, MODEL_CHECK_LABELS[check], readiness, () => void downloadAgain())} />
              ) : null;
            })}
          </ItemGroup>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} disabled={running || redownload.running}>
          <CopyIcon /> Copy report
        </Button>
        <Button variant="outline" onClick={() => void start()} disabled={running || redownload.running}>
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

/**
 * The diagnostics in a side pane, openable from anywhere: the setup checklist,
 * the account menu, the profile page and the lesson header.
 */
export function DiagnosticsSheet({
  open,
  onOpenChange,
  restartChecks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** In a lesson: restart its checks after the models are downloaded again. */
  restartChecks?: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Check my device</SheetTitle>
          <SheetDescription>Finds what’s stopping proctoring from starting, and how to fix it.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{open && <DiagnosticsPanel restartChecks={restartChecks} />}</div>
      </SheetContent>
    </Sheet>
  );
}
