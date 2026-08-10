import { Flame } from "lucide-react";
import { cn } from "@/utils/utils";

interface StreakProgressRingProps {
  currentStreak: number;
  /** Day-count of the next milestone, or null when all milestones are passed. */
  nextMilestone: number | null;
  /** 0–1 progress from the current streak toward the next milestone. */
  progressToNext: number;
  isActiveToday: boolean;
}

const SIZE = 168;
const STROKE = 13;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

/**
 * Learning-streak progress ring. Shows the current day streak with a ring that
 * fills toward the next milestone (e.g. 4 → next at 7). Presented as a flame
 * that dims when today's activity is still pending.
 */
export function StreakProgressRing({
  currentStreak,
  nextMilestone,
  progressToNext,
  isActiveToday,
}: StreakProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, progressToNext || 0));

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative"
        style={{ width: SIZE, height: SIZE }}
        aria-label={`${currentStreak}-day learning streak`}
      >
        {/* Track */}
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-neutral-200 dark:stroke-white/10"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeLinecap="round"
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
            className={cn(
              "transition-all duration-700 ease-out",
              isActiveToday
                ? "stroke-orange-500"
                : "stroke-neutral-400 dark:stroke-neutral-500",
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Flame
            className={cn(
              "h-5 w-5",
              isActiveToday
                ? "text-orange-500"
                : "text-neutral-400 dark:text-neutral-500",
            )}
          />
          <span className="mt-0.5 text-3xl font-extrabold tabular-nums text-foreground">
            {currentStreak}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            day streak
          </span>
        </div>
      </div>

      {nextMilestone ? (
        <p className="text-center text-xs font-medium text-muted-foreground">
          <span className="font-bold text-foreground">{currentStreak}</span> of{" "}
          {nextMilestone} days{" "}
          <span className="text-orange-500 dark:text-orange-400">
            {Math.round(clamped * 100)}%
          </span>
        </p>
      ) : (
        <p className="text-center text-xs font-medium text-primary">
          Max streak reached — amazing!
        </p>
      )}
    </div>
  );
}