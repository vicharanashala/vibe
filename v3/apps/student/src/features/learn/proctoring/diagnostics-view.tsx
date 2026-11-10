import {
  CameraIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  HardDriveIcon,
  InfoIcon,
  LockIcon,
  MonitorIcon,
  RotateCcwIcon,
  StethoscopeIcon,
  TriangleAlertIcon,
  WrenchIcon,
  XCircleIcon,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ItemGroup } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { easeOut, popIn, rowIn, still } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { MODEL_CHECK_LABELS, MODEL_HOSTS } from './assets';
import { formatReport, runDiagnostics, type CheckResult, type CheckStatus } from './diagnostics';
import { fixActions } from './fix-actions';
import { EntryRow, FixMenu, modelEntry, type FixActions } from './proctoring-setup';
import { REDOWNLOAD_CHECKS, useModelRedownload } from './redownload';

const STATUS_LABEL: Record<CheckStatus, string> = { pass: 'Passed', warn: 'Warning', fail: 'Problem', info: 'Info' };
/** Problems first, then warnings, then the rest, so what needs doing is at the top. */
const STATUS_ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, info: 2, pass: 3 };
/** How many results a full run yields: browser 6, devices 2, storage 3, plus one per model host. */
const EXPECTED_RESULTS = 11 + MODEL_HOSTS.length;

interface Group {
  id: string;
  title: string;
  icon: LucideIcon;
  has: (id: string) => boolean;
}

const GROUPS: Group[] = [
  { id: 'browser', title: 'Browser', icon: MonitorIcon, has: (id) => ['browser', 'secure', 'wasm', 'webgl', 'workers', 'audio'].includes(id) },
  { id: 'devices', title: 'Camera & microphone', icon: CameraIcon, has: (id) => id === 'camera' || id === 'microphone' },
  { id: 'network', title: 'Connection to model servers', icon: GlobeIcon, has: (id) => id.startsWith('host-') },
  { id: 'storage', title: 'Storage & saved models', icon: HardDriveIcon, has: (id) => ['storage', 'saved-models', 'app-files'].includes(id) },
];

const TONE: Record<CheckStatus, string> = {
  pass: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  fail: 'text-destructive',
  info: 'text-muted-foreground',
};

function ResultIcon({ status, className }: { status: CheckStatus; className?: string }) {
  const props = { className: cn(TONE[status], className), 'aria-label': STATUS_LABEL[status] };
  if (status === 'pass') return <CheckCircle2Icon {...props} />;
  if (status === 'fail') return <XCircleIcon {...props} />;
  if (status === 'warn') return <TriangleAlertIcon {...props} />;
  return <InfoIcon {...props} />;
}

/** A group's overall status: its worst result, with info-only rows counting as fine. */
function worst(results: CheckResult[]): CheckStatus | null {
  if (!results.length) return null;
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'warn')) return 'warn';
  return 'pass';
}

