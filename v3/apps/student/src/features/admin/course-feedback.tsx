import { Link } from '@tanstack/react-router';
import { MessageSquareTextIcon, SmartphoneIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { CohortSelect, FeedbackDownloadMenu } from './editor/feedback-downloads';
import {
  downloadCourseFeedback,
  useCourseFeedbackForms,
  useFeedbackSettings,
  useUpdateFeedbackSettings,
  type CourseFeedbackForm,
} from './editor/lesson-api';
import { ErrorText, SectionHeading } from './studio-ui';

/**
 * The course's Feedback tab: every feedback form in course order with how
 * many students answered it, links to each form's responses, and downloads
 * for the whole course (a workbook, or CSV).
 */
export function CourseFeedback({ courseId, versionId }: { courseId: string; versionId: string }) {
  const [cohortId, setCohortId] = useState('');
  const forms = useCourseFeedbackForms(courseId, versionId, cohortId || undefined);

  const responsesLink = (f: CourseFeedbackForm) => ({
    to: '/admin/courses/$courseId/$versionId/lesson' as const,
    params: { courseId, versionId },
    search: { module: f.moduleId, section: f.sectionId, item: f.id, type: 'FEEDBACK' as const },
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionHeading>Feedback</SectionHeading>
          <p className="-mt-2 text-sm text-muted-foreground">
            Every feedback form in this course, and downloads of all the answers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CohortSelect versionId={versionId} value={cohortId} onChange={setCohortId} />
          <FeedbackDownloadMenu
            label="Download feedback"
            cohortId={cohortId || undefined}
            choices={[
              {
                label: 'Excel workbook',
                description: 'Overview, a sheet per form, and watch time with feedback.',
                format: 'xlsx',
              },
              { label: 'CSV: every answer', description: 'All forms in one table.', format: 'csv', type: 'all' },
              {
                label: 'CSV: watch time + feedback',
                description: 'One row per student per video.',
                format: 'csv',
                type: 'watch',
              },
            ]}
            download={(options) => downloadCourseFeedback(courseId, versionId, options)}
          />
        </div>
      </div>

      <StudyModeFeedbackSwitch courseId={courseId} versionId={versionId} />

      {forms.isPending && <Skeleton className="h-48 rounded-2xl" />}
      {forms.isError && <ErrorText error={forms.error} />}
      {forms.data && forms.data.length === 0 && (
        <Empty className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareTextIcon />
            </EmptyMedia>
            <EmptyTitle>No feedback forms yet</EmptyTitle>
            <EmptyDescription>Add a feedback lesson from the Content tab to start collecting answers.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {forms.data && forms.data.length > 0 && (
        <>
          {/* Phones: one card per form. */}
          <div className="grid gap-3 md:hidden" aria-label="Feedback forms">
            {forms.data.map((f) => (
              <Card key={f.id} className="gap-2 px-4 py-4">
                <p className="font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.moduleName} · {f.sectionName}
                  {f.aboutName ? ` · about “${f.aboutName}”` : ''}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm tabular-nums">
                    {f.responses} {f.responses === 1 ? 'response' : 'responses'}
                  </span>
                  <Link {...responsesLink(f)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    Responses
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          {/* Larger screens: a table. */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-card max-md:hidden">
            <Table aria-label="Feedback forms">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="sticky left-0 z-10 bg-muted pl-4">Form</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>About lesson</TableHead>
                  <TableHead className="text-right">Responses</TableHead>
                  <TableHead className="pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.data.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="sticky left-0 z-10 bg-card pl-4 font-medium shadow-[1px_0_0_var(--border)]">
                      {f.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.moduleName}</TableCell>
                    <TableCell className="text-muted-foreground">{f.sectionName}</TableCell>
                    <TableCell className="text-muted-foreground">{f.aboutName || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.responses}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Link
                        {...responsesLink(f)}
                        aria-label={`${f.name}: responses`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        Responses
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "Students can send feedback in study mode": on by default. Strict mode is
 * PC-only, so this is the only way students on phones can answer.
 */
function StudyModeFeedbackSwitch({ courseId, versionId }: { courseId: string; versionId: string }) {
  const settings = useFeedbackSettings(courseId, versionId);
  const update = useUpdateFeedbackSettings(courseId, versionId);
  const on = update.isPending ? update.variables : (settings.data?.studyModeFeedback ?? true);
  return (
    <Card className="px-4 py-4 sm:px-5">
      <label htmlFor="study-mode-feedback" className="flex cursor-pointer items-start gap-4">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <SmartphoneIcon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Students can send feedback in study mode</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            Phones can only use study mode, so turning this off means students on phones can’t send feedback. Study-mode
            answers never change strict progress.
          </span>
        </span>
        <Switch
          id="study-mode-feedback"
          className="mt-1"
          checked={on}
          disabled={settings.isPending || update.isPending}
          onCheckedChange={(checked) =>
            update.mutate(checked === true, {
              onSuccess: (data) =>
                toast.success(
                  data.studyModeFeedback
                    ? 'Students can now send feedback in study mode.'
                    : 'Feedback can now be sent only in strict mode.',
                ),
              onError: () => toast.error('Couldn’t change the setting. Please try again.'),
            })
          }
        />
      </label>
      {settings.isError && <ErrorText error={settings.error} />}
    </Card>
  );
}
