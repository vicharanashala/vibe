import { Card } from "@/components/ui/card";
import { cn } from "@/utils/utils";
import { STATUS_META, progressTone, type CourseAnalytics } from "./analytics-utils";

/** Per-course breakdown: progress, lessons, quiz score, pace and status. */
export function CourseBreakdownTable({ courses }: { courses: CourseAnalytics[] }) {
  return (
    <Card className="rounded-2xl border p-0">
      <div className="border-b p-5">
        <h3 className="text-sm font-semibold text-foreground">Course breakdown</h3>
        <p className="text-xs text-muted-foreground">Progress, accuracy and pace for every course</p>
      </div>

      {courses.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No courses to analyze yet.</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Course</th>
                <th className="px-3 py-2.5 font-medium">Progress</th>
                <th className="px-3 py-2.5 font-medium">Lessons</th>
                <th className="px-3 py-2.5 font-medium">Quiz</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const meta = STATUS_META[c.status];
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="max-w-[220px] px-5 py-3">
                      <p className="truncate font-medium text-foreground" title={c.name}>{c.name}</p>
                      {c.cohortName && <p className="truncate text-xs text-muted-foreground">{c.cohortName}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                          <div className={cn("h-full rounded-full", progressTone(c.progress))} style={{ width: `${c.progress}%` }} />
                        </div>
                        <span className="tabular-nums text-xs font-semibold text-foreground">{c.progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{c.completedItems}/{c.totalItems}</td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{c.quizPercent != null ? `${c.quizPercent}%` : "—"}</td>
                    <td className="px-5 py-3">
                      <span className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-medium", meta.className)}>{meta.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
