import { Trophy, Flame, Crown, Medal, Award, Zap, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCompletionTime } from "@/utils/utils";
import type { LeaderboardEntry } from "@/hooks/hooks";
import { FinisherMarquee } from "@/components/course/FinisherMarquee";

type League = "finishers" | "active";

const getInitials = (name: string) => {
  const parts = name.trim().split(" ").filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

const rankChip = (rank: number) => {
  switch (rank) {
    case 1:
      return {
        bg: "bg-gradient-to-br from-amber-400 to-amber-600",
        text: "text-amber-950",
        icon: <Crown className="h-3.5 w-3.5 text-amber-500" />,
      };
    case 2:
      return {
        bg: "bg-gradient-to-br from-slate-300 to-slate-500",
        text: "text-slate-900",
        icon: <Medal className="h-3.5 w-3.5 text-slate-400" />,
      };
    case 3:
      return {
        bg: "bg-gradient-to-br from-orange-300 to-orange-500",
        text: "text-orange-900",
        icon: <Award className="h-3.5 w-3.5 text-orange-500" />,
      };
    default:
      return { bg: "bg-muted", text: "text-muted-foreground", icon: null };
  }
};

function Row({
  entry,
  league,
  isMe,
}: {
  entry: LeaderboardEntry;
  league: League;
  isMe: boolean;
}) {
  const chip = rankChip(entry.rank);
  const isFinisher = league === "finishers";
  const days = entry.daysToComplete;
  const week = entry.weeklyItems ?? 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg border transition-all bg-card hover:shadow-sm",
        entry.rank <= 3 ? "border-border" : "border-transparent bg-muted/20",
        isMe && "ring-2 ring-primary bg-primary/[0.04] border-primary/30"
      )}
    >
      {/* Rank */}
      <div className="w-8 text-center shrink-0">
        {entry.rank <= 3 ? (
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center mx-auto",
              chip.bg
            )}
          >
            <span className={cn("font-bold text-xs", chip.text)}>
              {entry.rank}
            </span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">
            {entry.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <Avatar className="h-9 w-9 shrink-0 border border-background shadow-sm">
        <AvatarFallback className="text-xs">
          {getInitials(entry.userName)}
        </AvatarFallback>
      </Avatar>

      {/* Name + sub */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate text-sm flex items-center gap-1.5">
          {entry.userName}
          {entry.rank === 1 && chip.icon}
          {isMe && <span className="text-xs text-primary font-medium">(You)</span>}
        </p>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          {isFinisher ? (
            <>
              <span className="text-emerald-600 font-medium">✓ Completed</span>
              {days != null && <span>· in {formatCompletionTime(days)}</span>}
            </>
          ) : (
            <>
              <Zap className="h-3 w-3 text-orange-500 shrink-0" />
              In progress · {Math.floor(entry.completionPercentage)}%
            </>
          )}
        </p>
      </div>

      {/* Metric — active w/ no recent activity falls back to % progress */}
      {(() => {
        const tone = isFinisher
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : week > 0
          ? "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
        const value = isFinisher
          ? formatCompletionTime(days, true)
          : week > 0
          ? `${week}`
          : `${Math.floor(entry.completionPercentage)}%`;
        const caption = isFinisher
          ? "to finish"
          : week > 0
          ? "this week"
          : "progress";
        return (
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-md px-2.5 py-1 shrink-0 min-w-[58px]",
              tone
            )}
          >
            <span className="text-sm font-extrabold leading-none tabular-nums">
              {value}
            </span>
            <span className="text-[9px] uppercase tracking-wide">{caption}</span>
          </div>
        );
      })()}
    </div>
  );
}

function Section({
  league,
  entries,
  myId,
  empty,
}: {
  league: League;
  entries: LeaderboardEntry[];
  myId?: string;
  empty: string;
}) {
  const meta =
    league === "finishers"
      ? {
          Icon: Trophy,
          color: "text-amber-500",
          title: "Finishers",
          blurb: "fastest from their own start date",
        }
      : {
          Icon: Flame,
          color: "text-orange-500",
          title: "This Week",
          blurb: "effort in the last 7 days",
        };
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
        <meta.Icon className={cn("h-4 w-4", meta.color)} />
        <h4 className="font-semibold text-sm">{meta.title} League</h4>
        <span className="text-xs text-muted-foreground">· {meta.blurb}</span>
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4 flex items-center justify-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {empty}
        </p>
      ) : league === "finishers" ? (
        // Finishers shown as a horizontal "hall of fame" marquee
        <FinisherMarquee finishers={entries} myId={myId} />
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <Row
              key={entry.userId}
              entry={entry}
              league={league}
              isMe={entry.userId === myId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LeaderboardLeagues({
  finishers,
  active,
  myId,
}: {
  finishers: LeaderboardEntry[];
  active: LeaderboardEntry[];
  myId?: string;
}) {
  return (
    <div className="space-y-5 pb-4">
      <Section
        league="finishers"
        entries={finishers}
        myId={myId}
        empty="No finishers yet — claim the first spot! 🏁"
      />
      <Section
        league="active"
        entries={active}
        myId={myId}
        empty="No activity in the last 7 days yet."
      />
    </div>
  );
}
