import { Card } from "@/components/ui/card";
import { TrendingUp, CalendarClock } from "lucide-react";
import type { CourseAnalytics } from "./analytics-utils";

function projectedDateLabel(days: number | null): string {
  if (days == null) return "—";
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Learning pace: combined items/week and a projected finish date for the
 * course you're closest to completing (the most actionable target).
 */
export function VelocityCard({ itemsPerWeek, courses }: { itemsPerWeek: number; courses: CourseAnalytics[] }) {
  // Most actionable: in-progress course with a measurable pace, highest progress first.
  const target = courses
    .filter((c) => c.progress > 0 && c.progress < 100 && c.projectedFinishDays != null)
    .sort((a, b) => b.progress - a.progress)[0];

  return (
    <Card className="h-full rounded-2xl border p-5">
      <h3 className="text-sm font-semibold text-foreground">Learning pace</h3>
      <p className="mb-4 text-xs text-muted-foreground">Your momentum and a finish estimate</p>

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <TrendingUp className="h-5 w-5" />
        </span>
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{itemsPerWeek}</p>
          <p className="text-xs text-muted-foreground">lessons / week (active courses)</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
        {target ? (
          <div className="flex items-start gap-2.5">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">At this pace you'll finish</p>
              <p className="truncate text-sm font-semibold text-foreground" title={target.name}>{target.name}</p>
              <p className="text-xs text-muted-foreground">
                by <span className="font-semibold text-foreground">{projectedDateLabel(target.projectedFinishDays)}</span>
                {target.projectedFinishDays != null && ` · ~${target.projectedFinishDays} days`}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Complete a few more lessons to unlock a finish estimate.
          </p>
        )}
      </div>
    </Card>
  );
}
