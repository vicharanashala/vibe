import { Link } from '@tanstack/react-router';
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CircleIcon, LockIcon, ShieldCheckIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { buttonVariants } from '@/components/ui/button';
import { TrackBadge } from '@/features/learn/lesson-page';
import { useCourseSettings } from '@/features/learn/queries';
import { TRACKS, useCourseTrack, type Track } from '@/features/learn/tracks';
import { cn } from '@/lib/utils';

import { CourseCover, ProgressBar, itemTypeMeta } from './course-ui';
import { CourseSwitcher } from './course-switcher';
import {
  useCourseVersion,
  useCurrentPath,
  useEnrollments,
  useEthicsConsent,
  useModuleProgress,
  useProgressPercentage,
  useSectionItems,
  visibleInOrder,
  type CourseModule,
  type CurrentPath,
} from './queries';

export function CoursePage({ courseId, versionId }: { courseId: string; versionId: string }) {
  const version = useCourseVersion(versionId);
  const percentage = useProgressPercentage(courseId, versionId);
  const path = useCurrentPath(courseId, versionId);
  const moduleProgress = useModuleProgress(courseId, versionId);
  const consent = useEthicsConsent(courseId, versionId);
  const settings = useCourseSettings(courseId, versionId);
  const [track, setTrack] = useCourseTrack(versionId);
  // In linear courses the backend serves only lessons already reached (blue can't skip ahead).
  const linear = settings.data?.settings.linearProgressionEnabled ?? true;
  // The course name/description live on the enrolment, not the version.
  const enrollment = useEnrollments('active').data?.enrollments.find((e) => e.courseVersionId === versionId);

  if (version.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="mt-8 h-64" />
      </div>
    );
  }
  if (version.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          We couldn’t load this course. {version.error.message}
        </p>
      </div>
    );
  }

  const modules = visibleInOrder(version.data.modules);
  const pct = percentage.data?.percentCompleted ?? 0;
  const totalItems = percentage.data?.totalItems ?? version.data.totalItems ?? 0;
  const name = enrollment?.course.name ?? 'Course';
  const counts = Object.entries(version.data.itemCounts ?? {}).filter(([, n]) => n);

  const next = path.data?.item && path.data.module && path.data.section ? path.data : null;
  const continueLabel = track === 'blue' ? 'Study where you left off' : pct > 0 ? 'Continue where you left off' : 'Start course';
  const continueLink = next && {
    to: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId' as const,
    params: { courseId, versionId, moduleId: next.module!.id, sectionId: next.section!.id, itemId: next.item!.id },
    search: { track },
  };

  return (
    <div
      className={cn(
        'mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 md:py-8 lg:grid-cols-[1fr_300px] lg:py-10',
        // Room for the phone "Continue" bar.
        continueLink && 'pb-24 md:pb-8',
      )}
    >
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
          <Link to="/courses" className="hover:text-foreground">
            My courses
          </Link>
          <ChevronRightIcon className="size-3.5" aria-hidden />
          <span className="truncate text-foreground">{name}</span>
        </nav>
        <CourseSwitcher current={versionId} name={name} className="md:hidden" />

        <p className="mt-6 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Course</p>
        <h1 className="mt-1 font-aleo text-3xl tracking-tight sm:text-4xl">{name}</h1>
        {(enrollment?.course.description || version.data.description) && (
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            {enrollment?.course.description || version.data.description}
          </p>
        )}
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li>{modules.length} modules</li>
          <li>{totalItems} lessons</li>
          {counts.map(([type, n]) => (
            <li key={type}>
              {n} {itemTypeMeta(type).label.toLowerCase()}
              {n === 1 ? '' : 's'}
            </li>
          ))}
        </ul>

        {/* Progress sits up top below lg; the sidebar card shows it on wide screens. */}
        {percentage.data && (
          <div className="mt-5 lg:hidden">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(pct)}% complete</span>
              <span>
                {percentage.data.completedItems} of {percentage.data.totalItems} lessons
              </span>
            </div>
            <ProgressBar value={pct} label="Course progress" />
          </div>
        )}

        {continueLink ? (
          <>
            <Link
              {...continueLink}
              className="mt-6 hidden h-10 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/85 md:inline-flex"
            >
              {continueLabel}
            </Link>
            <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md md:hidden">
              <Link {...continueLink} className={cn(buttonVariants({ size: 'lg' }), 'h-11 w-full')}>
                <span className="min-w-0 truncate">{continueLabel}</span>
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </div>
          </>
        ) : (
          percentage.data?.completed && <p className="mt-6 text-sm font-medium text-emerald-700 dark:text-emerald-400">Course completed</p>
        )}

        <TrackSwitcher track={track} onChange={setTrack} linear={linear} />

        <section aria-labelledby="syllabus-title" className="mt-10 border-t border-border pt-8">
          <h2 id="syllabus-title" className="text-xl font-semibold">
            Syllabus
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {modules.length} modules · {totalItems} lessons
          </p>
          <ol className="mt-6 flex flex-col gap-8">
            {modules.map((m, i) => (
              <ModuleBlock
                key={m.moduleId}
                index={i}
                module={m}
                courseId={courseId}
                versionId={versionId}
                track={track}
                linear={linear}
                currentPath={path.data}
                progress={moduleProgress.data?.find((p) => p.moduleId === m.moduleId)}
              />
            ))}
          </ol>
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start" aria-label="Your progress">
        <div className="hidden rounded-2xl border border-border bg-card p-4 lg:block">
          <CourseCover name={name} seed={courseId} className="h-32 w-full" />
          <p className="mt-4 font-semibold">Your progress</p>
          <ProgressBar value={pct} className="mt-3" label="Course progress" />
          <p className="mt-2 text-sm text-muted-foreground">
            {Math.round(pct)}% complete
            {percentage.data && ` · ${percentage.data.completedItems} of ${percentage.data.totalItems} lessons`}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheckIcon className="size-4 text-primary" aria-hidden />
            Proctoring consent
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {consent.isPending
              ? 'Checking…'
              : consent.data?.signed
                ? `Signed${consent.data.signedAt ? ` on ${new Date(consent.data.signedAt).toLocaleDateString()}` : ''}.`
                : 'Not signed yet. You’ll be asked to read and sign the consent form before your first lesson.'}
          </p>
        </div>
      </aside>
    </div>
  );
}

