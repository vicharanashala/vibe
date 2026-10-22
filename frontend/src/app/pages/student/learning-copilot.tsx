import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  Clock3,
  Flame,
  LineChart,
  Medal,
  Play,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

type Topic = {
  name: string;
  score: number;
  questions: string;
  note: string;
  tone: "violet" | "blue" | "amber" | "rose";
};

type QuizAttempt = {
  name: string;
  date: string;
  score: number;
  correct: number;
  total: number;
  time: string;
};

type Recommendation = {
  title: string;
  description: string;
  meta: string;
  icon: LucideIcon;
  tone: "violet" | "amber" | "blue" | "rose";
};

const topics: Topic[] = [
  {
    name: "Functions",
    score: 92,
    questions: "11 / 12 correct",
    note: "Strong conceptual grasp",
    tone: "violet",
  },
  {
    name: "Matrices",
    score: 84,
    questions: "10 / 12 correct",
    note: "Improving steadily",
    tone: "blue",
  },
  {
    name: "Sequences",
    score: 68,
    questions: "8 / 12 correct",
    note: "A little more practice will help",
    tone: "amber",
  },
  {
    name: "Graphs",
    score: 42,
    questions: "5 / 12 correct",
    note: "Your next focus area",
    tone: "rose",
  },
];

const quizHistory: QuizAttempt[] = [
  { name: "Algebra fundamentals", date: "Jun 18", score: 88, correct: 11, total: 12, time: "12 min" },
  { name: "Functions & relations", date: "Jun 11", score: 81, correct: 9, total: 11, time: "14 min" },
  { name: "Matrix operations", date: "Jun 04", score: 70, correct: 7, total: 10, time: "17 min" },
  { name: "Number sequences", date: "May 28", score: 62, correct: 8, total: 13, time: "19 min" },
  { name: "Diagnostic quiz", date: "May 21", score: 56, correct: 7, total: 12, time: "21 min" },
];

const recommendations: Recommendation[] = [
  {
    title: "Review Graph Basics",
    description: "Revisit coordinate planes, slope, and reading transformations.",
    meta: "15 min · Foundation",
    icon: BookOpen,
    tone: "rose",
  },
  {
    title: "Practice Matrix Inverse",
    description: "Build confidence with inverse matrices through 8 targeted questions.",
    meta: "10 min · Practice set",
    icon: Target,
    tone: "amber",
  },
  {
    title: "Try an Intermediate Functions Quiz",
    description: "You are ready to stretch your understanding of functions.",
    meta: "12 questions · Challenge",
    icon: Play,
    tone: "blue",
  },
];

const toneStyles = {
  violet: {
    icon: "bg-violet-100 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300",
    bar: "bg-violet-500",
    soft: "bg-violet-50/70 dark:bg-violet-400/[0.06]",
  },
  blue: {
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300",
    bar: "bg-blue-500",
    soft: "bg-blue-50/70 dark:bg-blue-400/[0.06]",
  },
  amber: {
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
    bar: "bg-amber-500",
    soft: "bg-amber-50/70 dark:bg-amber-400/[0.06]",
  },
  rose: {
    icon: "bg-rose-100 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300",
    bar: "bg-rose-500",
    soft: "bg-rose-50/70 dark:bg-rose-400/[0.06]",
  },
} as const;

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function TrendChart() {
  const points = "12,146 86,128 160,111 234,87 308,73 382,50 456,29";

  return (
    <div className="relative mt-6 h-48 w-full overflow-hidden rounded-2xl bg-neutral-50/80 px-2 pt-4 dark:bg-white/[0.03]">
      <div className="pointer-events-none absolute inset-x-4 top-8 space-y-8">
        {[0, 1, 2].map((line) => (
          <div key={line} className="border-t border-dashed border-neutral-200 dark:border-white/[0.08]" />
        ))}
      </div>
      <svg className="relative z-10 h-full w-full" viewBox="0 0 468 174" preserveAspectRatio="none" aria-label="Quiz accuracy trend">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 12 146 L 86 128 L 160 111 L 234 87 L 308 73 L 382 50 L 456 29 L 456 174 L 12 174 Z" fill="url(#trend-fill)" />
        <polyline points={points} fill="none" stroke="#8b5cf6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {points.split(" ").map((point) => {
          const [cx, cy] = point.split(",");
          return <circle key={point} cx={cx} cy={cy} r="4" fill="white" stroke="#8b5cf6" strokeWidth="2.5" />;
        })}
      </svg>
      <div className="absolute inset-x-4 bottom-2 flex justify-between text-[10px] font-medium text-muted-foreground">
        {quizHistory.slice().reverse().map((attempt) => <span key={attempt.date}>{attempt.date}</span>)}
      </div>
    </div>
  );
}

