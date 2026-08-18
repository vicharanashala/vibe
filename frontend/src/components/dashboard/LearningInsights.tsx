import { useMemo } from "react";
import { Target, BookOpen, ArrowRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import type { CourseCardProps } from "@/types/course.types";

type Enrollment = CourseCardProps["enrollment"];

interface LearningInsightsProps {
  /** Active (not-yet-completed) enrollments, as already computed by the dashboard. */
  activeEnrollments: Enrollment[];
  isLoading?: boolean;
  /** Called when the student has no active courses (primary CTA → catalog). */
  onBrowse: () => void;
  /** Resume a specific course (primary CTA on the "next best action"). */
  onResume: (enrollment: Enrollment) => void;
}

/** A course paired with a clamped 0–100 progress number, for ranking. */
type RankedCourse = { enrollment: Enrollment; name: string; progress: number };

const ALMOST_DONE_THRESHOLD = 75;

function courseName(e: Enrollment): string {
  return (e as any)?.course?.name || "your course";
}

function progressOf(e: Enrollment): number {
  const p = Number((e as any)?.percentCompleted ?? 0);
  if (Number.isNaN(p)) return 0;
  return Math.max(0, Math.min(100, Math.round(p)));
}

/**
 * Read-only "Learning Insights" panel. Pure/presentational — it derives all of
 * its content from data the dashboard already fetches (enrollment stats +
 * active enrollments) and never fetches or mutates anything itself. The "next
 * best action" is a simple, transparent rule: finish a nearly-done course if
 * one exists, else continue the most-progressed one, else browse the catalog.
 */
export function LearningInsights({
  activeEnrollments,
  isLoading,
  onBrowse,
  onResume,
}: LearningInsightsProps) {
  const ranked = useMemo<RankedCourse[]>(
    () =>
      (activeEnrollments || [])
        .map((e) => ({ enrollment: e, name: courseName(e), progress: progressOf(e) }))
        .sort((a, b) => b.progress - a.progress),
    [activeEnrollments],
  );

  // The single highest-value next step, chosen by a transparent rule.
  const recommendation = useMemo(() => {
    const almostDone = ranked.find((c) => c.progress >= ALMOST_DONE_THRESHOLD && c.progress < 100);
    if (almostDone) {
      return {
        tone: "emerald" as const,
        icon: <Flame className="h-5 w-5" />,
        title: `You're almost there — finish ${almostDone.name}`,
        body: `Just ${100 - almostDone.progress}% to go. A short push wraps up this course.`,
        cta: "Resume course",
        onClick: () => onResume(almostDone.enrollment),
      };
    }
    const continueCourse = ranked[0];
    if (continueCourse) {
      return {
        tone: "violet" as const,
        icon: <Target className="h-5 w-5" />,
        title: `Pick up where you left off in ${continueCourse.name}`,
        body: `You're ${continueCourse.progress}% through. Keep the momentum going.`,
        cta: "Continue learning",
        onClick: () => onResume(continueCourse.enrollment),
      };
    }
    return {
      tone: "amber" as const,
      icon: <BookOpen className="h-5 w-5" />,
      title: "Start your learning journey",
      body: "Browse the catalog and enroll in a course to see your insights here.",
      cta: "Browse courses",
      onClick: onBrowse,
    };
  }, [ranked, onBrowse, onResume]);

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-neutral-200/70 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.06] dark:bg-white/[0.03] dark:ring-white/[0.04]">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-24 w-full animate-pulse rounded-2xl bg-muted" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-neutral-200/70 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.06] dark:bg-white/[0.03] dark:ring-white/[0.04] sm:p-7">
      <div className="mb-5">
        <h2 className="text-lg font-bold tracking-tight text-foreground">Where you left</h2>
        <p className="text-xs text-muted-foreground">Your next step</p>
      </div>

      {/* Next best action */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-5",
          "border-neutral-200/80 bg-gradient-to-br from-primary/[0.06] to-transparent",
          "dark:border-white/[0.07] dark:from-primary/[0.12]",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              {recommendation.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Next best action</p>
              <p className="truncate text-base font-bold text-foreground">{recommendation.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{recommendation.body}</p>
            </div>
          </div>
          <Button onClick={recommendation.onClick} className="shrink-0 gap-1.5 rounded-xl">
            {recommendation.cta}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Closest to finishing — a gentle nudge toward easy wins */}
      {ranked.some((c) => c.progress >= ALMOST_DONE_THRESHOLD && c.progress < 100) && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Closest to finishing</p>
          <div className="space-y-2">
            {ranked
              .filter((c) => c.progress >= ALMOST_DONE_THRESHOLD && c.progress < 100)
              .slice(0, 2)
              .map((c) => (
                <div
                  key={(c.enrollment as any)?._id || c.name}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200/70 bg-neutral-50/60 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{c.name}</span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${c.progress}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                    {c.progress}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

