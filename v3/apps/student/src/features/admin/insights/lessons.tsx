import { useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon, FileTextIcon, TriangleAlertIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { ITEM_TYPES } from '../course-content';

import { ChartPanel } from './chart-panel';
import { count, days } from './format';
import type { CourseInsights } from './types';

/** A lesson where at least this many students have sat for a median of BLOCKER_DAYS or more is flagged. */
export const BLOCKER_STUDENTS = 5;
export const BLOCKER_DAYS = 3;

export const isBlocker = (l: { students: number; medianDaysThere: number }) =>
  l.students >= BLOCKER_STUDENTS && l.medianDaysThere >= BLOCKER_DAYS;

const SHOWN = 8;

/** The lessons students are currently on: the place a stuck cohort shows up first. */
export function WhereNow({
  courseId,
  versionId,
  whereNow,
}: {
  courseId: string;
  versionId: string;
  whereNow: NonNullable<CourseInsights['whereNow']>;
}) {
  const navigate = useNavigate();
  const rows = [...whereNow].sort((a, b) => b.students - a.students).slice(0, SHOWN);
  const blockers = rows.filter(isBlocker);
  return (
    <ChartPanel
      title="Where students are now"
      summary={
        blockers.length
          ? `${count(blockers.length, 'lesson')} may be blocking students: ${count(blockers[0].students, 'student')} have been on “${blockers[0].name}” for a median of ${days(blockers[0].medianDaysThere)}.`
          : rows.length
            ? 'The lessons students are currently on. Nobody looks stuck.'
            : 'No student has started yet.'
      }
    >
      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lesson</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">There for</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => {
              const meta = ITEM_TYPES[l.type] ?? { label: 'Lesson', icon: FileTextIcon, tone: 'bg-muted text-foreground/80' };
              const Icon = meta.icon;
              const open = () =>
                void navigate({
                  to: '/admin/courses/$courseId/$versionId/lesson',
                  params: { courseId, versionId },
                  search: { module: l.moduleId, section: l.sectionId, item: l.itemId },
                });
              return (
                <TableRow key={l.itemId}>
                  <TableCell className="max-w-0 w-full">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`grid size-6 shrink-0 place-items-center rounded-md ${meta.tone}`}>
                        <Icon aria-hidden className="size-3.5" />
                        <span className="sr-only">{meta.label}</span>
                      </span>
                      <span className="truncate font-medium">{l.name}</span>
                      {isBlocker(l) && (
                        <Badge variant="destructive" className="shrink-0 gap-1">
                          <TriangleAlertIcon aria-hidden className="size-3" /> Possible blocker
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.students.toLocaleString()}</TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground">{days(l.medianDaysThere)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" aria-label={`Open ${l.name}`} onClick={open}>
                      <ChevronRightIcon aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </ChartPanel>
  );
}
