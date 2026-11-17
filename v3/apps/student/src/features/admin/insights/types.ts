/**
 * The course Overview's analytics, as served by
 * `GET /api/analytics/courses/{courseId}/versions/{versionId}/overview?range=…`.
 *
 * Mirrors the response shape pinned in the `studio-course-insights` design
 * (§6). Once the backend is merged and `@vibe/api` is regenerated, these can be
 * replaced by the generated schema types.
 */
export type InsightsRange = 7 | 30 | 90;
export const INSIGHTS_RANGES: InsightsRange[] = [7, 30, 90];
export const DEFAULT_INSIGHTS_RANGE: InsightsRange = 30;

export function parseInsightsRange(raw: unknown): InsightsRange | undefined {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return INSIGHTS_RANGES.includes(n as InsightsRange)
    ? (n as InsightsRange)
    : undefined;
}

/** `null` means there's no data for that period. */
export interface Metric {
  current: number | null;
  previous: number | null;
}

export type ProgressBand =
  '0' | '1-24' | '25-49' | '50-74' | '75-99' | 'finished';

export interface CourseInsights {
  status: 'ready' | 'building';
  /** ISO time of the last successful refresh. */
  updatedAt: string | null;
  range: InsightsRange;
  headline?: {
    students: Metric;
    activeThisWeek: Metric;
    /** Percent, 0–100. */
    averageProgress: Metric;
    finished: Metric;
    medianDaysToFinish: Metric;
    learningHours: Metric;
  };
  daily?: {
    day: string;
    activeLearners: number;
    learningHours: number;
    newEnrolments: number;
  }[];
  /** [weekday 0=Mon..6=Sun][hour 0..23], learning hours in IST. */
  heatmap?: number[][];
  progressBands?: { band: ProgressBand; students: number }[];
  funnel?: {
    moduleId: string;
    name: string;
    reached: number;
    completed: number;
  }[];
  whereNow?: {
    itemId: string;
    moduleId: string;
    sectionId: string;
    name: string;
    type: string;
    students: number;
    medianDaysThere: number;
  }[];
  quizzes?: QuizInsight[];
  videos?: VideoInsight[];
  checkOn?: CheckOnStudent[];
  proctoring?: {
    checksOn: boolean;
    daily: { day: string; per100Hours: Partial<Record<string, number>> }[];
    /** 0–1. */
    shareWithIncident: number;
  };
  studyMode?: { strictOnly: number; studyOnly: number; both: number };
}

export interface QuizInsight {
  itemId: string;
  moduleId: string;
  sectionId: string;
  name: string;
  attempted: number;
  /** 0–1. */
  firstAttemptPassRate: number | null;
  avgAttemptsToPass: number | null;
  /** 10 bands of first-attempt score: 0–9, 10–19, … 90–100. */
  scoreBands: number[];
  hardestQuestions: {
    questionId: string;
    text: string;
    correctRate: number;
    answered: number;
  }[];
}

export interface VideoInsight {
  itemId: string;
  moduleId: string;
  sectionId: string;
  name: string;
  started: number;
  completed: number;
  /** Top 10-second segments students rewind to. */
  rewindHotspots: { startSecond: number; rewinds: number }[];
}

export interface CheckOnStudent {
  userId: string;
  name: string;
  email: string;
  reason: 'inactive' | 'stuck';
  daysSinceActive: number;
  item: { itemId: string; name: string } | null;
  daysOnItem: number | null;
}
