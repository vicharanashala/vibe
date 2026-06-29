import { Card } from "@/components/ui/card";
import { cn } from "@/utils/utils";
import type { ContentMix } from "./analytics-utils";

const BAR_TONES: Record<ContentMix["key"], string> = {
  videos: "bg-violet-500",
  quizzes: "bg-blue-500",
  articles: "bg-emerald-500",
  projects: "bg-amber-500",
};

/** Per content-type completion (videos / quizzes / articles / projects). */
export function ContentMixCard({ mix }: { mix: ContentMix[] }) {
  return (
    <Card className="h-full rounded-2xl border p-5">
      <h3 className="text-sm font-semibold text-foreground">Content completed</h3>
      <p className="mb-4 text-xs text-muted-foreground">Across all your courses, by type</p>

      {mix.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No content data yet.</p>
      ) : (
        <div className="space-y-3.5">
          {mix.map((m) => {
            const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
            return (
              <div key={m.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{m.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {m.done}/{m.total} <span className="font-semibold text-foreground">· {pct}%</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                  <div className={cn("h-full rounded-full transition-all duration-700 ease-out", BAR_TONES[m.key])} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
