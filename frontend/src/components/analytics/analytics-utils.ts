/**
 * Pure, read-only analytics derivations for the Learning Analytics view.
 *
 * Everything here is computed from data the app already fetches (enrollment
 * details + stats + watch time). No tracking/event systems are touched — this
 * is presentation-layer math only.
 */

export type CourseStatus = "completed" | "almost" | "in-progress" | "not-started";

export interface CourseAnalytics {
  id: string;
  name: string;
  cohortName?: string;
  progress: number;            // 0–100
  completedItems: number;
  totalItems: number;
  remaining: number;           // lessons left
  videos: { done: number; total: number };
  quizzes: { done: number; total: number };
  articles: { done: number; total: number };
  projects: { done: number; total: number };
  quizScore: number;
  quizMaxScore: number;
  quizPercent: number | null;  // null when there are no graded quizzes
  status: CourseStatus;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Resolve a per-type count from the several shapes the API returns. */
const pick = (cc: any, ic: any, ...keys: string[]): number => {
  for (const k of keys) {
    if (cc?.[k] != null) return num(cc[k]);
    if (ic?.[k] != null) return num(ic[k]);
  }
  return 0;
};

function statusOf(progress: number): CourseStatus {
  if (progress >= 100) return "completed";
  if (progress <= 0) return "not-started";
  if (progress >= 75) return "almost";
  return "in-progress";
}

/** Map one raw enrollment-details entry to a typed analytics row. */
export function toCourseAnalytics(entry: any, index: number): CourseAnalytics {
  const cc = entry?.contentCounts || {};
  const ic = cc.itemCounts || {};

  const totalItems = num(cc.totalItems ?? cc.total);
  const completedItems = num(entry?.completedItemsCount ?? entry?.completedItems ?? cc.completedItems);
  const progress = Math.max(0, Math.min(100, Math.round(num(entry?.percentCompleted))));

  const videos = { total: pick(cc, ic, "videos", "VIDEO", "video"), done: num(cc.completedVideos) };
  const quizzes = { total: pick(cc, ic, "quizzes", "QUIZ", "quiz"), done: num(cc.completedQuizzes) };
  const articles = { total: pick(cc, ic, "articles", "BLOG", "blog"), done: num(cc.completedArticles) };
  const projects = { total: pick(cc, ic, "projects", "project", "PROJECT"), done: num(cc.completedProjects) };

  const quizScore = num(cc.totalQuizScore ?? entry?.totalQuizScore);
  const quizMaxScore = num(cc.totalQuizMaxScore ?? entry?.totalQuizMaxScore);
  const quizPercent = quizMaxScore > 0 ? Math.round((quizScore / quizMaxScore) * 100) : null;

  return {
    id: String(entry?._id ?? entry?.courseId ?? index),
    name: entry?.course?.name || `Course ${index + 1}`,
    cohortName: entry?.cohortName,
    progress,
    completedItems,
    totalItems,
    remaining: Math.max(totalItems - completedItems, 0),
    videos,
    quizzes,
    articles,
    projects,
    quizScore,
    quizMaxScore,
    quizPercent,
    status: statusOf(progress),
  };
}

export type ContentMix = {
  key: "videos" | "quizzes" | "articles" | "projects";
  label: string;
  done: number;
  total: number;
};

/** Aggregate per-type completion across all courses. */
export function aggregateContentMix(courses: CourseAnalytics[]): ContentMix[] {
  const sum = (sel: (c: CourseAnalytics) => { done: number; total: number }) =>
    courses.reduce(
      (acc, c) => ({ done: acc.done + sel(c).done, total: acc.total + sel(c).total }),
      { done: 0, total: 0 },
    );
  return [
    { key: "videos", label: "Videos", ...sum((c) => c.videos) },
    { key: "quizzes", label: "Quizzes", ...sum((c) => c.quizzes) },
    { key: "articles", label: "Reading", ...sum((c) => c.articles) },
    { key: "projects", label: "Projects", ...sum((c) => c.projects) },
  ].filter((m) => m.total > 0);
}

/** Mean quiz percentage across courses that have graded quizzes. */
export function averageQuizPercent(courses: CourseAnalytics[]): number | null {
  const scored = courses.filter((c) => c.quizPercent != null);
  if (!scored.length) return null;
  return Math.round(scored.reduce((s, c) => s + (c.quizPercent || 0), 0) / scored.length);
}

/** Progress-bar fill color that shifts red → amber → green as % rises. */
export function progressTone(pct: number): string {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

/** In-progress courses sorted by closeness to completion — the quickest wins. */
export function closestToFinishing(courses: CourseAnalytics[], limit = 3): CourseAnalytics[] {
  return courses
    .filter((c) => c.progress > 0 && c.progress < 100)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, limit);
}

export const STATUS_META: Record<CourseStatus, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
  almost: { label: "Almost done", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  "in-progress": { label: "In progress", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  "not-started": { label: "Not started", className: "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300" },
};