/** "1 problem", "2 warnings", "All good" — the badge on a group's card. */
function groupBadge(results: CheckResult[]): { label: string; className: string } {
  const fails = results.filter((r) => r.status === 'fail').length;
  const warns = results.filter((r) => r.status === 'warn').length;
  if (fails) return { label: `${fails} problem${fails === 1 ? '' : 's'}`, className: 'bg-destructive/10 text-destructive' };
  if (warns) return { label: `${warns} warning${warns === 1 ? '' : 's'}`, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' };
  return { label: 'All good', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' };
}

/** Pops a status icon in whenever the status it shows changes. */
function PopIcon({ status, className }: { status: CheckStatus; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={status} className="inline-flex" variants={reduce ? still : popIn} initial="hidden" animate="shown" exit="hidden">
        <ResultIcon status={status} className={className} />
      </motion.span>
    </AnimatePresence>
  );
}

function ResultRow({ result }: { result: CheckResult }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="listitem"
      aria-label={result.label}
      className="flex gap-3 px-4 py-3"
      variants={reduce ? still : rowIn}
      initial="hidden"
      animate="shown"
    >
      <motion.span className="mt-0.5 inline-flex shrink-0" variants={reduce ? still : popIn} initial="hidden" animate="shown">
        <ResultIcon status={result.status} className="size-4" />
      </motion.span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{result.label}</p>
        <p className="text-sm text-muted-foreground">{result.detail}</p>
        {result.fix && (
          <p
            className={cn(
              'mt-2 flex gap-2 rounded-lg px-3 py-2 text-sm',
              result.status === 'fail' ? 'bg-destructive/10 text-foreground' : 'bg-amber-500/10 text-foreground',
            )}
          >
            <WrenchIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>{result.fix}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Runs the device checks and shows them as a summary plus one card per area
 * (browser, devices, servers, storage), problems first, each with its fix.
 * "Download models again" downloads every model right here, with progress,
 * then runs the checks again; `restartChecks` (in a lesson) then restarts the
 * lesson's checks, which load the fresh copies.
 */
export function DiagnosticsPanel({ restartChecks }: { restartChecks?: () => void }) {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const run = useRef(0);
  const redownload = useModelRedownload();
  const downloadsRef = useRef<HTMLElement>(null);
  const groupRefs = useRef<Record<string, HTMLElement | null>>({});
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);

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
  // Bring the download progress into view as it starts.
  const hasDownloads = redownload.progress !== null;
  useEffect(() => {
    if (redownload.running && hasDownloads) downloadsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [redownload.running, hasDownloads]);
  const actions: FixActions = { ...fixActions(), downloadAgain: () => void downloadAgain() };

  const problems = results.filter((r) => r.status === 'fail').length;
  const warnings = results.filter((r) => r.status === 'warn').length;
  const overall: CheckStatus = running ? 'info' : problems ? 'fail' : warnings ? 'warn' : 'pass';
  const percent = Math.min(100, Math.round((results.length / EXPECTED_RESULTS) * 100));
  const groups = GROUPS.map((g) => ({
    ...g,
    results: results.filter((r) => g.has(r.id)).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
  })).sort((a, b) => STATUS_ORDER[worst(a.results) ?? 'pass'] - STATUS_ORDER[worst(b.results) ?? 'pass']);

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatReport(results));
      toast.success('Report copied. Paste it into your message to support.');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Couldn’t copy the report. Select the results and copy them instead.');
    }
  }

  const headline = running
    ? 'Checking your device…'
    : problems
      ? `${problems + warnings} thing${problems + warnings === 1 ? '' : 's'} need${problems + warnings === 1 ? 's' : ''} your attention`
      : warnings
        ? 'Mostly good'
        : 'Your device is ready';
  const subline = running
    ? `Running checks… ${results.length} of ${EXPECTED_RESULTS}`
    : problems
      ? `Found ${problems} problem${problems === 1 ? '' : 's'}${warnings ? ` and ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}. Each one says how to fix it.`
      : warnings
        ? `No problems found, but ${warnings} warning${warnings === 1 ? '' : 's'}.`
        : 'No problems found.';

  return (
    <div className="flex flex-col gap-5">
      {/* Summary */}
      <section
        aria-label="Summary"
        className={cn(
          'flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:p-5',
          overall === 'fail' && 'border-destructive/30 bg-destructive/5',
          overall === 'warn' && 'border-amber-500/30 bg-amber-500/5',
          overall === 'pass' && 'border-emerald-500/30 bg-emerald-500/5',
        )}
      >
        <span
          className={cn(
            'grid size-14 shrink-0 place-items-center rounded-2xl',
            overall === 'fail' && 'bg-destructive/10',
            overall === 'warn' && 'bg-amber-500/15',
            overall === 'pass' && 'bg-emerald-500/15',
            overall === 'info' && 'bg-muted',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={running ? 'running' : overall}
              className="relative inline-flex"
              variants={reduce ? still : popIn}
              initial="hidden"
              animate="shown"
              exit="hidden"
            >
              {running ? <Spinner className="size-6" /> : <ResultIcon status={overall} className="size-7" />}
              {/* One soft ring when everything passes. */}
              {!running && overall === 'pass' && !reduce && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full ring-2 ring-emerald-500"
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.8 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
              )}
            </motion.span>
          </AnimatePresence>
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="font-aleo text-xl tracking-tight">{headline}</p>
          <p className="text-sm text-muted-foreground">{subline}</p>
          <AnimatePresence initial={false}>
            {running && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={easeOut}>
                <Progress
                  className="mt-2 [&_[data-slot=progress-indicator]]:transition-all [&_[data-slot=progress-indicator]]:duration-300"
                  value={percent}
                  aria-label="Checks progress"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Button variant="outline" onClick={() => void start()} disabled={running || redownload.running}>
          <RotateCcwIcon /> Run again
        </Button>
      </section>

      <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
        {/* Jump list (wider screens) */}
        <nav aria-label="Check areas" className="hidden md:block">
          <ul className="sticky top-0 flex flex-col gap-1">
            {groups.map((g) => {
              const status = worst(g.results);
              const Icon = g.icon;
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => groupRefs.current[g.id]?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex-1 leading-snug">{g.title}</span>
                    {status ? <PopIcon status={status} className="size-3.5" /> : <Spinner className="size-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Results, one card per area */}
        <div role="list" aria-label="Diagnostics results" className="flex min-w-0 flex-col gap-4">
          {groups.map((g) => {
            const Icon = g.icon;
            const badge = groupBadge(g.results);
            return (
              <motion.section
                key={g.id}
                layout={!reduce}
                transition={easeOut}
                ref={(el) => {
                  groupRefs.current[g.id] = el;
                }}
                aria-label={g.title}
                className="scroll-mt-2 overflow-hidden rounded-2xl border bg-card"
              >
                <header className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="flex-1 font-medium">{g.title}</h3>
                  {g.results.length ? (
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span key={badge.label} variants={reduce ? still : popIn} initial="hidden" animate="shown" exit="hidden">
                        <Badge variant="secondary" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </motion.span>
                    </AnimatePresence>
                  ) : (
                    <Spinner className="size-4" aria-label="Checking" />
                  )}
                </header>
                <div className="divide-y">
                  {g.results.map((r) => (
                    <ResultRow key={r.id} result={r} />
                  ))}
                  {!g.results.length && <p className="px-4 py-3 text-sm text-muted-foreground">Checking…</p>}
                </div>
              </motion.section>
            );
          })}

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
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          These checks run only in your browser. Nothing is sent to ViBe, and the camera and microphone aren’t opened.
        </p>
        <div className="flex shrink-0 gap-2">
          <FixMenu actions={actions} label="Fixes" />
          <Button onClick={copy} disabled={running || redownload.running}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={copied ? 'done' : 'copy'} className="inline-flex" variants={reduce ? still : popIn} initial="hidden" animate="shown" exit="hidden">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </motion.span>
            </AnimatePresence>
            {copied ? 'Copied' : 'Copy report'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * "Check my device" as a centred dialog, openable from anywhere: the setup
 * checklist, the account menu, the profile page and the lesson header.
 */
export function DiagnosticsDialog({
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-4xl">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <StethoscopeIcon className="size-5" aria-hidden />
          </span>
          <div>
            <DialogTitle className="font-aleo text-2xl tracking-tight">Check my device</DialogTitle>
            <DialogDescription>Finds what could stop proctored lessons from starting, and how to fix it.</DialogDescription>
          </div>
        </DialogHeader>
        {open && <DiagnosticsPanel restartChecks={restartChecks} />}
      </DialogContent>
    </Dialog>
  );
}
