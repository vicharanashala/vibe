import {
  Trophy,
  Medal,
  Award,
  Crown,
  RefreshCw,
  Flame,
  Clock,
  Sparkles,
  ChevronUp,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLeaderboard, useUserEnrollments, type LeaderboardEntry } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCompletionTime } from "@/utils/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { FinisherMarquee } from "@/components/course/FinisherMarquee";

type League = "finishers" | "active";

// ---------- helpers ----------

const getInitials = (name: string) => {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const firstName = (name: string) => name.trim().split(" ")[0] || name;

// Per-rank medal styling (gold / silver / bronze)
const podiumStyle = (rank: number) => {
  switch (rank) {
    case 1:
      return {
        ring: "ring-amber-400",
        ped: "from-amber-300 to-amber-500",
        chip: "bg-amber-400 text-amber-950",
        avatar: "bg-amber-100 text-amber-800 ring-amber-400",
        icon: <Crown className="h-5 w-5" />,
        glow: "shadow-[0_8px_30px_-8px_rgba(245,158,11,0.6)]",
        h: "h-28",
      };
    case 2:
      return {
        ring: "ring-slate-300",
        ped: "from-slate-200 to-slate-400",
        chip: "bg-slate-300 text-slate-800",
        avatar: "bg-slate-100 text-slate-700 ring-slate-300",
        icon: <Medal className="h-5 w-5" />,
        glow: "shadow-[0_8px_30px_-10px_rgba(100,116,139,0.5)]",
        h: "h-20",
      };
    default:
      return {
        ring: "ring-orange-300",
        ped: "from-orange-300 to-orange-500",
        chip: "bg-orange-300 text-orange-900",
        avatar: "bg-orange-100 text-orange-700 ring-orange-300",
        icon: <Award className="h-5 w-5" />,
        glow: "shadow-[0_8px_30px_-10px_rgba(249,115,22,0.5)]",
        h: "h-16",
      };
  }
};

type Tone = "emerald" | "orange" | "slate";

const TONE: Record<Tone, string> = {
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  orange:
    "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

// The headline metric shown for an entry, depending on its league.
// Active learners with no activity this week fall back to showing % progress
// (clearer than a wall of "0 items").
const metricOf = (
  entry: LeaderboardEntry,
  league: League
): { value: string; unit: string; caption: string; tone: Tone } => {
  if (league === "finishers") {
    return {
      value: formatCompletionTime(entry.daysToComplete, true),
      unit: "",
      caption: "to finish",
      tone: "emerald",
    };
  }
  const wk = entry.weeklyItems ?? 0;
  if (wk > 0) {
    return {
      value: `${wk}`,
      unit: wk === 1 ? "item" : "items",
      caption: "this week",
      tone: "orange",
    };
  }
  return {
    value: `${Math.floor(entry.completionPercentage)}%`,
    unit: "",
    caption: "progress",
    tone: "slate",
  };
};

const LEAGUES: Record<
  League,
  { label: string; blurb: string; emoji: string; Icon: typeof Trophy }
> = {
  finishers: {
    label: "Finishers",
    blurb: "Fastest from their own start date",
    emoji: "🏆",
    Icon: Trophy,
  },
  active: {
    label: "This Week",
    blurb: "Effort in the last 7 days",
    emoji: "🔥",
    Icon: Flame,
  },
};

export default function Leaderboard() {
  const currentCourse = useCourseStore.getState().currentCourse;

  const { data: enrollmentsData, isLoading: enrollmentsLoading } =
    useUserEnrollments(1, 1000);

  const [selectedCourseId, setSelectedCourseId] = useState(
    currentCourse?.courseId || ""
  );
  const [selectedVersionId, setSelectedVersionId] = useState(
    currentCourse?.versionId || ""
  );

  useEffect(() => {
    if (
      enrollmentsData?.enrollments &&
      enrollmentsData.enrollments.length > 0 &&
      !selectedCourseId
    ) {
      const first = enrollmentsData.enrollments[0];
      setSelectedCourseId(first.courseId);
      setSelectedVersionId(first.courseVersionId);
    }
  }, [enrollmentsData, selectedCourseId]);

  const { finishers, active, myStats, isLoading, isFetching, error, refetch } =
    useLeaderboard(
      selectedCourseId,
      selectedVersionId,
      1,
      100,
      !!selectedCourseId && !!selectedVersionId
    );

  // Celebrate a #1 standing once per course load.
  const celebratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!myStats || myStats.rank !== 1) return;
    const key = `${selectedCourseId}:${myStats.league}`;
    if (celebratedRef.current === key) return;
    celebratedRef.current = key;
    const colors = ["#fbbf24", "#f59e0b", "#fcd34d", "#fde68a"];
    confetti({ particleCount: 130, spread: 75, origin: { y: 0.3 }, colors });
  }, [myStats, selectedCourseId]);

  const handleCourseChange = (value: string) => {
    const enrollment = enrollmentsData?.enrollments?.find(
      (e) => `${e.courseId}-${e.courseVersionId}` === value
    );
    if (enrollment) {
      setSelectedCourseId(enrollment.courseId);
      setSelectedVersionId(enrollment.courseVersionId);
      celebratedRef.current = null;
    }
  };

  const getCourseName = (enrollment: any) =>
    enrollment?.course?.name || "Untitled Course";

  // ---------- loading / empty / error shells ----------

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="container mx-auto py-8 px-4 max-w-4xl">{children}</div>
  );

  if (enrollmentsLoading || isLoading) {
    return (
      <Shell>
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
            <div className="flex items-center gap-2 font-semibold text-xl">
              <Trophy className="h-6 w-6 text-amber-500" />
              Leaderboard
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-center gap-4 mb-6">
              {[20, 28, 16].map((h, i) => (
                <Skeleton key={i} className={`w-24`} style={{ height: h * 4 }} />
              ))}
            </div>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!enrollmentsData?.enrollments || enrollmentsData.enrollments.length === 0) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Trophy className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">
              You are not enrolled in any courses yet.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const nudge = getNudge(myStats, finishers, active);

  return (
    <Shell>
      <Card className="overflow-hidden border-border/60 shadow-sm">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                <Trophy className="h-6 w-6 text-amber-500" />
                Leaderboard
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Race your own pace — finish fast, or rack up effort every week.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")}
                />
                {isFetching ? "Refreshing" : "Refresh"}
              </Button>
              <Select
                value={`${selectedCourseId}-${selectedVersionId}`}
                onValueChange={handleCourseChange}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {enrollmentsData.enrollments.map((enrollment) => (
                    <SelectItem
                      key={`${enrollment.courseId}-${enrollment.courseVersionId}`}
                      value={`${enrollment.courseId}-${enrollment.courseVersionId}`}
                    >
                      {getCourseName(enrollment)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <p className="text-muted-foreground text-center py-8">{error}</p>
          )}

          {!error && finishers.length === 0 && active.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground">
                No learners on the board yet — be the first to make a move!
              </p>
            </div>
          )}

          {!error && (finishers.length > 0 || active.length > 0) && (
            <div className="space-y-6">
              {/* Your standing banner */}
              {myStats && <YourStanding myStats={myStats} nudge={nudge} />}

              {/* How it works — two leagues, explained in one line each */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/15 px-3 py-2.5">
                  <Trophy className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">🏆 Finishers</span> —
                    reached 100%, ranked by how <span className="font-medium text-foreground">few days</span> it
                    took from the day they joined. Starting late never counts against you.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-orange-200/70 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-950/15 px-3 py-2.5">
                  <Flame className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">🔥 This Week</span> —
                    still learning, ranked by <span className="font-medium text-foreground">items finished in the last 7 days</span>.
                    Show up each week to climb.
                  </p>
                </div>
              </div>

              {/* ===== League 1: Finishers — hall-of-fame marquee ===== */}
              <section className="rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/70 to-transparent dark:from-amber-950/20 p-4 sm:p-5">
                <LeagueHeader
                  league="finishers"
                  count={finishers.length}
                  tagline="Hall of Fame"
                />
                {finishers.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No one has finished yet — claim the first spot! 🏁
                  </div>
                ) : (
                  <FinisherMarquee finishers={finishers} myId={myStats?.userId} />
                )}
              </section>

              {/* ===== League 2: This Week — live competition ===== */}
              <section className="rounded-2xl border border-orange-200/60 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/70 to-transparent dark:from-orange-950/20 p-4 sm:p-5">
                <LeagueHeader
                  league="active"
                  count={active.length}
                  tagline="Live this week"
                />
                {active.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No activity this week yet. Complete an item to get on the board. 🔥
                  </div>
                ) : (
                  <div className="space-y-6">
                    {active.slice(0, 3).length > 0 && (
                      <Podium
                        top3={active.slice(0, 3)}
                        league="active"
                        meId={myStats?.userId}
                      />
                    )}
                    {active.slice(3).length > 0 && (
                      <div className="space-y-2">
                        {active.slice(3).map((entry, i) => (
                          <LeaderRow
                            key={entry.userId}
                            entry={entry}
                            league="active"
                            isMe={entry.userId === myStats?.userId}
                            index={i}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}

// ---------- League section header ----------

function LeagueHeader({
  league,
  count,
  tagline,
}: {
  league: League;
  count: number;
  tagline: string;
}) {
  const meta = LEAGUES[league];
  const accent =
    league === "finishers"
      ? "from-amber-400/15 to-transparent text-amber-600"
      : "from-orange-400/15 to-transparent text-orange-600";
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className={cn(
          "flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br",
          accent
        )}
      >
        <meta.Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold tracking-tight">
            {meta.emoji} {meta.label} League
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {count}
          </span>
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {tagline}
        </p>
      </div>
    </div>
  );
}

// ---------- Your standing hero banner ----------

function YourStanding({
  myStats,
  nudge,
}: {
  myStats: LeaderboardEntry;
  nudge: string | null;
}) {
  const league = (myStats.league ?? "active") as League;
  const meta = LEAGUES[league];
  const m = metricOf(myStats, league);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/[0.06] to-transparent p-5"
    >
      <div className="flex items-center gap-4">
        {/* Rank chip */}
        <div className="flex flex-col items-center justify-center rounded-xl bg-background/70 backdrop-blur px-4 py-3 border shadow-sm min-w-[84px]">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Rank
          </span>
          <span className="text-3xl font-extrabold leading-none">
            #{myStats.rank}
          </span>
        </div>

        {/* Identity + metric */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">You</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background/70 border px-2 py-0.5 text-xs font-medium">
              <meta.Icon className="h-3.5 w-3.5" />
              {meta.emoji} {meta.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            {league === "active" ? (
              <Flame className="h-4 w-4 text-orange-500" />
            ) : (
              <Clock className="h-4 w-4 text-emerald-500" />
            )}
            <span>
              <span className="font-semibold text-foreground">{m.value}</span>{" "}
              {m.unit} {m.caption}
            </span>
          </p>
          {nudge && (
            <p className="text-sm mt-2 flex items-start gap-1.5 text-foreground/90">
              <ChevronUp className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>{nudge}</span>
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Podium (top 3) ----------

function Podium({
  top3,
  league,
  meId,
}: {
  top3: LeaderboardEntry[];
  league: League;
  meId?: string;
}) {
  // Display order: 2nd, 1st, 3rd
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6 pt-4">
      {order.map((entry) => {
        const s = podiumStyle(entry.rank);
        const m = metricOf(entry, league);
        const isMe = entry.userId === meId;
        const isFirst = entry.rank === 1;
        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: isFirst ? 0 : 0.1 }}
            className="flex flex-col items-center w-24 sm:w-28"
          >
            {/* Medal icon */}
            <div className={cn("mb-1 text-amber-500", isFirst && "scale-110")}>
              {s.icon}
            </div>
            {/* Avatar */}
            <Avatar
              className={cn(
                "ring-2 ring-offset-2 ring-offset-background",
                s.ring,
                s.glow,
                isFirst ? "h-16 w-16" : "h-12 w-12"
              )}
            >
              <AvatarFallback className={cn("font-semibold", s.avatar)}>
                {getInitials(entry.userName)}
              </AvatarFallback>
            </Avatar>
            {/* Name */}
            <p
              className={cn(
                "mt-2 text-center font-semibold truncate max-w-full px-1",
                isFirst ? "text-sm" : "text-xs"
              )}
              title={entry.userName}
            >
              {firstName(entry.userName)}
              {isMe && <span className="text-primary"> (You)</span>}
            </p>
            {/* Metric */}
            <p className="text-[11px] text-muted-foreground">
              {m.value} {m.unit}
            </p>
            {/* Pedestal */}
            <div
              className={cn(
                "mt-2 w-full rounded-t-lg bg-gradient-to-b flex items-start justify-center pt-1.5",
                s.ped,
                s.h,
                isMe && "ring-2 ring-primary"
              )}
            >
              <span className="text-lg font-extrabold text-white/90 drop-shadow">
                {entry.rank}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------- Standard ranked row (4th and below) ----------

function LeaderRow({
  entry,
  league,
  isMe,
  index,
}: {
  entry: LeaderboardEntry;
  league: League;
  isMe: boolean;
  index: number;
}) {
  const m = metricOf(entry, league);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className={cn(
        "flex items-center gap-4 rounded-xl border px-4 py-3 transition-all",
        "bg-card hover:shadow-md hover:-translate-y-0.5",
        isMe && "ring-2 ring-primary bg-primary/[0.04] border-primary/30"
      )}
    >
      {/* Rank */}
      <div className="w-8 text-center shrink-0">
        <span className="text-base font-bold text-muted-foreground tabular-nums">
          {entry.rank}
        </span>
      </div>

      {/* Avatar */}
      <Avatar className="h-11 w-11 shrink-0">
        <AvatarFallback className="bg-muted font-medium">
          {getInitials(entry.userName)}
        </AvatarFallback>
      </Avatar>

      {/* Name + sub */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">
          {entry.userName}
          {isMe && (
            <span className="ml-2 text-xs text-primary font-medium">(You)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {league === "finishers" ? (
            <>
              <span className="text-emerald-600 font-medium">✓ Completed</span>
              {entry.daysToComplete != null && (
                <span>· in {formatCompletionTime(entry.daysToComplete)}</span>
              )}
            </>
          ) : (
            <>
              <Zap className="h-3 w-3 text-orange-500" />
              In progress · {Math.floor(entry.completionPercentage)}%
            </>
          )}
        </p>
      </div>

      {/* Metric badge */}
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg px-3 py-1.5 shrink-0 min-w-[64px]",
          TONE[m.tone]
        )}
      >
        <span className="text-lg font-extrabold leading-none tabular-nums">
          {m.value}
        </span>
        <span className="text-[10px] uppercase tracking-wide">{m.caption}</span>
      </div>
    </motion.div>
  );
}

// ---------- motivational nudge ----------

function getNudge(
  myStats: LeaderboardEntry | null,
  finishers: LeaderboardEntry[],
  active: LeaderboardEntry[]
): string | null {
  if (!myStats) return null;

  if (myStats.league === "finishers") {
    if (myStats.rank === 1)
      return "🏆 Fastest finisher in the cohort — phenomenal pace!";
    return `You finished in ${myStats.daysToComplete} days — #${myStats.rank} of ${finishers.length} finishers. 🎉`;
  }

  const idx = active.findIndex((e) => e.userId === myStats.userId);
  if (idx === 0)
    return "🔥 You're leading this week — keep the streak alive to hold #1!";
  if (idx < 0)
    return `You're #${myStats.rank} this week — complete a few items to climb the board! 🔥`;

  const above = active[idx - 1];
  const need = Math.max(
    1,
    (above.weeklyItems ?? 0) - (myStats.weeklyItems ?? 0) + 1
  );
  return `Complete ${need} more item${need === 1 ? "" : "s"} this week to pass ${firstName(
    above.userName
  )} and climb to #${myStats.rank - 1}.`;
}
