import {
  CameraIcon,
  EarIcon,
  FocusIcon,
  HandIcon,
  ImageOffIcon,
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

/** Per-course detector switches, laid out like Luma's registration settings. */
export function CourseProctoring({ courseId, versionId }: { courseId: string; versionId: string }) {
  const settings = useCourseSettings(courseId, versionId);
  const update = useUpdateCourseSettings(courseId, versionId);
  const [toggles, setToggles] = useState<Record<string, boolean> | null>(null);

  const saved = Object.fromEntries(
    DETECTORS.map((d) => [d.key, settings.data?.settings.proctors?.detectors?.find((c) => c.detectorName === d.key)?.settings.enabled ?? false]),
  );
  const current = toggles ?? saved;
  const dirty = DETECTORS.some((d) => current[d.key] !== saved[d.key]);
  const enabledCount = DETECTORS.filter((d) => current[d.key]).length;

  function save() {
    if (!settings.data) return;
    const { proctors: _proctors, ...rest } = settings.data.settings;
    update.mutate(
      {
        ...rest,
        linearProgressionEnabled: settings.data.settings.linearProgressionEnabled ?? false,
        seekForwardEnabled: settings.data.settings.seekForwardEnabled ?? false,
        detectors: DETECTORS.map((d) => ({ detectorName: d.key, settings: { enabled: current[d.key] ?? false } })),
      },
      {
        onSuccess: () => {
          setToggles(null);
          toast.success('Proctoring settings saved.');
        },
      },
    );
  }

  if (settings.isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (settings.isError) return <ErrorText error={settings.error} />;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/60 px-5 py-4">
        <div>
          <p className="font-medium">{enabledCount === 0 ? 'Proctoring is off' : `${enabledCount} of ${DETECTORS.filter((d) => d.implemented).length} checks on`}</p>
          <p className="text-sm text-muted-foreground">Checks run only in Certified mode, where progress counts towards the certificate.</p>
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

      {(dirty || update.isError) && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-5 py-3 shadow-lg backdrop-blur">
          {update.isError ? <ErrorText error={update.error} /> : <p className="text-sm text-muted-foreground">You have unsaved changes.</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setToggles(null)} disabled={update.isPending}>
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
