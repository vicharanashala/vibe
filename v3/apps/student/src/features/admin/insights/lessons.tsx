import { useNavigate } from '@tanstack/react-router';
import { ArrowRightIcon, FileTextIcon, TriangleAlertIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ITEM_TYPES } from '../course-content';

import { BarRow, ShowMoreList } from './bars';
import { ChartPanel } from './chart-panel';
import { count, days } from './format';
import type { CourseInsights } from './types';

type Lesson = NonNullable<CourseInsights['whereNow']>[number];

/** A lesson where at least this many students have sat for a median of BLOCKER_DAYS or more is flagged. */
export const BLOCKER_STUDENTS = 5;
export const BLOCKER_DAYS = 3;

export const isBlocker = (l: { students: number; medianDaysThere: number }) =>
  l.students >= BLOCKER_STUDENTS && l.medianDaysThere >= BLOCKER_DAYS;

function useOpenLesson(courseId: string, versionId: string) {
  const navigate = useNavigate();
  return (l: Lesson) =>
    void navigate({
      to: '/admin/courses/$courseId/$versionId/lesson',
      params: { courseId, versionId },
      search: { module: l.moduleId, section: l.sectionId, item: l.itemId },
    });
}

/**
 * The most important thing on the page when it happens: a lesson many students
 * are stuck on. A soft warning card with a way straight to the lesson.
 */
export function BlockerCallout({
  courseId,
  versionId,
  whereNow,
}: {
  courseId: string;
  versionId: string;
  whereNow: Lesson[];
}) {
  const open = useOpenLesson(courseId, versionId);
  const blockers = whereNow
    .filter(isBlocker)
    .sort((a, b) => b.students - a.students);
  if (!blockers.length) return null;
  const top = blockers[0];
  return (
    <section
      aria-label="Possible blocker"
      className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 sm:items-center sm:px-5"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300">
        <TriangleAlertIcon aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {count(top.students, 'student')} stuck on “{top.name}”
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Median {days(top.medianDaysThere)} on this lesson
            {blockers.length > 1 &&
              ` · ${count(blockers.length - 1, 'more lesson')} like this`}
          </p>
        </div>
        <Button
          size="sm"
          variant="link"
          className="mt-1 h-auto px-0 text-rose-700 sm:mt-0 dark:text-rose-300"
          onClick={() => open(top)}
        >
          Open lesson <ArrowRightIcon aria-hidden />
        </Button>
      </div>
    </section>
  );
}

/** The lessons students are currently on: the place a stuck cohort shows up first. */
export function WhereNow({
  courseId,
  versionId,
  whereNow,
}: {
  courseId: string;
  versionId: string;
  whereNow: Lesson[];
}) {
  const open = useOpenLesson(courseId, versionId);
  const rows = [...whereNow].sort((a, b) => b.students - a.students);
  const max = Math.max(1, ...rows.map((r) => r.students));
  const blockers = rows.filter(isBlocker).length;
  return (
    <ChartPanel
      title="Where students are now"
      summary={
        blockers
          ? `${count(blockers, 'lesson')} may be blocking students.`
          : rows.length
            ? 'The lessons students are on now. Nobody looks stuck.'
            : 'No student has started yet.'
      }
    >
      {rows.length > 0 && (
        <ShowMoreList
          items={rows}
          noun="lessons"
          render={(l) => {
            const meta = ITEM_TYPES[l.type] ?? {
              label: 'Lesson',
              icon: FileTextIcon,
              tone: 'bg-muted text-foreground/80',
            };
            const Icon = meta.icon;
            const blocker = isBlocker(l);
            return (
              <li key={l.itemId}>
                <BarRow
                  onClick={() => open(l)}
                  actionLabel={`Open ${l.name}`}
                  leading={
                    <span
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${meta.tone}`}
                    >
                      <Icon aria-hidden className="size-3.5" />
                      <span className="sr-only">{meta.label}</span>
                    </span>
                  }
                  label={l.name}
                  value={l.students.toLocaleString()}
                  bar={l.students / max}
                  tone={blocker ? 'bad' : 'primary'}
                  detail={`${days(l.medianDaysThere)} here`}
                  badge={
                    blocker && (
                      <Badge
                        variant="destructive"
                        className="h-5 gap-1 px-1.5 text-[11px]"
                      >
                        <TriangleAlertIcon aria-hidden className="size-3" />
                        Possible blocker
                      </Badge>
                    )
                  }
                />
              </li>
            );
          }}
        />
      )}
    </ChartPanel>
  );
}
