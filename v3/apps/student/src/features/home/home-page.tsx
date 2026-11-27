import { Link } from '@tanstack/react-router';
import { ArrowRightIcon, BookOpenIcon, CheckIcon, CircleAlertIcon, CircleDashedIcon, ClockIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { CourseCover, ProgressBar, percentOf } from '@/features/courses/course-ui';
import { useCurrentPath, useEnrollments, type EnrollmentSummary } from '@/features/courses/queries';
import { PublicCourseCard } from '@/features/explore/explore-page';
import { publicKey, usePendingLookup, usePublicCourses } from '@/features/explore/queries';
import { readOnboarding } from '@/features/onboarding/onboarding-state';
import { usePendingRegistrations } from '@/features/registration/queries';
import { cn } from '@/lib/utils';
import { enterClass, stagger } from '@/lib/motion';

export function HomePage() {
  const { user } = useAuth();
  const enrollments = useEnrollments('active');
  const list = enrollments.data?.enrollments ?? [];
  // Resume the course with progress that isn't finished; otherwise the newest enrolment.
  const inProgress = list.filter((e) => percentOf(e) > 0 && percentOf(e) < 100);
  const resume = inProgress[0] ?? list.find((e) => percentOf(e) < 100) ?? list[0];
  const others = list.filter((e) => e !== resume);
  const firstName = user?.displayName?.split(' ')[0];

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_300px] lg:py-10">
      <div className="min-w-0">
        <h1 className="font-aleo text-3xl tracking-tight">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1>

        <section aria-labelledby="continue-title" className="mt-8">
          <h2 id="continue-title" className="mb-4 text-lg font-semibold">
            Continue learning
          </h2>
          {enrollments.isPending ? (
            <Skeleton className="h-52 rounded-2xl" />
          ) : enrollments.isError ? (
            <LoadError onRetry={() => enrollments.refetch()} />
          ) : resume ? (
            <ResumeCard enrollment={resume} />
          ) : (
            <EmptyCourses />
          )}
        </section>

        {others.length > 0 && (
          <section aria-labelledby="your-courses-title" className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="your-courses-title" className="text-lg font-semibold">
                Your courses
              </h2>
              <Link to="/courses" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {others.slice(0, 4).map((e, i) => (
                <li key={e._id} className={enterClass} style={stagger(i)}>
                  <Link
                    to="/courses/$courseId/$versionId"
                    params={{ courseId: e.courseId, versionId: e.courseVersionId }}
                    className="group block rounded-3xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Card size="sm" className="transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-md">
                      <CardContent>
                        <CourseCover name={e.course.name} seed={e.courseId} className="h-28 w-full" />
                        <p className="mt-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Course</p>
                        <p className="mt-1 line-clamp-2 font-medium">{e.course.name}</p>
                        <ProgressBar value={percentOf(e)} className="mt-3" label={`${e.course.name} progress`} />
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ExploreStrip />
      </div>

      <aside className="flex flex-col gap-4" aria-label="Getting started">
        <PendingRegistrations />
        <GettingStarted hasCourse={list.length > 0} hasStarted={list.some((e) => percentOf(e) > 0)} uid={user?.uid ?? ''} />
      </aside>
    </div>
  );
}

function ResumeCard({ enrollment: e }: { enrollment: EnrollmentSummary }) {
  const path = useCurrentPath(e.courseId, e.courseVersionId);
  const pct = percentOf(e);
  const total = e.contentCounts?.totalItems ?? 0;
  const left = Math.max(0, total - (e.completedItems ?? 0));

  return (
    <div className={cn('relative', enterClass)}>
      {/* Uxcel's stacked-card hint that there's more behind this one */}
      <div aria-hidden className="absolute inset-x-4 -bottom-2 h-full rounded-3xl bg-muted/60 ring-1 ring-foreground/10" />
      <Card className="relative grid gap-5 p-4 sm:grid-cols-[220px_1fr] sm:p-5">
        <CourseCover name={e.course.name} seed={e.courseId} className="aspect-[2/1] w-full sm:aspect-auto sm:h-full" />
        <div className="flex min-w-0 flex-col">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Course</p>
          <h3 className="mt-1 font-aleo text-xl leading-snug">{e.course.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {path.data?.item ? (
              <>
                Up next: <span className="text-foreground">{path.data.item.name}</span>
              </>
            ) : (
              e.course.description
            )}
          </p>
          <div className="mt-auto pt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(pct)}% complete</span>
              {total > 0 && <span>{left} of {total} lessons left</span>}
            </div>
            <ProgressBar value={pct} label={`${e.course.name} progress`} />
            <Link
              {...(path.data?.item && path.data.module && path.data.section
                ? {
                    to: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId' as const,
                    params: {
                      courseId: e.courseId,
                      versionId: e.courseVersionId,
                      moduleId: path.data.module.id,
                      sectionId: path.data.section.id,
                      itemId: path.data.item.id,
                    },
                    search: { track: 'green' as const },
                  }
                : { to: '/courses/$courseId/$versionId' as const, params: { courseId: e.courseId, versionId: e.courseVersionId } })}
              className={cn(buttonVariants({ size: 'lg' }), 'mt-4 w-full')}
            >
              {pct > 0 ? 'Resume course' : 'Start course'}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EmptyCourses() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BookOpenIcon />
        </EmptyMedia>
        <EmptyTitle>You don’t have any active courses</EmptyTitle>
        <EmptyDescription>Courses appear here once you join one through an invite or a registration link from your course team.</EmptyDescription>
      </EmptyHeader>
      <Link to="/explore" className={buttonVariants({ variant: 'outline' })}>
        Explore open courses
      </Link>
    </Empty>
  );
}

/** A few open courses from the catalogue; hidden when there are none (or it can't load). */
function ExploreStrip() {
  const query = usePublicCourses('');
  const isPending = usePendingLookup();
  // Courses you can still register for come first.
  const shown = [...(query.data ?? [])].sort((a, b) => Number(isPending(a)) - Number(isPending(b))).slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="explore-title" className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="explore-title" className="text-lg font-semibold">
          Explore courses
        </h2>
        <Link to="/explore" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          View all
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {shown.map((c, i) => (
          <li key={publicKey(c)} className={enterClass} style={stagger(i)}>
            <PublicCourseCard course={c} compact requested={isPending(c)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Registrations still waiting for the course team (from course registration links). */
function PendingRegistrations() {
  const pending = usePendingRegistrations();
  const list = pending.data ?? [];
  if (!list.length) return null;
  return (
    <Card size="sm" role="region" aria-labelledby="pending-title">
      <CardHeader>
        <CardTitle id="pending-title">Waiting for approval</CardTitle>
        <CardDescription>Your course team will review these registrations.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="gap-2">
          {list.map((r) => (
            <Item
              key={r._id}
              variant="outline"
              size="sm"
              render={<Link to="/register/$versionId/{-$cohortId}" params={{ versionId: r.versionId, cohortId: r.cohortId ?? undefined }} />}
            >
              <ItemMedia variant="icon" className="text-amber-600 dark:text-amber-400">
                <ClockIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="line-clamp-2">{r.courseName}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <Badge variant="outline">Pending</Badge>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>We couldn’t load your courses.</AlertTitle>
      <AlertDescription>
        <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function GettingStarted({ uid, hasCourse, hasStarted }: { uid: string; hasCourse: boolean; hasStarted: boolean }) {
  const onboarding = readOnboarding(uid);
  const steps = [
    { label: 'Create your account', done: true, link: undefined },
    {
      label: 'Check your camera and microphone',
      done: Boolean(onboarding.mediaCheckPassedAt),
      link: <Link to="/onboarding" search={{ step: 'media' }} />,
    },
    { label: 'Join a course', done: hasCourse, link: undefined },
    { label: 'Start your first lesson', done: hasStarted, link: hasCourse ? <Link to="/courses" /> : undefined },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>A few quick steps before your first proctored lesson.</CardDescription>
        <CardAction className="text-xs text-muted-foreground">
          {doneCount}/{steps.length}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ProgressBar value={(doneCount / steps.length) * 100} label="Getting started progress" />
        <ItemGroup className="gap-2">
          {steps.map((s) => {
            const status = s.done ? (
              <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white">
                <CheckIcon className="size-3" aria-hidden />
              </span>
            ) : (
              <CircleDashedIcon className="size-5 text-muted-foreground" aria-hidden />
            );
            const body = (
              <>
                <ItemContent>
                  <ItemTitle className={cn('font-normal', s.done && 'text-muted-foreground')}>{s.label}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  {status}
                  <span className="sr-only">{s.done ? '(done)' : '(to do)'}</span>
                </ItemActions>
              </>
            );
            return !s.done && s.link ? (
              <Item key={s.label} variant="outline" size="sm" render={s.link}>
                {body}
              </Item>
            ) : (
              <Item key={s.label} variant="outline" size="sm">
                {body}
              </Item>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
