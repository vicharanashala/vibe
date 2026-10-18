import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toId } from '@/features/learn/quiz-api';

import { useCreateCourse } from './queries';
import { ErrorText } from './studio-ui';

/** Create a course (with its first version) and open it on the Content tab. */
export function NewCourseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createCourse = useCreateCourse();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [versionName, setVersionName] = useState('Version 1');

  function reset() {
    setName('');
    setDescription('');
    setVersionName('Version 1');
    createCourse.reset();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createCourse.mutate(
      { name, description, versionName, versionDescription: '' },
      {
        onSuccess: (course) => {
          onOpenChange(false);
          reset();
          const courseId = toId(course._id);
          const versionId = course.versions?.[0] ? toId(course.versions[0]) : '';
          if (courseId && versionId) {
            void navigate({ to: '/admin/courses/$courseId/$versionId', params: { courseId, versionId }, search: { tab: 'content' } });
          } else {
            void navigate({ to: '/admin/courses' });
          }
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-aleo text-xl">New course</DialogTitle>
          <DialogDescription>Give it a name now. You can add modules and lessons next.</DialogDescription>
        </DialogHeader>
        <form id="new-course" onSubmit={onSubmit} className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="course-name">Course name</FieldLabel>
            <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} autoFocus placeholder="e.g. Foundations of Data Structures" />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-description">Description</FieldLabel>
            <Textarea
              id="course-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={1000}
              rows={3}
              placeholder="What will students learn?"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="version-name">First version</FieldLabel>
            <Input id="version-name" value={versionName} onChange={(e) => setVersionName(e.target.value)} required minLength={3} maxLength={255} />
            <FieldDescription>Each run of a course is a version, with its own content and students.</FieldDescription>
          </Field>
          {createCourse.isError && <ErrorText error={createCourse.error} />}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-course" disabled={createCourse.isPending}>
            {createCourse.isPending && <Spinner className="size-4" />}
            Create course
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