export default function LearningCopilot() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [range, setRange] = useState("Last 30 days");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);

  const displayName = user?.name?.split(" ")[0] || "there";
  const visibleHistory = useMemo(
    () => (showAllHistory ? quizHistory : quizHistory.slice(0, 3)),
    [showAllHistory],
  );

  const markRecommendationDone = (title: string) => {
    setCompleted((current) => (current.includes(title) ? current : [...current, title]));
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-7 pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-amber-50/60 p-6 shadow-sm dark:border-violet-300/10 dark:from-violet-400/[0.12] dark:via-white/[0.03] dark:to-amber-400/[0.06] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-400/10" />
        <div className="pointer-events-none absolute -bottom-28 right-28 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-400/10" />
        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm dark:border-violet-300/15 dark:bg-white/[0.06] dark:text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              Learning Copilot
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Keep your learning momentum, {displayName}.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              A clear view of what you know, where to focus next, and how far you have come.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-200">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Current level</p>
              <p className="text-lg font-bold text-foreground">Algebra Explorer</p>
              <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">On track · 74% mastery</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="performance-summary">
        <SectionHeading eyebrow="Latest assessment" title="Performance summary" description="Your most recent quiz at a glance." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Quiz score", value: "8 / 10", detail: "Algebra fundamentals", icon: Trophy, tone: "violet" as const },
            { label: "Accuracy", value: "80%", detail: "+18% from first quiz", icon: Target, tone: "blue" as const },
            { label: "Time taken", value: "12 min", detail: "2 min faster than average", icon: Clock3, tone: "amber" as const },
            { label: "Questions", value: "10", detail: "8 correct · 2 to revisit", icon: Check, tone: "rose" as const },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.07] dark:bg-white/[0.03] dark:ring-white/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                  </div>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneStyles[stat.tone].icon}`}><Icon className="h-4 w-4" /></span>
                </div>
                <p className="mt-4 truncate text-xs text-muted-foreground">{stat.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.07] dark:bg-white/[0.03] dark:ring-white/[0.03] sm:p-7">
          <SectionHeading eyebrow="Concept check-in" title="Topic mastery" description="See the concepts behind your score." />
          <div className="mt-6 space-y-5">
            {topics.map((topic) => (
              <div key={topic.name}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{topic.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{topic.questions} · {topic.note}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-foreground">{topic.score}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.08]">
                  <div className={`h-full rounded-full ${toneStyles[topic.tone].bar}`} style={{ width: `${topic.score}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-neutral-100 pt-5 text-xs text-muted-foreground dark:border-white/[0.07]">
            <BarChart3 className="h-4 w-4 text-primary" />
            Mastery is based on your last 3 attempts per topic.
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.07] dark:bg-white/[0.03] dark:ring-white/[0.03] sm:p-7">
          <SectionHeading eyebrow="What we noticed" title="Learning insights" description="Small signals that make your next step clearer." />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              { label: "Strongest topic", value: "Functions", detail: "92% mastery", icon: Medal, tone: "violet" as const },
              { label: "Needs attention", value: "Graphs", detail: "Let's build the basics", icon: Target, tone: "rose" as const },
              { label: "Most improved", value: "Matrices", detail: "+24% in 3 quizzes", icon: ArrowUpRight, tone: "blue" as const },
              { label: "Learning consistency", value: "High", detail: "4 quizzes this month", icon: Flame, tone: "amber" as const },
            ].map((insight) => {
              const Icon = insight.icon;
              return (
                <div key={insight.label} className={`flex items-center gap-3 rounded-2xl border border-neutral-100 p-3.5 dark:border-white/[0.07] ${toneStyles[insight.tone].soft}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneStyles[insight.tone].icon}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">{insight.label}</p>
                    <p className="truncate text-sm font-bold text-foreground">{insight.value}</p>
                  </div>
                  <span className="ml-auto shrink-0 text-right text-[11px] font-medium text-muted-foreground">{insight.detail}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-3.5 dark:bg-white/[0.04]">
            <p className="text-sm font-semibold text-foreground">You are building a strong foundation.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Your accuracy has gone up in every quiz this month. Keep the rhythm going.</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.07] dark:bg-white/[0.03] dark:ring-white/[0.03] sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading eyebrow="Your next best steps" title="Recommendations" description="Short, focused actions based on your recent attempts." />
          <span className="hidden items-center gap-1.5 pb-1 text-xs font-medium text-muted-foreground sm:flex"><Sparkles className="h-3.5 w-3.5 text-primary" /> Rule-based guidance</span>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {recommendations.map((recommendation) => {
            const Icon = recommendation.icon;
            const isDone = completed.includes(recommendation.title);
            return (
              <div key={recommendation.title} className="flex flex-col rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-4 dark:border-white/[0.07] dark:bg-white/[0.025]">
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneStyles[recommendation.tone].icon}`}><Icon className="h-5 w-5" /></span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-muted-foreground shadow-sm dark:bg-white/[0.06]">{recommendation.meta}</span>
                </div>
                <h3 className="mt-4 text-sm font-bold text-foreground">{recommendation.title}</h3>
                <p className="mt-1.5 min-h-10 text-xs leading-5 text-muted-foreground">{recommendation.description}</p>
                <Button
                  variant={isDone ? "secondary" : "outline"}
                  size="sm"
                  className="mt-4 w-full justify-between rounded-xl bg-white text-xs dark:bg-white/[0.04]"
                  onClick={() => {
                    markRecommendationDone(recommendation.title);
                    if (recommendation.title.includes("Quiz")) navigate({ to: "/student/courses" });
                  }}
                >
                  {isDone ? "Added to your plan" : "Start learning"}
                  {isDone ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.07] dark:bg-white/[0.03] dark:ring-white/[0.03] sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading eyebrow="Keep going" title="Progress over time" description="Your quiz accuracy is trending upward." />
            <label className="relative flex shrink-0 items-center">
              <select aria-label="Progress time range" value={range} onChange={(event) => setRange(event.target.value)} className="appearance-none rounded-xl border border-neutral-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <option>Last 30 days</option>
                <option>All time</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground" />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400"><ArrowUpRight className="h-4 w-4" /> 32% improvement <span className="font-normal text-muted-foreground">in {range.toLowerCase()}</span></div>
          <TrendChart />
        </div>

        <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.07] dark:bg-white/[0.03] dark:ring-white/[0.03] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <SectionHeading eyebrow="Your journey" title="Quiz history" description="A little progress, every time." />
            <LineChart className="mt-1 h-5 w-5 shrink-0 text-primary" />
          </div>
          <div className="mt-5 divide-y divide-neutral-100 dark:divide-white/[0.07]">
            {visibleHistory.map((attempt, index) => (
              <div key={attempt.date} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
                  {attempt.score}%
                  {index < visibleHistory.length - 1 && <span className="absolute -bottom-6 left-1/2 h-5 w-px bg-neutral-200 dark:bg-white/[0.1]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{attempt.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{attempt.date} · {attempt.correct}/{attempt.total} correct · {attempt.time}</p>
                </div>
                {index === 0 ? <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Latest</span> : index === visibleHistory.length - 1 ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> : <ArrowDownRight className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-600" />}
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-5 h-8 w-full rounded-xl text-xs font-semibold text-primary hover:text-primary" onClick={() => setShowAllHistory((current) => !current)}>
            {showAllHistory ? "Show recent quizzes" : "View full history"}
            <ArrowRight className={`ml-1 h-3.5 w-3.5 transition-transform ${showAllHistory ? "rotate-90" : ""}`} />
          </Button>
        </div>
      </section>

      <div className="flex items-center justify-center gap-2 pb-2 text-center text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Learning Copilot turns your quiz results into your next best step.
      </div>
    </div>
  );
}
