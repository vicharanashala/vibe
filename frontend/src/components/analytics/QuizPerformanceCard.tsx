import { Card } from "@/components/ui/card";
import { cn } from "@/utils/utils";
import type { CourseAnalytics } from "./analytics-utils";

const tone = (pct: number) =>
  pct >= 75 ? "text-emerald-600 dark:text-emerald-400"
  : pct >= 50 ? "text-amber-600 dark:text-amber-400"
  : "text-red-600 dark:text-red-400";

const barTone = (pct: number) =>
  pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";

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
        <div className="space-y-3">
          {scored.map((c) => (
            <div key={c.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-foreground" title={c.name}>{c.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {c.quizScore}/{c.quizMaxScore} · <span className={cn("font-semibold", tone(c.quizPercent || 0))}>{c.quizPercent}%</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                <div className={cn("h-full rounded-full transition-all duration-700 ease-out", barTone(c.quizPercent || 0))} style={{ width: `${c.quizPercent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
