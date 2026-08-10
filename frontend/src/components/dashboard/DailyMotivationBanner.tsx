import { Flame, Zap } from "lucide-react";
import { cn } from "@/utils/utils";

interface DailyMotivationBannerProps {
  currentStreak: number;
  longestStreak: number;
  isActiveToday: boolean;
  nextMilestone: number | null;
}

function pickMessage(currentStreak: number, isActiveToday: boolean, nextMilestone: number | null): {
  headline: string;
  sub: string;
} {
  if (currentStreak === 0) {
    return {
      headline: "Start your streak today",
      sub: "Learn a little every day. Your first 3-day milestone is closer than you think.",
    };
  }
  if (!isActiveToday) {
    return {
      headline: `${currentStreak}-day streak — don't break it!`,
      sub: "A quick session today keeps the flame alive and protects your progress.",
    };
  }
  if (nextMilestone) {
    const remaining = nextMilestone - currentStreak;
    if (remaining <= 2) {
      return {
        headline: `${remaining} day${remaining === 1 ? "" : "s"} to a ${nextMilestone}-day milestone!`,
        sub: "So close — push through to land a new achievement.",
      };
    }
    return {
      headline: `You're on a ${currentStreak}-day streak — keep the momentum!`,
      sub: `Daily consistency compounds. Next milestone: ${nextMilestone} days.`,
    };
  }
  return {
    headline: `Outstanding — a ${currentStreak}-day streak!`,
    sub: "You've cleared every milestone. Keep shining.",
  };
}

/**
 * Daily motivation banner for the learning streak. Renders a short,
 * state-appropriate message (start / keep-alive / near-milestone / celebration)
 * so the ring and the words always agree. Pure/presentational.
 */
export function DailyMotivationBanner({
  currentStreak,
  longestStreak,
  isActiveToday,
  nextMilestone,
}: DailyMotivationBannerProps) {
  const message = pickMessage(currentStreak, isActiveToday, nextMilestone);
  const active = currentStreak > 0;

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-center gap-3 rounded-3xl border p-6 ring-1 ring-black/[0.02] sm:p-7",
        active
          ? "border-orange-200/70 bg-gradient-to-br from-orange-50 to-transparent dark:border-orange-500/20 dark:from-orange-500/[0.08]"
          : "border-neutral-200/70 bg-white dark:border-white/[0.06] dark:bg-white/[0.03]",
      )}
    >
      <span
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
          active
            ? "bg-orange-100 text-orange-600 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:ring-orange-500/20"
            : "bg-primary/10 text-primary ring-primary/20",
        )}
      >
        {active ? <Flame className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          {message.headline}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{message.sub}</p>
      </div>
      {longestStreak > 0 && (
        <p className="text-xs font-medium text-muted-foreground">
          Best streak so far: <span className="font-bold text-foreground">{longestStreak} days</span>
        </p>
      )}
    </div>
  );
}