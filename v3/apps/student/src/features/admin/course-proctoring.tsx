import {
  CameraIcon,
  EarIcon,
  FastForwardIcon,
  FocusIcon,
  HandIcon,
  ImageOffIcon,
  ListOrderedIcon,
  MousePointerClickIcon,
  ScanFaceIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { useCourseSettings } from '@/features/learn/queries';
import { cn } from '@/lib/utils';

import { useUpdateCourseSettings } from './queries';
import { ErrorText } from './studio-ui';

/** Mirrors the backend's ProctoringComponent enum order exactly (ISettingRepository.ts). */
export const DETECTORS: { key: string; label: string; description: string; icon: LucideIcon; implemented: boolean }[] = [
  { key: 'cameraMic', label: 'Camera and microphone', description: 'Students must keep both on for the whole lesson.', icon: CameraIcon, implemented: true },
  { key: 'blurDetection', label: 'Blur detection', description: 'Flags a blurry or covered camera.', icon: FocusIcon, implemented: true },
  { key: 'faceCountDetection', label: 'Face count', description: 'Flags when no face, or more than one, is in view.', icon: UsersRoundIcon, implemented: true },
  { key: 'handGestureDetection', label: 'Hand gestures', description: 'Flags hand signals held up to the camera.', icon: HandIcon, implemented: true },
  { key: 'voiceDetection', label: 'Voice detection', description: 'Flags talking during the lesson.', icon: EarIcon, implemented: true },
  { key: 'virtualBackgroundDetection', label: 'Virtual background', description: 'Not available yet.', icon: ImageOffIcon, implemented: false },
  { key: 'rightClickDisabled', label: 'Disable right-click', description: 'Blocks the right-click menu inside lessons.', icon: MousePointerClickIcon, implemented: true },
  { key: 'faceRecognition', label: 'Face recognition', description: 'Checks the person on camera is the registered student.', icon: ScanFaceIcon, implemented: true },
];

/** Per-course detector and progression switches, laid out like Luma's registration settings. */
export function CourseProctoring({ courseId, versionId }: { courseId: string; versionId: string }) {
  const settings = useCourseSettings(courseId, versionId);
  const update = useUpdateCourseSettings(courseId, versionId);
  const [toggles, setToggles] = useState<Record<string, boolean> | null>(null);
  const [linearToggle, setLinearToggle] = useState<boolean | null>(null);
  const [seekForwardToggle, setSeekForwardToggle] = useState<boolean | null>(null);

  const saved = Object.fromEntries(
    DETECTORS.map((d) => [d.key, settings.data?.settings.proctors?.detectors?.find((c) => c.detectorName === d.key)?.settings.enabled ?? false]),
  );
  const current = toggles ?? saved;

  const savedLinear = settings.data?.settings.linearProgressionEnabled !== false;
  const currentLinear = linearToggle ?? savedLinear;

  const savedSeekForward = settings.data?.settings.seekForwardEnabled ?? false;
  const currentSeekForward = seekForwardToggle ?? savedSeekForward;

  const dirty =
    DETECTORS.some((d) => current[d.key] !== saved[d.key]) ||
    currentLinear !== savedLinear ||
    currentSeekForward !== savedSeekForward;
  const enabledCount = DETECTORS.filter((d) => current[d.key]).length;

  function save() {
    if (!settings.data) return;
    const { proctors: _proctors, ...rest } = settings.data.settings;
    update.mutate(
      {
        ...rest,
        linearProgressionEnabled: currentLinear,
        seekForwardEnabled: currentSeekForward,
        detectors: DETECTORS.map((d) => ({ detectorName: d.key, settings: { enabled: current[d.key] ?? false } })),
      },
      {
        onSuccess: () => {
          setToggles(null);
          setLinearToggle(null);
          setSeekForwardToggle(null);
          toast.success('Course settings saved.');
        },
      },
    );
  }

  function discard() {
    setToggles(null);
    setLinearToggle(null);
    setSeekForwardToggle(null);
  }

  if (settings.isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (settings.isError) return <ErrorText error={settings.error} />;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h3 className="text-base font-semibold">Course progression</h3>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <li>
            <label
              htmlFor="linear-progression-toggle"
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30"
            >
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-xl',
                  currentLinear ? 'bg-blush text-blush-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                <ListOrderedIcon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Linear course progression</span>
                <span className="block text-sm text-muted-foreground">
                  Students must follow lessons and modules sequentially. When off, students can access lessons out of order, and modules can be reordered in Content.
                </span>
              </span>
              <Switch
                id="linear-progression-toggle"
                checked={currentLinear}
                onCheckedChange={(c) => setLinearToggle(c === true)}
              />
            </label>
          </li>
          <li>
            <label
              htmlFor="seek-forward-toggle"
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30"
            >
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-xl',
                  currentSeekForward ? 'bg-blush text-blush-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                <FastForwardIcon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Fast-forward in videos</span>
                <span className="block text-sm text-muted-foreground">
                  Allow students to seek and scrub forward through video lessons without watching in real time.
                </span>
              </span>
              <Switch
                id="seek-forward-toggle"
                checked={currentSeekForward}
                onCheckedChange={(c) => setSeekForwardToggle(c === true)}
              />
            </label>
          </li>
        </ul>
      </div>

      <div className="grid gap-3">
        <h3 className="text-base font-semibold">Proctoring checks</h3>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/60 px-5 py-4">
          <div>
            <p className="font-medium">{enabledCount === 0 ? 'Proctoring is off' : `${enabledCount} of ${DETECTORS.filter((d) => d.implemented).length} checks on`}</p>
            <p className="text-sm text-muted-foreground">Checks run only in strict mode, where progress counts towards the certificate. Study mode is never proctored.</p>
          </div>
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {DETECTORS.map((d) => (
            <li key={d.key}>
              <label
                htmlFor={`detector-${d.key}`}
                className={cn('flex items-center gap-4 px-5 py-4', d.implemented ? 'cursor-pointer hover:bg-muted/30' : 'opacity-60')}
              >
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', current[d.key] ? 'bg-blush text-blush-foreground' : 'bg-muted text-muted-foreground')}>
                  <d.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{d.label}</span>
                  <span className="block text-sm text-muted-foreground">{d.description}</span>
                </span>
                <Switch
                  id={`detector-${d.key}`}
                  checked={current[d.key] ?? false}
                  disabled={!d.implemented}
                  onCheckedChange={(c) => setToggles({ ...current, [d.key]: c === true })}
                />
              </label>
            </li>
          ))}
        </ul>
      </div>

      {(dirty || update.isError) && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-5 py-3 shadow-lg backdrop-blur">
          {update.isError ? <ErrorText error={update.error} /> : <p className="text-sm text-muted-foreground">You have unsaved changes.</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={discard} disabled={update.isPending}>
              Discard
            </Button>
            <Button onClick={save} disabled={update.isPending || !dirty}>
              {update.isPending && <Spinner className="size-4" />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
