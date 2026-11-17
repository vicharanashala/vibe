import {
  ChartNoAxesCombinedIcon,
  MailPlusIcon,
  SparklesIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { ErrorText } from '../studio-ui';

import { ActivityHero, StudyHeatmap } from './activity';
import { BlockerCallout, WhereNow } from './lessons';
import { ModuleFunnel, ProgressBands } from './progress';
import { ProctoringInsights, StudyModeSplit } from './proctoring';
import { useCourseInsights } from './queries';
import { QuizInsights } from './quizzes';
import { StudentsToCheckOn } from './students';
import { INSIGHTS_RANGES, type InsightsRange } from './types';
import { VideoInsights } from './videos';

export interface CourseInsightsProps {
  courseId: string;
  versionId: string;
  range: InsightsRange;
  onRangeChange: (range: InsightsRange) => void;
  onInvite: () => void;
  /** Opens People filtered to this student. */
  onOpenStudent: (email: string) => void;
}

/** The analytics half of a course's Overview tab. Loaded on demand (it carries the chart library). */
export default function CourseInsightsSection({
  courseId,
  versionId,
  range,
  onRangeChange,
  onInvite,
  onOpenStudent,
}: CourseInsightsProps) {
  const insights = useCourseInsights(courseId, versionId, range);
  const data = insights.data;

  const rangePicker = (
    <ToggleGroup
      spacing={1}
      size="sm"
      aria-label="Time range"
      value={[String(range)]}
      onValueChange={(v: string[]) => {
        const next = Number(v[0]) as InsightsRange;
        if (INSIGHTS_RANGES.includes(next)) onRangeChange(next);
      }}
    >
      {INSIGHTS_RANGES.map((r) => (
        <ToggleGroupItem
          key={r}
          value={String(r)}
          aria-label={`Last ${r} days`}
          className="h-8 rounded-full border border-border px-3 text-xs aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background dark:aria-pressed:bg-foreground hover:aria-pressed:bg-foreground/90 hover:aria-pressed:text-background"
        >
          {r} days
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );

  const header = (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Insights</h2>
        {rangePicker}
      </div>
    </div>
  );

  let content: React.ReactNode;
  if (insights.isPending) {
    content = <InsightsSkeleton />;
  } else if (insights.isError) {
    content = <ErrorText error={insights.error} />;
  } else if (data?.status === 'building' || !data?.headline) {
    const pct = Math.max(0, Math.min(100, Math.round(data?.buildProgress ?? 0)));
    content = (
      <Empty className="rounded-2xl border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SparklesIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Preparing insights</EmptyTitle>
          <EmptyDescription>
            We’re adding up this course’s activity for the first time. This
            page fills in on its own when it’s done.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="w-full max-w-xs">
          <Progress
            value={pct}
            aria-label="Preparing insights"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground tabular-nums" aria-hidden>
            {pct}%
          </p>
        </EmptyContent>
      </Empty>
    );
  } else if ((data.headline.students.current ?? 0) === 0) {
    content = (
      <Empty className="rounded-2xl border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartNoAxesCombinedIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No students yet</EmptyTitle>
          <EmptyDescription>
            Once students join, you’ll see how they’re doing here: activity,
            progress, quizzes and who needs a nudge.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onInvite}>
            <MailPlusIcon aria-hidden /> Invite students
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else {
    content = (
      <div className="grid min-w-0 grid-cols-1 gap-6 sm:gap-8">
        <div className="grid min-w-0 gap-3">
          {data.daily && (
            <ActivityHero
              daily={data.daily}
              headline={data.headline}
              range={range}
            />
          )}
          {data.whereNow && (
            <BlockerCallout
              courseId={courseId}
              versionId={versionId}
              whereNow={data.whereNow}
            />
          )}
        </div>

        <InsightGroup title="Needs attention">
          {data.whereNow && (
            <WhereNow
              courseId={courseId}
              versionId={versionId}
              whereNow={data.whereNow}
            />
          )}
          {data.checkOn && (
            <StudentsToCheckOn
              students={data.checkOn}
              totals={data.checkOnTotals}
              onOpenStudent={onOpenStudent}
            />
          )}
        </InsightGroup>

        <InsightGroup title="Course progress">
          {data.progressBands && <ProgressBands bands={data.progressBands} />}
          {data.funnel && <ModuleFunnel funnel={data.funnel} />}
        </InsightGroup>

        <InsightGroup title="Lessons">
          {data.quizzes && <QuizInsights quizzes={data.quizzes} />}
          {data.videos && <VideoInsights videos={data.videos} />}
        </InsightGroup>

        <InsightGroup title="Study habits and integrity">
          {data.heatmap && <StudyHeatmap heatmap={data.heatmap} />}
          {data.proctoring && (
            <ProctoringInsights proctoring={data.proctoring} range={range} />
          )}
          {data.studyMode && <StudyModeSplit studyMode={data.studyMode} />}
        </InsightGroup>
      </div>
    );
  }

  return (
    <section
      className="min-w-0"
      aria-label={insights.isPending ? 'Insights loading' : 'Insights'}
      aria-busy={insights.isPending || undefined}
    >
      {header}
      {content}
    </section>
  );
}

function InsightGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid min-w-0 gap-3" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-2 lg:gap-4">
        {children}
      </div>
    </section>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="grid gap-4" data-testid="insights-skeleton">
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 min-w-36 flex-1 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-2xl" />
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    </div>
  );
}
