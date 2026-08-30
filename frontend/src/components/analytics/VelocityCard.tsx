import { Card } from "@/components/ui/card";
import { Flag } from "lucide-react";
import { cn } from "@/utils/utils";
import { closestToFinishing, progressTone, type CourseAnalytics } from "./analytics-utils";

/**
 * "Closest to finishing" — your quickest wins. Truthful and actionable: just
 * progress and lessons remaining (no fabricated pace/date projections, which
 * the available data can't support reliably).
 */
export function VelocityCard({ courses }: { courses: CourseAnalytics[] }) {
  const targets = closestToFinishing(courses, 3);

  return (
    <Card className="h-full rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Flag className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Closest to finishing</h3>
          <p className="text-xs text-muted-foreground">Your quickest wins — wrap these up next</p>
        </div>
      </div>

      {targets.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No courses in progress right now.</p>
      ) : (
        <div className="space-y-3.5">
          {targets.map((c) => (
            <div key={c.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground" title={c.name}>{c.name}</span>
                <span className="shrink-0 tabular-nums text-xs font-semibold text-foreground">{c.progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                <div className={cn("h-full rounded-full transition-all duration-700 ease-out", progressTone(c.progress))} style={{ width: `${c.progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.remaining > 0 ? `${c.remaining} lesson${c.remaining === 1 ? "" : "s"} left` : "Final items remaining"}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