function ModuleBlock({
  index,
  module: m,
  courseId,
  versionId,
  track,
  linear,
  currentPath,
  progress,
}: {
  index: number;
  module: CourseModule;
  courseId: string;
  versionId: string;
  track: Track;
  linear: boolean;
  currentPath?: CurrentPath;
  progress?: { totalItems: number; completedItems: number };
}) {
  const sections = visibleInOrder(m.sections);
  const pct = progress && progress.totalItems ? (progress.completedItems / progress.totalItems) * 100 : 0;
  const containsCurrent = currentPath?.module?.id === m.moduleId;

  return (
    <li>
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Module {index + 1}</p>
      <div className="mt-1 flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold">{m.name}</h3>
        {progress && (
          <span className="flex shrink-0 items-center gap-2 pt-1 text-xs text-muted-foreground">
            <ProgressBar value={pct} className="w-16" label={`${m.name} progress`} />
            {Math.round(pct)}%
          </span>
        )}
      </div>
      {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
      <div className="mt-4 flex flex-col gap-3">
        {sections.map((s) => (
          <SectionBlock
            key={s.sectionId}
            courseId={courseId}
            versionId={versionId}
            track={track}
            linear={linear}
            moduleId={m.moduleId}
            sectionId={s.sectionId}
            name={s.name}
            defaultOpen={containsCurrent ? currentPath?.section?.id === s.sectionId : index === 0}
            currentItemId={currentPath?.item?.id}
          />
        ))}
      </div>
    </li>
  );
}

function SectionBlock({
  courseId,
  versionId,
  track,
  linear,
  moduleId,
  sectionId,
  name,
  defaultOpen,
  currentItemId,
}: {
  courseId: string;
  versionId: string;
  track: Track;
  linear: boolean;
  moduleId: string;
  sectionId: string;
  name: string;
  defaultOpen: boolean;
  currentItemId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  const items = useSectionItems(versionId, moduleId, sectionId, open);
  const list = visibleInOrder(items.data ?? []);

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
      >
        {name}
        <ChevronDownIcon className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <ul className="flex flex-col gap-2 border-t border-border p-3">
          {items.isPending &&
            Array.from({ length: 2 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-14 rounded-lg" />
              </li>
            ))}
          {items.isError && <li className="px-1 text-sm text-destructive">Couldn’t load these lessons.</li>}
          {list.map((item) => {
            const meta = itemTypeMeta(item.type);
            const Icon = meta.icon;
            const isCurrent = item._id === currentItemId;
            // Linear courses only serve lessons already reached; blue can't open the rest.
            const locked = track === 'blue' && linear && !item.isCompleted && !isCurrent;
            const row = (
              <>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground/80">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{locked ? 'Unlocks in certified mode' : meta.label}</p>
                </div>
                {item.isCompleted ? (
                  <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-white" title="Completed">
                    <CheckIcon className="size-3.5" aria-hidden />
                    <span className="sr-only">Completed</span>
                  </span>
                ) : locked ? (
                  <LockIcon className="size-4 text-muted-foreground/60" aria-label="Locked" />
                ) : !isCurrent ? (
                  <CircleIcon className="size-5 text-muted-foreground/50" aria-label="Not started" />
                ) : null}
              </>
            );
            const rowClass = cn(
              'flex items-center gap-3 rounded-lg border bg-card px-3 py-3',
              isCurrent ? (track === 'blue' ? 'border-sky-500 ring-2 ring-sky-500/30' : 'border-primary ring-2 ring-primary/30') : 'border-border',
            );
            return (
              <li key={item._id} id={isCurrent ? 'up-next' : undefined} className="relative scroll-mt-28">
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-primary">
                    Up next
                  </span>
                )}
                {locked ? (
                  <div className={cn(rowClass, 'opacity-60')}>{row}</div>
                ) : (
                  <Link
                    to="/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId"
                    params={{ courseId, versionId, moduleId, sectionId, itemId: item._id }}
                    search={{ track }}
                    className={cn(rowClass, 'transition-colors hover:border-foreground/25')}
                  >
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Luma-style segmented switch between the two ways through a course. */
function TrackSwitcher({ track, onChange, linear }: { track: Track; onChange: (t: Track) => void; linear: boolean }) {
  return (
    <section aria-labelledby="track-title" className="mt-8 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="track-title" className="font-semibold">
          How do you want to go through this course?
        </h2>
        <div role="radiogroup" aria-label="Mode" className="grid w-full grid-cols-2 rounded-lg bg-muted p-1 sm:inline-flex sm:w-fit">
          {(['green', 'blue'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={track === t}
              onClick={() => onChange(t)}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:py-1.5',
                track === t ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className={cn('size-2 rounded-full', t === 'blue' ? 'bg-sky-500' : 'bg-emerald-500')} aria-hidden />
              {TRACKS[t].label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-start gap-3">
        <TrackBadge track={track} className="shrink-0" />
        <p className="text-sm text-muted-foreground">
          {TRACKS[track].description}
          {track === 'blue' && linear && (
            <> This course opens lessons in order, so study mode covers the lessons you’ve reached in certified mode.</>
          )}
        </p>
      </div>
    </section>
  );
}
