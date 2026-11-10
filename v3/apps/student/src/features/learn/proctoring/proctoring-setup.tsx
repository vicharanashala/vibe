import {
  CameraIcon,
  CheckCircle2Icon,
  ClockIcon,
  EllipsisIcon,
  MicIcon,
  RotateCcwIcon,
  ScanFaceIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

import { describeCameraIssue, type CameraIssue, type CameraState } from '../camera-presence';
import { progressPercent, progressText } from './format';
import type { Readiness } from './readiness';

export type EntryState = 'waiting' | 'checking' | 'downloading' | 'stalled' | 'starting' | 'ready' | 'failed';

/** One line of the setup checklist: the camera, the microphone, or a check's model. */
export interface SetupEntry {
  id: string;
  label: string;
  icon: ReactNode;
  state: EntryState;
  /** What to show under the label. */
  detail: string;
  /** Download progress, while downloading. */
  progress?: { received: number; total: number | null };
  /** Loaded from the device instead of the network. */
  fromCache?: boolean;
  onRetry?: () => void;
}

function sentence(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

/** Camera and (when the lesson uses it) microphone entries. */
export function deviceEntries(
  camera: { state: CameraState; reason: CameraIssue | null; retry: () => void },
  withMicrophone: boolean,
): SetupEntry[] {
  const entry = (device: 'camera' | 'microphone'): SetupEntry => {
    const base = {
      id: device,
      label: device === 'camera' ? 'Camera' : 'Microphone',
      icon: device === 'camera' ? <CameraIcon /> : <MicIcon />,
    };
    if (camera.state === 'on') return { ...base, state: 'ready', detail: 'On' };
    if (camera.state === 'starting') return { ...base, state: 'checking', detail: 'Waiting for your browser to allow access…' };
    const issue = camera.reason ?? { problem: camera.state === 'denied' ? 'denied' : 'unknown', device: 'both' };
    // Only the device the problem is about fails; the other just waits for it.
    if (issue.device !== 'both' && issue.device !== device) return { ...base, state: 'waiting', detail: 'Waiting for the other device' };
    const { title, fix } = describeCameraIssue({ ...issue, device });
    return { ...base, state: 'failed', detail: `${title}. ${fix}`, onRetry: camera.retry };
  };
  return withMicrophone ? [entry('camera'), entry('microphone')] : [entry('camera')];
}

/** A proctoring check that downloads a model. */
export function modelEntry(id: string, label: string, readiness: Readiness, retry: () => void): SetupEntry {
  const base = { id, label, icon: <ScanFaceIcon />, fromCache: readiness.fromCache, onRetry: retry };
  const percent = progressPercent(readiness);
  const amount = `${progressText(readiness)}${percent === null ? '' : ` · ${percent}%`}`;
  switch (readiness.state) {
    case 'idle':
      return { ...base, state: 'waiting', detail: 'Waiting', onRetry: undefined };
    case 'checking':
      return { ...base, state: 'checking', detail: 'Checking this device…', onRetry: undefined };
    case 'downloading':
      return { ...base, state: 'downloading', detail: `Downloading: ${amount}`, progress: readiness, onRetry: undefined };
    case 'stalled':
      return {
        ...base,
        state: 'stalled',
        detail: `Stalled: nothing received for 20 seconds (${amount}). It will carry on if data starts arriving.`,
        progress: readiness,
      };
    case 'starting':
      return {
        ...base,
        state: 'starting',
        detail: readiness.fromCache ? 'Saved on this device. Starting…' : 'Downloaded. Starting…',
        onRetry: undefined,
      };
    case 'ready':
      return {
        ...base,
        state: 'ready',
        detail: readiness.fromCache
          ? 'Ready'
          : readiness.saved
            ? 'Ready. Saved on this device for next time'
            : 'Ready. Couldn’t be saved on this device, so it will download again next time',
        onRetry: undefined,
      };
    case 'failed':
      return { ...base, state: 'failed', detail: `Failed: ${sentence(readiness.error ?? 'The check couldn’t start.')}` };
  }
}

function StatusIcon({ state }: { state: EntryState }) {
  if (state === 'ready') return <CheckCircle2Icon className="text-emerald-600" aria-label="Ready" />;
  if (state === 'failed') return <XCircleIcon className="text-destructive" aria-label="Failed" />;
  if (state === 'stalled') return <TriangleAlertIcon className="text-amber-600" aria-label="Stalled" />;
  if (state === 'waiting') return <ClockIcon className="text-muted-foreground" aria-label="Waiting" />;
  return <Spinner aria-label="In progress" />;
}

function EntryRow({ entry }: { entry: SetupEntry }) {
  const percent = entry.progress ? progressPercent(entry.progress) : null;
  return (
    <Item size="sm" variant="outline" role="listitem" aria-label={entry.label}>
      <ItemMedia variant="icon" className="text-muted-foreground">
        {entry.icon}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {entry.label}
          {entry.fromCache && entry.state === 'ready' && <Badge variant="secondary">Saved on this device</Badge>}
        </ItemTitle>
        <ItemDescription className={entry.state === 'failed' ? 'text-destructive' : undefined}>{entry.detail}</ItemDescription>
        {(entry.state === 'downloading' || entry.state === 'stalled') && entry.progress && (
          <Progress className="mt-1.5" value={percent} aria-label={`${entry.label} download`} />
        )}
      </ItemContent>
      <ItemActions>
        <StatusIcon state={entry.state} />
        {entry.onRetry && (entry.state === 'failed' || entry.state === 'stalled') && (
          <Button size="sm" variant="outline" onClick={entry.onRetry}>
            <RotateCcwIcon /> Try again
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}

export interface FixActions {
  /** Delete the saved models and download them again. */
  downloadAgain: () => void;
  /** Delete this app's saved files and offline support, then reload. */
  clearAppFiles: () => void;
  reload: () => void;
}

/** "Download models again", "Clear app files and reload" (confirmed first) and "Reload". */
export function FixMenu({ actions, label = 'More fixes' }: { actions: FixActions; label?: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <EllipsisIcon /> {label}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>If loading keeps failing</DropdownMenuLabel>
            <DropdownMenuItem onClick={actions.downloadAgain}>
              <div>
                <p>Download models again</p>
                <p className="text-xs text-muted-foreground">Deletes the saved proctoring models and fetches them fresh.</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirming(true)}>
              <div>
                <p>Clear app files and reload</p>
                <p className="text-xs text-muted-foreground">Deletes ViBe’s saved app files and offline support. You stay signed in.</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={actions.reload}>Reload the page</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear app files and reload?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes ViBe’s saved app files, saved proctoring models and offline support on this browser, then reloads the page.
              You stay signed in, your settings are kept, and other websites aren’t affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={actions.clearAppFiles}>Clear and reload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Shown over a proctored lesson until the camera, microphone and every model
 * the lesson's checks need are ready. Each line has its own status and retry.
 */
export function ProctoringSetup({
  entries,
  hint,
  actions,
  onRunDiagnostics,
}: {
  entries: SetupEntry[];
  /** What the lesson's proctoring does, shown under the title. */
  hint: string;
  actions: FixActions;
  onRunDiagnostics?: () => void;
}) {
  const needsAttention = entries.some((e) => e.state === 'failed' || e.state === 'stalled');
  return (
    <AlertDialog open>
      <AlertDialogContent className="data-[size=default]:sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogMedia className={needsAttention ? 'text-amber-600' : 'text-sky-600'}>
            {needsAttention ? <TriangleAlertIcon /> : <ShieldCheckIcon />}
          </AlertDialogMedia>
          <AlertDialogTitle>{needsAttention ? 'Something needs your attention' : 'Getting this lesson ready'}</AlertDialogTitle>
          <AlertDialogDescription>{hint}</AlertDialogDescription>
        </AlertDialogHeader>
        <ItemGroup className="gap-2" aria-label="Proctoring setup">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </ItemGroup>
        <AlertDialogFooter>
          {onRunDiagnostics && (
            <Button variant="outline" onClick={onRunDiagnostics}>
              <StethoscopeIcon /> Run diagnostics
            </Button>
          )}
          <FixMenu actions={actions} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
