import { Link } from '@tanstack/react-router';
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CircleAlertIcon, CircleIcon, LockIcon, ShieldCheckIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrackBadge } from '@/features/learn/lesson-page';
import { resolveContentLock, type ContentLockNode } from '@/features/content-lock/content-lock';
import { hiddenInStudyMode, itemsForTrack, resolveStudyMode, type StudyModeNode } from '@/features/study-mode/study-mode';
import { TRACKS, useCourseTrack, useFlatSyllabus, type FlatItem, type Track } from '@/features/learn/tracks';
import { cn } from '@/lib/utils';

import { CourseCover, ProgressBar, ProgressMeter, STRICT_PROGRESS_HINT, StudyProgressSummary, itemTypeMeta } from './course-ui';
import { useStudyProgress } from '@/features/learn/queries';
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
  const [track, setTrack] = useCourseTrack(versionId);
  const study = useStudyProgress(courseId, versionId);
  const studied = new Set(study.data?.studiedItemIds ?? []);
  // The course name/description live on the enrolment, not the version.
  const enrollment = useEnrollments('active').data?.enrollments.find((e) => e.courseVersionId === versionId);
  // Study mode hides quizzes; the whole syllabus tells which sections hold
  // only quizzes and what to continue with instead of a quiz.
  const syllabus = useFlatSyllabus(track === 'blue' ? version.data : undefined);

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
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>We couldn’t load this course.</AlertTitle>
          <AlertDescription>{version.error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const modules = visibleInOrder(version.data.modules);
  const pct = percentage.data?.percentCompleted ?? 0;
  const quizCount = version.data.itemCounts?.QUIZ ?? 0;
  const strictTotal = percentage.data?.totalItems ?? version.data.totalItems ?? 0;
  const totalItems = track === 'blue' ? Math.max(0, (version.data.totalItems ?? strictTotal) - quizCount) : strictTotal;
  const name = enrollment?.course.name ?? 'Course';
  const counts = Object.entries(version.data.itemCounts ?? {}).filter(([type, n]) => n && !(track === 'blue' && type === 'QUIZ'));

  // Sections (and modules) with nothing but quizzes don't appear in study mode.
  const hiddenSections = new Set<string>();
  if (track === 'blue' && !syllabus.pending) {
    const bySection = new Map<string, boolean>();
    for (const item of syllabus.items) bySection.set(item.sectionId, (bySection.get(item.sectionId) ?? false) || !hiddenInStudyMode(item));
    for (const [sectionId, hasStudyContent] of bySection) if (!hasStudyContent) hiddenSections.add(sectionId);
  }
  const shownModules = modules.filter((m) => !visibleInOrder(m.sections).length || visibleInOrder(m.sections).some((sec) => !hiddenSections.has(sec.sectionId)));

  const pathNext = path.data?.item && path.data.module && path.data.section ? path.data : null;
  // In study mode, "where you left off" is never a quiz: the next lesson after it instead.
  const next = track === 'blue' && pathNext?.item?.type === 'QUIZ' ? studyContinueTarget(syllabus.items, pathNext.item.id) : pathNext;
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
        continueLink && 'pb-12 md:pb-8',
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
          <li>{shownModules.length} modules</li>
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
          <div className="mt-5 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:hidden">
            <ProgressMeter
              tone="strict"
              label="Strict"
              value={pct}
              ariaLabel="Course progress"
              caption={`${percentage.data.completedItems} of ${percentage.data.totalItems} lessons`}
              hint={STRICT_PROGRESS_HINT}
            />
            <StudyProgressSummary courseId={courseId} versionId={versionId} />
          </div>
        )}

        {continueLink ? (
          <>
            <Link
              {...continueLink}
              className={cn(buttonVariants({ size: 'lg' }), 'mt-6 max-md:hidden')}
            >
              {continueLabel}
            </Link>
            <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 px-4 md:hidden">
              <Link {...continueLink} className={cn(buttonVariants({ size: 'lg' }), 'pointer-events-auto mx-auto flex h-12 w-full max-w-md rounded-full shadow-lg')}>
                <span className="min-w-0 truncate">{continueLabel}</span>
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </div>
          </>
        ) : (
          percentage.data?.completed && <p className="mt-6 text-sm font-medium text-emerald-700 dark:text-emerald-400">Course completed</p>
        )}

        <TrackSwitcher track={track} onChange={setTrack} />

        <section aria-labelledby="syllabus-title" className="mt-10 border-t border-border pt-8">
          <h2 id="syllabus-title" className="text-xl font-semibold">
            Syllabus
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {shownModules.length} modules · {totalItems} lessons
          </p>
          <ol className="mt-6 flex flex-col gap-8">
            {shownModules.map((m, i) => (
              <ModuleBlock
                key={m.moduleId}
                index={i}
                module={m}
                courseId={courseId}
                versionId={versionId}
                track={track}
                studied={studied}
                currentPath={track === 'blue' ? (next ?? undefined) : path.data}
                hiddenSections={hiddenSections}
                progress={moduleProgress.data?.find((p) => p.moduleId === m.moduleId)}
              />
            ))}
          </ol>
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start" aria-label="Your progress">
        <Card size="sm" className="max-lg:hidden">
          <CardContent>
            <CourseCover name={name} seed={courseId} className="h-32 w-full" />
            <p className="mt-4 font-semibold">Your progress</p>
            <div className="mt-3 grid gap-4">
              <ProgressMeter
                tone="strict"
                label="Strict"
                value={pct}
                ariaLabel="Course progress"
                caption={percentage.data ? `${percentage.data.completedItems} of ${percentage.data.totalItems} lessons` : undefined}
                hint={STRICT_PROGRESS_HINT}
              />
              <StudyProgressSummary courseId={courseId} versionId={versionId} className="border-t border-border pt-4" />
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-primary" aria-hidden />
              Proctoring consent
            </CardTitle>
            <CardDescription>
              {consent.isPending
                ? 'Checking…'
                : consent.data?.signed
                  ? `Signed${consent.data.signedAt ? ` on ${new Date(consent.data.signedAt).toLocaleDateString()}` : ''}.`
                  : 'Not signed yet. You’ll be asked to read and sign the consent form before your first lesson.'}
            </CardDescription>
          </CardHeader>
        </Card>
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
  studied,
  currentPath,
  hiddenSections,
  progress,
}: {
  index: number;
  module: CourseModule;
  courseId: string;
  versionId: string;
  track: Track;
  studied: Set<string>;
  currentPath?: CurrentPath;
  /** Sections not shown in this track (study mode: sections with only quizzes). */
  hiddenSections: Set<string>;
  progress?: { totalItems: number; completedItems: number };
}) {
  const sections = visibleInOrder(m.sections).filter((s) => !hiddenSections.has(s.sectionId));
  const pct = progress && progress.totalItems ? (progress.completedItems / progress.totalItems) * 100 : 0;
  const containsCurrent = currentPath?.module?.id === m.moduleId;

  return (
    <li>
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Module {index + 1}</p>
      <div className="mt-1 flex items-start justify-between gap-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          {m.name}
          {resolveContentLock(undefined, undefined, m).locked && (
            <LockIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Locked by your instructor" />
          )}
        </h3>
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
            studied={studied}
            moduleId={m.moduleId}
            sectionId={s.sectionId}
            studyParents={{ module: m, section: s }}
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
  studied,
  moduleId,
  sectionId,
  studyParents,
  name,
  defaultOpen,
  currentItemId,
}: {
  courseId: string;
  versionId: string;
  track: Track;
  /** Lessons that count towards study progress (studied, or completed in strict mode). */
  studied: Set<string>;
  moduleId: string;
  sectionId: string;
  /** The section and module, for resolving each item's study-mode setting. */
  studyParents: { module: StudyModeNode & ContentLockNode; section: StudyModeNode & ContentLockNode };
  name: string;
  defaultOpen: boolean;
  currentItemId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  const items = useSectionItems(versionId, moduleId, sectionId, open);
  const list = itemsForTrack(visibleInOrder(items.data ?? []), track);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border">
      <CollapsibleTrigger
        render={<Button variant="ghost" className="h-auto w-full justify-between gap-3 rounded-xl px-4 py-3 text-left whitespace-normal" />}
      >
        <span className="flex min-w-0 items-center gap-2">
          {name}
          {resolveContentLock(undefined, studyParents.section, studyParents.module).locked && (
            <LockIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Locked by your instructor" />
          )}
        </span>
        <ChevronDownIcon className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
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
            // Study mode ignores linear order, but can't open quizzes or content
            // the instructor has made strict-only; those link to strict mode.
            const strictOnly =
              track === 'blue' &&
              (item.type === 'QUIZ' || !resolveStudyMode(item, studyParents.section, studyParents.module).allowed);
            const locked = resolveContentLock(item, studyParents.section, studyParents.module).locked;
            const row = (
              <>
                <ItemMedia variant="icon">
                  <Icon aria-hidden />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full truncate">{item.name}</ItemTitle>
                  <ItemDescription>
                    {locked
                      ? `${meta.label} · Locked by your instructor`
                      : strictOnly
                        ? `${meta.label} · Strict mode only`
                        : meta.label}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                {locked && <LockIcon className="size-4 text-muted-foreground" aria-label="Locked by your instructor" />}
                {item.isCompleted ? (
                  <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-white" title="Completed">
                    <CheckIcon className="size-3.5" aria-hidden />
                    <span className="sr-only">Completed</span>
                  </span>
                ) : track === 'blue' && studied.has(item._id) ? (
                  <span className="grid size-6 place-items-center rounded-full bg-sky-500 text-white" title="Studied">
                    <CheckIcon className="size-3.5" aria-hidden />
                    <span className="sr-only">Studied</span>
                  </span>
                ) : locked ? null : strictOnly ? (
                  <LockIcon className="size-4 text-muted-foreground/60" aria-label="Strict mode only" />
                ) : !isCurrent ? (
                  <CircleIcon className="size-5 text-muted-foreground/50" aria-label="Not started" />
                ) : null}
                </ItemActions>
              </>
            );
            const rowClass = cn(
              'bg-card',
              isCurrent && (track === 'blue' ? 'border-sky-500 ring-2 ring-sky-500/30' : 'border-primary ring-2 ring-primary/30'),
            );
            return (
              <li key={item._id} id={isCurrent ? 'up-next' : undefined} className="relative scroll-mt-28">
                {isCurrent && <Badge className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 shadow-sm">Up next</Badge>}
                <Item
                  variant="outline"
                  size="sm"
                  className={cn(rowClass, strictOnly && 'opacity-70')}
                  render={
                    <Link
                      to="/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId"
                      params={{ courseId, versionId, moduleId, sectionId, itemId: item._id }}
                      search={{ track: strictOnly ? 'green' : track }}
                    />
                  }
                >
                  {row}
                </Item>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Segmented switch between the two ways through a course (Strict / Study mode). */
function TrackSwitcher({ track, onChange }: { track: Track; onChange: (t: Track) => void }) {
  return (
    <Card size="sm" role="region" aria-labelledby="track-title" className="mt-8">
      <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <CardTitle id="track-title">How do you want to go through this course?</CardTitle>
        <Tabs value={track} onValueChange={(v) => onChange(v as Track)}>
          <TabsList aria-label="Mode" className="w-full sm:w-fit">
            {(['green', 'blue'] as const).map((t) => (
              <TabsTrigger key={t} value={t}>
                <span className={cn('size-2 rounded-full', t === 'blue' ? 'bg-sky-500' : 'bg-emerald-500')} aria-hidden />
                {TRACKS[t].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex items-start gap-3">
        <TrackBadge track={track} className="shrink-0" />
        <p className="text-sm text-muted-foreground">
          {TRACKS[track].description}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Study mode's Continue target when the student's current item is a quiz: the
 * next non-quiz lesson after it in the syllabus, else the last one before it.
 */
function studyContinueTarget(items: FlatItem[], quizId: string): CurrentPath | null {
  const at = items.findIndex((i) => i._id === quizId);
  if (at < 0) return null;
  const pick = items.slice(at + 1).find((i) => !hiddenInStudyMode(i)) ?? [...items.slice(0, at)].reverse().find((i) => !hiddenInStudyMode(i));
  return pick
    ? {
        module: { id: pick.moduleId, name: '' },
        section: { id: pick.sectionId, name: '' },
        item: { id: pick._id, name: pick.name, type: pick.type },
      }
    : null;
}
