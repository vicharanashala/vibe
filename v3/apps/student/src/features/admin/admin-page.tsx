import { Link } from '@tanstack/react-router';
import { ApiError } from '@vibe/api';
import { ChevronRightIcon, CheckCircle2Icon, PlusIcon, ShieldAlertIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { useAllCourses, useCreateCourse, useCurrentUserProfile } from './queries';

function Status({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn('flex items-center gap-2 text-sm', kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}
    >
      {kind === 'ok' && <CheckCircle2Icon className="size-4" aria-hidden />}
      {children}
    </p>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/** Minimal admin area: list courses, create a course, invite an instructor onto one. Admin only. */
export function AdminPage() {
  const profile = useCurrentUserProfile();

  if (profile.isPending) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (profile.isError || profile.data?.roles !== 'admin') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <ShieldAlertIcon className="mx-auto size-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 font-aleo text-2xl">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">You need an admin account to see this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="font-aleo text-3xl tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">Create courses and invite instructors onto them.</p>

      <section className="mt-8 border-b border-border pb-8">
        <h2 className="font-semibold">New course</h2>
        <div className="mt-4 max-w-lg">
          <CreateCourseForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">All courses</h2>
        <div className="mt-4">
          <CourseList />
        </div>
      </section>
    </div>
  );
}

function CreateCourseForm() {
  const createCourse = useCreateCourse();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [versionName, setVersionName] = useState('v1.0');
  const [versionDescription, setVersionDescription] = useState('Initial release.');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createCourse.mutate(
      { name, description, versionName, versionDescription },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="course-name">Course name</Label>
        <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="course-description">Description</Label>
        <Textarea id="course-description" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={1000} rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="version-name">Version name</Label>
          <Input id="version-name" value={versionName} onChange={(e) => setVersionName(e.target.value)} required minLength={3} maxLength={255} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="version-description">Version note</Label>
          <Input id="version-description" value={versionDescription} onChange={(e) => setVersionDescription(e.target.value)} maxLength={1000} />
        </div>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <Button type="submit" disabled={createCourse.isPending}>
          {createCourse.isPending ? <Spinner className="size-4" /> : <PlusIcon className="size-4" aria-hidden />}
          Create course
        </Button>
        {createCourse.isSuccess && <Status kind="ok">Created.</Status>}
        {createCourse.isError && <Status kind="error">{errorMessage(createCourse.error)}</Status>}
      </div>
    </form>
  );
}

function CourseList() {
  const courses = useAllCourses();

  if (courses.isPending) return <p className="text-sm text-muted-foreground">Loading courses…</p>;
  if (courses.isError) return <Status kind="error">{errorMessage(courses.error)}</Status>;
  if (courses.data.length === 0) return <p className="text-sm text-muted-foreground">No courses yet.</p>;

  return (
    <ItemGroup className="gap-3">
      {courses.data.map((course) => (
        <Item
          key={course._id}
          variant="outline"
          render={<Link to="/admin/courses/$courseId/$versionId" params={{ courseId: course._id, versionId: course.versions[0] ?? '' }} />}
        >
          <ItemContent className="min-w-0">
            <ItemTitle>{course.name}</ItemTitle>
            <ItemDescription className="truncate">{course.description}</ItemDescription>
            <ItemDescription className="text-xs">{course.instructors.length} instructor(s)</ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
