'use client';

import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Brain,
  Sparkles,
  TrendingUp,
  Calendar,
  BellOff,
  Bell,
  ChevronRight,
  BookOpen,
  Inbox,
  Flame, // Added for Exam Prep Mode visibility
  Ban, // Added for SR-disabled empty state (Knob 6, Phase C, 2026-07-21)
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import {
  useGetSchedule,
  useGetCourseRetention,
  useUpdateNotificationPreference,
  useGetStudentSRStatus,
} from '@/hooks/spaced-repetition-hooks';
import { ReviewItem } from '@/types/spaced-repetition.types';
import { DEMO_STUDENT_ID, isDemoStudentEmail } from '@/lib/spaced-repetition-api';
import { InfoPopover } from '@/components/InfoPopover';
import {
  SPACED_REPETITION_INFO_TITLE,
  SpacedRepetitionInfoBody,
} from '@/components/spaced-repetition-info';
import { GoldenButton } from '@/app/components/GoldenButton';

// ── Helpers ──────────────────────────────────────────────────────────────

function efToRetentionPercent(ef: number): number {
  const clamped = Math.max(1.3, Math.min(3.0, ef));
  return Math.round(((clamped - 1.3) / (3.0 - 1.3)) * 100);
}

function retentionBand(percent: number): {
  label: string;
  chipClass: string;
} {
  if (percent >= 75) {
    return { label: 'Strong', chipClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
  if (percent >= 50) {
    return { label: 'Steady', chipClass: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  return { label: 'Needs work', chipClass: 'bg-rose-100 text-rose-700 border-rose-200' };
}

function isOverdue(item: ReviewItem): boolean {
  return new Date(item.next_review_at).getTime() < Date.now();
}

function formatDue(item: ReviewItem): string {
  const t = new Date(item.next_review_at).getTime();
  const ms = t - Date.now();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (ms < 0) {
    const overdueDays = Math.abs(days);
    return overdueDays === 0 ? 'Due today' : `Overdue ${overdueDays}d`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Added your live generated course ID to the labels list for a polished UI
const COURSE_LABELS: Record<string, string> = {
  'mock-course-1': 'Algebra Foundations',
  'mock-course-2': 'World History 101',
  '6a5cf17d8ae72826b72ee2de': 'Demo Spaced Repetition Course',
};

function courseLabel(courseId: string): string {
  return COURSE_LABELS[courseId] ?? courseId;
}

// ── Per-course retention card ─────────────────────────────────────────────

function CourseRetentionCard({
  studentId,
  courseId,
}: {
  studentId: string;
  courseId: string;
}) {
  const { data, isLoading } = useGetCourseRetention(studentId, courseId);
  const updatePref = useUpdateNotificationPreference(studentId);

  function handleOptOutChange(checked: boolean) {
    updatePref.mutate(
      { courseId, optOut: checked },
      {
        onSuccess: res => {
          toast.success(
            checked
              ? `Muted review reminders for ${courseLabel(courseId)} (${res.updatedCount} cards)`
              : `Unmuted review reminders for ${courseLabel(courseId)}`,
          );
        },
        onError: err => {
          toast.error(
            err instanceof Error
              ? `Couldn't update preference: ${err.message}`
              : "Couldn't update preference.",
          );
        },
      },
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-2/5 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const retentionPercent = efToRetentionPercent(data.averageEF);
  const band = retentionBand(retentionPercent);
  const optedOut = data.items.some(i => i.notification_opt_out);
  
  // SYNC CHECK: Detect if the teacher turned on Exam Prep Mode for items in this course
  const isExamPrepActive = data.items.some(i => i.exam_prep_mode === true);

  return (
    <Card className={isExamPrepActive ? 'border-amber-500 shadow-sm ring-1 ring-amber-500/30' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-1.5">
              {courseLabel(data.courseId)}
            </CardTitle>
            <CardDescription className="text-xs">
              {data.totalItems} card{data.totalItems === 1 ? '' : 's'} tracked
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={band.chipClass}>
              {band.label}
            </Badge>
            {/* SYNC VISIBILITY: Show the real-time teacher override status */}
            {isExamPrepActive && (
              <Badge className="bg-amber-600 hover:bg-amber-600 text-white border-none flex items-center gap-0.5 text-[10px] px-1.5 py-0 mt-1 animate-pulse">
                <Flame className="h-3 w-3 fill-current" /> Exam Prep Active
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Counts row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border bg-rose-50/50 border-rose-200/60 p-2">
            <div className="text-lg font-semibold text-rose-700">
              {data.overdueCount}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Due now
            </div>
          </div>
          <div className="rounded-md border bg-amber-50/50 border-amber-200/60 p-2">
            <div className="text-lg font-semibold text-amber-700">
              {data.dueSoonCount}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Due ≤ 7d
            </div>
          </div>
          <div className="rounded-md border bg-emerald-50/50 border-emerald-200/60 p-2">
            <div className="text-lg font-semibold text-emerald-700">
              {retentionPercent}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Retention
            </div>
          </div>
        </div>

        {/* Retention bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Retention health</span>
            <span>avg EF {data.averageEF.toFixed(2)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${
                retentionPercent >= 75
                  ? 'bg-emerald-500'
                  : retentionPercent >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
              style={{ width: `${retentionPercent}%` }}
            />
          </div>
        </div>

        {/* Opt-out toggle */}
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            {optedOut ? (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Bell className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Review reminders</span>
          </div>
          <Switch
            checked={!optedOut}
            onCheckedChange={checked => handleOptOutChange(!checked)}
            disabled={updatePref.isPending}
            aria-label={
              optedOut
                ? `Re-enable review reminders for ${courseLabel(data.courseId)}`
                : `Mute review reminders for ${courseLabel(data.courseId)}`
            }
          />
        </div>

        {/* TARGETED SELECTION: Student explicitly selects this slot path */}
        {data.overdueCount > 0 && (
          <Link
            to="/student/review"
            search={{ courseId: data.courseId }}
            className="flex items-center justify-between text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Start review for this course
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ── Schedule row ──────────────────────────────────────────────────────────

function ScheduleRow({ item }: { item: ReviewItem }) {
  const overdue = isOverdue(item);
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-2 w-2 shrink-0 rounded-full ${
            overdue ? 'bg-rose-500' : 'bg-emerald-500'
          }`}
        />
        <div className="min-w-0">
          <div className="font-medium truncate">
            {courseLabel(item.course_id)}
          </div>
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
            <span>Q {item.question_id}</span>
            <span>•</span>
            <span>EF {item.EF.toFixed(2)}</span>
            <span>•</span>
            <span>last reviewed {formatDate(item.last_reviewed_at)}</span>
            {item.exam_prep_mode && (
              <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-800 text-[9px] px-1 py-0 h-3.5 border border-amber-200">
                Exam Prep
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div
        className={`text-xs font-medium whitespace-nowrap ${
          overdue ? 'text-rose-600' : 'text-muted-foreground'
        }`}
      >
        {formatDue(item)}
      </div>
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────────

export default function RetentionDashboard() {
  const { user } = useAuthStore();
  // In demo-mode (mock data), the Firebase emulator returns an auto-generated
  // uid for student@test.com that doesn't match the seeded DEMO_STUDENT_ID.
  // Map known demo emails to the demo uid so the dashboard sees the seeded
  // schedule. In production (USE_MOCK=false), this is a no-op.
  const studentId =
    isDemoStudentEmail(user?.email) ? DEMO_STUDENT_ID : (user?.uid ?? '');

  const { data: schedule, isLoading: isScheduleLoading } =
    useGetSchedule(studentId);

  // Knob 6: detect whether this student has SR turned off by a teacher.
  // When true, the dashboard shows a distinct empty state (no actionable CTA)
  // instead of the "no schedules yet" copy which implies "complete a quiz".
  const { data: srStatus } = useGetStudentSRStatus(studentId);
  const srDisabled = srStatus?.sr_disabled === true;

  const courseIds = useMemo(() => {
    if (!schedule) return [] as string[];
    return Array.from(new Set(schedule.map(i => i.course_id))).sort();
  }, [schedule]);

  const dueNowCount = useMemo(() => {
    if (!schedule) return 0;
    return schedule.filter(isOverdue).length;
  }, [schedule]);

  const sortedSchedule = useMemo(() => {
    if (!schedule) return [] as ReviewItem[];
    // Surfaces Exam Prep items first, then sorts chronologically
    return [...schedule].sort((a, b) => {
      if (a.exam_prep_mode && !b.exam_prep_mode) return -1;
      if (!a.exam_prep_mode && b.exam_prep_mode) return 1;
      return new Date(a.next_review_at).getTime() - new Date(b.next_review_at).getTime();
    });
  }, [schedule]);

  if (!user) {
    return (
      <Card className="max-w-xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Retention dashboard</CardTitle>
          <CardDescription>Sign in to view your review health.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto mt-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Brain className="h-6 w-6" /> Retention dashboard
            <InfoPopover title={SPACED_REPETITION_INFO_TITLE}>
              <SpacedRepetitionInfoBody />
            </InfoPopover>
            <GoldenButton />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a specific subject below to clear its queue, or review all items chronologically.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/student/review">
            {dueNowCount > 0 ? `Review All (${dueNowCount} due)` : 'Review All'}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-rose-700" />
            </div>
            <div>
              <div className="text-2xl font-semibold leading-tight">
                {isScheduleLoading ? (
                  <Skeleton className="h-7 w-10 inline-block" />
                ) : (
                  dueNowCount
                )}
              </div>
              <div className="text-xs text-muted-foreground">Due right now</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <div className="text-2xl font-semibold leading-tight">
                {isScheduleLoading ? (
                  <Skeleton className="h-7 w-10 inline-block" />
                ) : (
                  courseIds.length
                )}
              </div>
              <div className="text-xs text-muted-foreground">Active courses</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <div className="text-2xl font-semibold leading-tight">
                {isScheduleLoading ? (
                  <Skeleton className="h-7 w-10 inline-block" />
                ) : (
                  sortedSchedule.length
                )}
              </div>
              <div className="text-xs text-muted-foreground">Tracked cards</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-course retention grid */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Courses Needing Revision</h2>
        {isScheduleLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : courseIds.length === 0 ? (
          srDisabled ? (
            // Knob 6: teacher has turned SR off for this student. Distinct
            // empty-state copy with no CTA — nothing for the student to do.
            <Card className="border-2 border-dashed border-amber-300/60 bg-gradient-to-br from-amber-50/40 via-background to-background">
              <CardContent className="flex flex-col items-center gap-4 py-12 px-6 text-center">
                <div className="rounded-full bg-amber-100 p-4 ring-1 ring-amber-300/40 dark:bg-amber-950/40 dark:ring-amber-700/40">
                  <Ban className="h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-base font-semibold tracking-tight">
                    Spaced repetition is paused for your account
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your teacher has disabled this for you. If you’d like it
                    re-enabled, please reach out to them directly.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card className="border-2 border-dashed border-muted/60 bg-gradient-to-br from-muted/30 via-background to-background">
            <CardContent className="flex flex-col items-center gap-4 py-12 px-6 text-center">
              <div className="rounded-full bg-primary/10 p-4 ring-1 ring-primary/20">
                <BookOpen className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-base font-semibold tracking-tight">
                  No review schedules yet
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Complete a quiz in any course and we'll automatically seed a
                  spaced-repetition schedule for the questions you attempted.
                </p>
              </div>
            </CardContent>
          </Card>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courseIds.map(courseId => (
              <CourseRetentionCard
                key={courseId}
                studentId={studentId}
                courseId={courseId}
              />
            ))}
          </div>
        )}
      </section>

      {/* Full schedule list */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Upcoming Queue Priority</h2>
        <Card>
          <CardContent className="py-4 space-y-2">
            {isScheduleLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : sortedSchedule.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="rounded-full bg-muted p-2">
                  <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Inbox zero</p>
                  <p className="text-xs text-muted-foreground">
                    Nothing due in the next few weeks.
                  </p>
                </div>
              </div>
            ) : (
              sortedSchedule.map(item => (
                <ScheduleRow key={item._id} item={item} />
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
    </>
  );
}