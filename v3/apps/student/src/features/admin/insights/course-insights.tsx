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
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { ErrorText, SectionHeading } from '../studio-ui';

import { ActivityChart, EnrolmentsChart, StudyHeatmap } from './activity';
import { timeAgo } from './format';
import { Headline } from './headline';
import { WhereNow } from './lessons';
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
      variant="outline"
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
        >
          {r} days
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );

  const header = (
    <SectionHeading
      action={
        <div className="flex items-center gap-3">
          {data?.status === 'ready' && data.updatedAt && (
            <span
              className="text-xs text-muted-foreground max-sm:hidden"
              title={new Date(data.updatedAt).toLocaleString()}
            >
              Updated {timeAgo(data.updatedAt)}
            </span>
          )}
          {rangePicker}
        </div>
      }
    >
      Insights
    </SectionHeading>
  );

  let content: React.ReactNode;
  if (insights.isPending) {
    content = <InsightsSkeleton />;
  } else if (insights.isError) {
    content = <ErrorText error={insights.error} />;
  } else if (data?.status === 'building' || !data?.headline) {
    content = (
      <Empty className="rounded-2xl border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SparklesIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Insights are being prepared</EmptyTitle>
          <EmptyDescription>
            We’re adding up this course’s activity for the first time. Check
            back in a few minutes.
          </EmptyDescription>
        </EmptyHeader>
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
      <div className="grid min-w-0 grid-cols-1 gap-8">
        <Headline headline={data.headline} />

        <InsightGroup title="Activity">
          {data.daily && <ActivityChart daily={data.daily} range={range} />}
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {data.daily && <EnrolmentsChart daily={data.daily} range={range} />}
            {data.heatmap && <StudyHeatmap heatmap={data.heatmap} />}
          </div>
        </InsightGroup>

        <InsightGroup title="Progress">
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {data.progressBands && <ProgressBands bands={data.progressBands} />}
            {data.funnel && <ModuleFunnel funnel={data.funnel} />}
          </div>
        </InsightGroup>

        <InsightGroup title="Needs attention">
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
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
                onOpenStudent={onOpenStudent}
              />
            )}
          </div>
        </InsightGroup>

        <InsightGroup title="Lessons">
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {data.quizzes && <QuizInsights quizzes={data.quizzes} />}
            {data.videos && <VideoInsights videos={data.videos} />}
          </div>
        </InsightGroup>

        <InsightGroup title="Integrity and study habits">
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {data.proctoring && (
              <ProctoringInsights proctoring={data.proctoring} range={range} />
            )}
            {data.studyMode && <StudyModeSplit studyMode={data.studyMode} />}
          </div>
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
      {data?.status === 'ready' && data.updatedAt && (
        <p className="-mt-1 mb-3 text-xs text-muted-foreground sm:hidden">
          Updated {timeAgo(data.updatedAt)}
        </p>
      )}
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
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="grid gap-4" data-testid="insights-skeleton">
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    </div>
  );
}
