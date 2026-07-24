import { Card } from "@/components/ui/card";
import { cn } from "@/utils/utils";
import type { CourseAnalytics } from "./analytics-utils";

const tone = (pct: number) =>
  pct >= 75 ? "text-emerald-600 dark:text-emerald-400"
  : pct >= 50 ? "text-amber-600 dark:text-amber-400"
  : "text-red-600 dark:text-red-400";

/** Soft pill (bg + text) for a score grade — reads as a mark, not progress. */
const gradePill = (pct: number) =>
  pct >= 75 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
  : pct >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
  : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";

/** Quiz accuracy overall + per course that has graded quizzes. */
export function QuizPerformanceCard({ courses, average }: { courses: CourseAnalytics[]; average: number | null }) {
  const scored = courses.filter((c) => c.quizPercent != null);

  return (
    <Card className="h-full rounded-2xl border p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Quiz performance</h3>
          <p className="text-xs text-muted-foreground">Average score across graded quizzes</p>
        </div>
        <span className={cn("text-3xl font-bold tabular-nums", average != null ? tone(average) : "text-muted-foreground")}>
          {average != null ? `${average}%` : "—"}
        </span>
      </div>

      {scored.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No graded quizzes yet.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {scored.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate text-sm font-medium text-foreground" title={c.name}>{c.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-xs text-muted-foreground">{c.quizScore}/{c.quizMaxScore}</span>
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold tabular-nums", gradePill(c.quizPercent || 0))}>
                  {c.quizPercent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
