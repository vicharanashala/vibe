import { Link } from '@tanstack/react-router';
import { ChevronRightIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { GeneratedCover } from '@/components/generated-art';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';

import { NewCourseDialog } from './new-course-dialog';
import { useStudioAccess, useStudioCourses, type AdminCourse } from './queries';
import { ErrorText, formatDate, PageHeader, StudioPage } from './studio-ui';

/** Newest first. */
export function sortCourses(courses: AdminCourse[]) {
  return [...courses].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** Substack "Posts"-style course list: every course for admins, the ones you teach otherwise. */
export function CoursesPage() {
  const courses = useStudioCourses();
  // Only admins can create courses (backend rule); teachers are invited to theirs.
  const { isAdmin } = useStudioAccess();
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sortCourses(courses.data ?? []);
    return q ? list.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) : list;
  }, [courses.data, query]);

  return (
    <StudioPage>
      <PageHeader
        title="Courses"
        description="Everything you teach. Open a course to edit its content, invite people and set proctoring."
        actions={
          isAdmin && (
            <Button onClick={() => setNewOpen(true)}>
              <PlusIcon aria-hidden /> New course
            </Button>
          )
        }
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {courses.data ? `${courses.data.length} ${courses.data.length === 1 ? 'course' : 'courses'}` : ' '}
        </p>
        <InputGroup className="w-full bg-card sm:w-72">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput aria-label="Search courses" placeholder="Search courses…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
      </div>

      <div className="mt-3">
        {courses.isPending && <CourseListSkeleton />}
        {courses.isError && <ErrorText error={courses.error} />}
        {courses.data && courses.data.length === 0 && (
          <Empty className="rounded-2xl border border-dashed border-border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PlusIcon />
              </EmptyMedia>
              <EmptyTitle>No courses yet</EmptyTitle>
              <EmptyDescription>
                {isAdmin ? 'Create your first course to start adding lessons.' : 'Courses you’re invited to teach appear here.'}
              </EmptyDescription>
            </EmptyHeader>
            {isAdmin && (
              <EmptyContent>
                <Button onClick={() => setNewOpen(true)}>New course</Button>
              </EmptyContent>
            )}
          </Empty>
        )}
        {courses.data && courses.data.length > 0 && shown.length === 0 && (
          <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">No courses match “{query}”.</p>
        )}
        {shown.length > 0 && <CourseList courses={shown} />}
      </div>

      <NewCourseDialog open={newOpen} onOpenChange={setNewOpen} />
    </StudioPage>
  );
}

export function CourseList({ courses }: { courses: AdminCourse[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {courses.map((course) => (
        <li key={course._id}>
          <CourseRow course={course} />
        </li>
      ))}
    </ul>
  );
}

function CourseRow({ course }: { course: AdminCourse }) {
  const versionId = course.versions[0] ?? '';
  return (
    <Link
      to="/admin/courses/$courseId/$versionId"
      params={{ courseId: course._id, versionId }}
      disabled={!versionId}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none"
    >
      <GeneratedCover seed={course._id} title={course.name} compact className="h-12 w-16 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{course.name}</p>
        <p className="truncate text-sm text-muted-foreground">{course.description}</p>
      </div>
      <dl className="hidden shrink-0 grid-cols-2 gap-8 text-right text-sm sm:grid">
        <div>
          <dt className="text-[11px] text-muted-foreground">Versions</dt>
          <dd className="tabular-nums">{course.versions.length}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Created</dt>
          <dd className="whitespace-nowrap">{formatDate(course.createdAt)}</dd>
        </div>
      </dl>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function CourseListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-12 w-16 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
