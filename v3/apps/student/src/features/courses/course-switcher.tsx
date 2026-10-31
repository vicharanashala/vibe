import { Link } from '@tanstack/react-router';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';

import { GeneratedCover } from '@/components/generated-art';
import { Button, buttonVariants } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { percentOf } from './course-ui';
import { useEnrollments } from './queries';

/**
 * Uxcel Go's course pill: shows the current course and opens a bottom sheet
 * listing the student's other active courses.
 */
export function CourseSwitcher({ current, name, className }: { current: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const enrollments = useEnrollments('active');
  const list = enrollments.data?.enrollments ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="outline" className={cn('max-w-full justify-between', className)} />}
        aria-label={`Switch course. Current course: ${name}`}
      >
        <span className="truncate">{name}</span>
        <ChevronDownIcon className="text-muted-foreground" aria-hidden />
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <div className="px-4 pt-3 pb-3">
          <SheetTitle className="text-lg font-semibold">Your courses</SheetTitle>
          <SheetDescription>Switch to another course you’re taking.</SheetDescription>
        </div>
        <ItemGroup className="gap-2 overflow-y-auto px-4 pb-4">
          {list.map((e) => {
            const selected = e.courseVersionId === current;
            return (
              <Item
                key={e._id}
                variant="outline"
                size="sm"
                aria-current={selected ? 'page' : undefined}
                className={cn('bg-card', selected && 'border-primary ring-2 ring-primary/20')}
                render={
                  <Link
                    to="/courses/$courseId/$versionId"
                    params={{ courseId: e.courseId, versionId: e.courseVersionId }}
                    onClick={() => setOpen(false)}
                  />
                }
              >
                <ItemMedia>
                  <GeneratedCover seed={e.courseId} title={e.course.name} className="size-12 rounded-lg" compact />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="line-clamp-2">{e.course.name}</ItemTitle>
                  <ItemDescription>{Math.round(percentOf(e))}% complete</ItemDescription>
                </ItemContent>
                {selected && (
                  <ItemActions>
                    <CheckIcon className="size-4 text-primary" aria-hidden />
                  </ItemActions>
                )}
              </Item>
            );
          })}
          <Link to="/courses" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: 'ghost' }), 'text-muted-foreground')}>
            See all courses
          </Link>
        </ItemGroup>
      </SheetContent>
    </Sheet>
  );
}
