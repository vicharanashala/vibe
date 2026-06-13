import { Crown, Medal, Award, Trophy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCompletionTime } from "@/utils/utils";
import type { LeaderboardEntry } from "@/hooks/hooks";

const getInitials = (name: string) => {
  const parts = name.trim().split(" ").filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

const medal = (rank: number) => {
  switch (rank) {
    case 1:
      return { Icon: Crown, color: "text-amber-500", ring: "ring-amber-400" };
    case 2:
      return { Icon: Medal, color: "text-slate-400", ring: "ring-slate-300" };
    case 3:
      return { Icon: Award, color: "text-orange-500", ring: "ring-orange-300" };
    default:
      return { Icon: Trophy, color: "text-emerald-500", ring: "ring-emerald-200" };
  }
};

function FinisherChip({
  entry,
  isMe,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
}) {
  const m = medal(entry.rank);
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 shrink-0 rounded-xl px-3 py-2",
        "border border-emerald-200 dark:border-emerald-900/50",
        "bg-gradient-to-br from-white to-emerald-50/70 dark:from-slate-900 dark:to-emerald-950/30",
        "shadow-[0_2px_12px_-2px_rgba(16,185,129,0.25)]",
        isMe && "ring-2 ring-primary border-primary"
      )}
    >
      <div className="flex flex-col items-center w-6 shrink-0">
        <m.Icon className={cn("h-4 w-4", m.color)} />
        <span className="text-[10px] font-bold text-foreground/70 tabular-nums">
          {entry.rank}
        </span>
      </div>
      <Avatar className={cn("h-9 w-9 ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900", m.ring)}>
        <AvatarFallback className="text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
          {getInitials(entry.userName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground truncate max-w-[150px] leading-tight">
          {entry.userName}
          {isMe && <span className="text-primary"> (You)</span>}
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
          🏁 {formatCompletionTime(entry.daysToComplete)}
        </p>
      </div>
    </div>
  );
}

/**
 * Horizontal auto-scrolling "hall of fame" ribbon of finishers.
 * The track is duplicated once so the CSS translateX(-50%) loop is seamless.
 * Pauses on hover; respects prefers-reduced-motion (see globals.css).
 */
export function FinisherMarquee({
  finishers,
  myId,
}: {
  finishers: LeaderboardEntry[];
  myId?: string;
}) {
  if (!finishers.length) return null;

  // Only the fastest finishers ride the ribbon — rendering hundreds of chips
  // (×2 for the loop) freezes the page. The full list lives in the dialog/list.
  const MAX = 25;
  const shown = finishers.slice(0, MAX);
  const overflow = finishers.length - shown.length;

  // Duplicate for a seamless loop. With very few finishers, repeat more so the
  // track is wide enough to fill the viewport before looping.
  const reps = shown.length < 6 ? 4 : 2;
  const loop = Array.from({ length: reps }, () => shown).flat();

  // The track scrolls by translateX(-50%), i.e. past (reps/2 * count) chips per
  // cycle. Pace it at ~6s per chip so it reads comfortably — slow, not a blur.
  const chipsPerCycle = (reps / 2) * shown.length;
  const duration = Math.min(160, Math.max(30, chipsPerCycle * 6));

  return (
    <div className="flex items-center gap-3">
      <div
        className="lb-marquee group relative overflow-hidden py-1 flex-1 min-w-0"
        style={
          {
            ["--lb-marquee-duration" as any]: `${duration}s`,
          } as React.CSSProperties
        }
      >
        <div className="lb-marquee-track flex gap-3 w-max py-1">
          {loop.map((entry, i) => (
            <FinisherChip
              key={`${entry.userId}-${i}`}
              entry={entry}
              isMe={entry.userId === myId}
            />
          ))}
        </div>
      </div>
      {overflow > 0 && (
        <div className="shrink-0 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-center">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 leading-tight">
            +{overflow}
          </p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wide">
            more
          </p>
        </div>
      )}
    </div>
  );
}
