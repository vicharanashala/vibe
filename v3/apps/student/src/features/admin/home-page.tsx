import { Link } from '@tanstack/react-router';
import { CheckCircle2Icon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import { useState } from 'react';

import { GeneratedAvatar, GeneratedCover } from '@/components/generated-art';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useCourseVersion } from '@/features/courses/queries';
import { useCourseSettings } from '@/features/learn/queries';
import { cn } from '@/lib/utils';

import { CourseList, CourseListSkeleton, sortCourses } from './courses-page';
import { NewCourseDialog } from './new-course-dialog';
import { useAllCourses, useAllUsers, useCourseEnrollments, useCurrentUserProfile, type AdminCourse } from './queries';
import { ErrorText, formatDate, RoleBadge, SectionHeading, StatStrip, StudioPage } from './studio-ui';

type CourseTab = 'overview' | 'content' | 'people' | 'proctoring';

/** Studio home, after Substack's dashboard: setup checklist, overview numbers, latest course, people. */
export function StudioHomePage() {
  const profile = useCurrentUserProfile();
  const courses = useAllCourses();
  const users = useAllUsers();
  const sorted = sortCourses(courses.data ?? []);
  const latest = sorted[0];

  return (
    <StudioPage className="max-w-4xl">
      <h1 className="font-aleo text-3xl tracking-tight">Welcome back{profile.data?.firstName ? `, ${profile.data.firstName}` : ''}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Here’s what’s happening across your courses.</p>

      {courses.data && <GettingStarted latest={latest} />}

      <section className="mt-8">
        <SectionHeading>Overview</SectionHeading>
        <StatStrip
          stats={[
            { label: 'Courses', value: courses.data ? courses.data.length : '–' },
            { label: 'Users', value: users.data ? users.data.length : '–' },
            { label: 'Admins', value: users.data ? users.data.filter((u) => u.roles === 'admin').length : '–' },
          ]}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col">
          <SectionHeading>Latest course</SectionHeading>
          {courses.isPending ? <Skeleton className="h-64 rounded-2xl" /> : latest ? <LatestCourseCard course={latest} /> : <NoCourseCard />}
        </section>
        <section className="flex flex-col">
          <SectionHeading
            action={
              <Link to="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
                View all
              </Link>
            }
          >
            People
          </SectionHeading>
          <div className="flex-1 overflow-hidden rounded-2xl border border-border bg-card">
            {users.isPending && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>}
            {users.isError && <ErrorText error={users.error} className="p-4" />}
            <ul className="divide-y divide-border">
              {users.data?.slice(0, 6).map((u) => (
                <li key={u._id} className="flex items-center gap-3 px-4 py-2.5">
                  <GeneratedAvatar seed={u._id} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.firstName} {u.lastName ?? ''}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <RoleBadge role={u.roles} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <SectionHeading
          action={
            <Link to="/admin/courses" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          }
        >
          Recent courses
        </SectionHeading>
        {courses.isPending && <CourseListSkeleton />}
        {courses.isError && <ErrorText error={courses.error} />}
        {sorted.length > 0 && <CourseList courses={sorted.slice(0, 5)} />}
      </section>
    </StudioPage>
  );
}

/** Substack-style setup checklist, driven by the newest course. Hidden once everything is done. */
function GettingStarted({ latest }: { latest?: AdminCourse }) {
  const versionId = latest?.versions[0] ?? '';
  const version = useCourseVersion(versionId);
  const enrollments = useCourseEnrollments(latest?._id ?? '', versionId);
  const settings = useCourseSettings(latest?._id ?? '', versionId);
  const [newOpen, setNewOpen] = useState(false);

  const modules = version.data?.modules.filter((m) => !m.isDeleted) ?? [];
  const steps: { label: string; done: boolean; tab?: CourseTab; onClick?: () => void }[] = [
    { label: 'Create your first course', done: !!latest, onClick: () => setNewOpen(true) },
    { label: 'Add a module', done: modules.length > 0, tab: 'content' },
    { label: 'Add a lesson', done: (version.data?.totalItems ?? 0) > 0, tab: 'content' },
    { label: 'Invite a student', done: (enrollments.data ?? []).some((e) => e.role === 'STUDENT'), tab: 'people' },
    { label: 'Turn on proctoring', done: (settings.data?.settings.proctors?.detectors ?? []).some((d) => d.settings.enabled), tab: 'proctoring' },
  ];
  const loading = !!latest && (version.isPending || enrollments.isPending || settings.isPending);
  const doneCount = steps.filter((s) => s.done).length;
  if (loading || doneCount === steps.length) return null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Getting started</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {doneCount} of {steps.length}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{latest ? <>A few steps to get <span className="font-medium text-foreground">{latest.name}</span> ready for students.</> : 'A few steps to get your first course ready.'}</p>
      <Progress value={(doneCount / steps.length) * 100} className="mt-4 h-1.5" aria-label="Setup progress" />
      <ul className="mt-4 grid gap-2">
        {steps.map((step) => {
          const body = (
            <>
              {step.done ? <CheckCircle2Icon className="size-4.5 text-emerald-600 dark:text-emerald-400" aria-hidden /> : <CircleIcon className="size-4.5 text-muted-foreground" aria-hidden />}
              <span className={cn('flex-1 text-sm', step.done ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'font-medium')}>{step.label}</span>
              {!step.done && <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />}
            </>
          );
          const cls = 'group flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition-colors';
          if (step.done) return <li key={step.label} className={cn(cls, 'bg-muted/40')}>{body}</li>;
          return (
            <li key={step.label}>
              {step.tab && latest ? (
                <Link
                  to="/admin/courses/$courseId/$versionId"
                  params={{ courseId: latest._id, versionId }}
                  search={{ tab: step.tab }}
                  className={cn(cls, 'hover:bg-secondary/60')}
                >
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={step.onClick} className={cn(cls, 'hover:bg-secondary/60')}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <NewCourseDialog open={newOpen} onOpenChange={setNewOpen} />
    </section>
  );
}

function LatestCourseCard({ course }: { course: AdminCourse }) {
  const versionId = course.versions[0] ?? '';
  const version = useCourseVersion(versionId);
  const enrollments = useCourseEnrollments(course._id, versionId);
  const modules = version.data?.modules.filter((m) => !m.isDeleted) ?? [];
  const students = (enrollments.data ?? []).filter((e) => e.role === 'STUDENT');
  const avg = students.length ? Math.round(students.reduce((sum, e) => sum + (e.progress ?? 0), 0) / students.length) : null;

  const rows = [
    { label: 'Modules', value: version.data ? modules.length : '–' },
    { label: 'Lessons', value: version.data ? (version.data.totalItems ?? 0) : '–' },
    { label: 'Students', value: enrollments.data ? students.length : '–' },
    { label: 'Average progress', value: avg === null ? '–' : `${avg}%` },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 p-4">
        <GeneratedCover seed={course._id} title={course.name} compact className="h-12 w-16 shrink-0 rounded-lg" />
        <div className="min-w-0">
          <p className="truncate font-medium">{course.name}</p>
          <p className="text-xs text-muted-foreground">Created {formatDate(course.createdAt)}</p>
        </div>
      </div>
      <dl className="divide-y divide-border border-t border-border">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto p-4 pt-3">
        <Button variant="secondary" className="w-full" nativeButton={false} render={<Link to="/admin/courses/$courseId/$versionId" params={{ courseId: course._id, versionId }} />}>
          Open course
        </Button>
      </div>
    </div>
  );
}

function NoCourseCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">You haven’t created a course yet.</p>
      <Button onClick={() => setOpen(true)}>New course</Button>
      <NewCourseDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
