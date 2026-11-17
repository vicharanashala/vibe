/**
 * Course analytics read models (collections prefixed `ca_`), one set per
 * course version. They are derived only from the existing learning records
 * by AnalyticsProjector and never written anywhere else. See
 * openspec/changes/studio-course-insights/design.md for the model.
 */

export type Range = 7 | 30 | 90;
export const RANGES: Range[] = [7, 30, 90];

/** Per course version: refresh bookkeeping and the single-refresher lease. */
export interface CaState {
  versionId: string;
  courseId: string;
  /** Source records were read up to this time. */
  watermark: Date | null;
  lastRefreshedAt: Date | null;
  firstBuildCompletedAt: Date | null;
  status: 'idle' | 'refreshing' | 'rebuilding' | 'failed';
  lastError?: string | null;
  leaseOwner?: string | null;
  leaseUntil?: Date | null;
}

/** Tier 1: one row per enrolled student. */
export interface CaLearner {
  versionId: string;
  userId: string;
  name: string;
  email: string;
  cohort: string | null;
  enrolledAt: Date | null;
  percent: number;
  finished: boolean;
  completedAt: Date | null;
  lastActiveAt: Date | null;
  currentItemId: string | null;
  currentItemSince: Date | null;
  /** Index (in visible course order) of the furthest module reached; -1 = none. */
  furthestModuleIndex: number;
  completedModuleIds: string[];
  usedStrict: boolean;
  usedStudy: boolean;
  incidentCount: number;
}

export interface CaLearnerQuiz {
  versionId: string;
  userId: string;
  quizId: string;
  attempts: number;
  firstAttemptPassed: boolean;
  /** Position of the first passing attempt; null if never passed. */
  attemptsToPass: number | null;
  firstAttemptScorePct: number | null;
  bestScorePct: number | null;
  firstAttemptQuestions: {questionId: string; correct: boolean}[];
}

export interface CaLearnerVideo {
  versionId: string;
  userId: string;
  itemId: string;
  started: boolean;
  completed: boolean;
  /** Rewinds keyed by the start second of each 10-second segment. */
  rewindSegments: Record<string, number>;
}

/** Tier 2: one row per student per IST day with any activity or enrolment. */
export interface CaLearnerDay {
  versionId: string;
  userId: string;
  day: string; // YYYY-MM-DD, IST
  active: boolean;
  enrolled: boolean;
  learningSeconds: number;
  secondsByHour: number[]; // 24, IST
  incidentsByType: Record<string, number>;
}

/** Tier 3: course totals per IST day. */
export interface CaCourseDaily {
  versionId: string;
  day: string;
  activeLearners: number;
  learningSeconds: number;
  newEnrolments: number;
  incidentsByType: Record<string, number>;
}

/** Tier 3: learning seconds per IST hour for one day (weekday is derived from the day). */
export interface CaCourseHeatmapDay {
  versionId: string;
  day: string;
  secondsByHour: number[];
}

export interface CaItemStats {
  versionId: string;
  itemId: string;
  type: 'QUIZ' | 'VIDEO';
  moduleId: string;
  sectionId: string;
  name: string;
  order: number;
  // QUIZ
  attempted?: number;
  firstAttemptPassRate?: number | null;
  avgAttemptsToPass?: number | null;
  scoreBands?: number[];
  hardestQuestions?: {
    questionId: string;
    text: string;
    correctRate: number;
    answered: number;
  }[];
  // VIDEO
  started?: number;
  completed?: number;
  rewindHotspots?: {startSecond: number; rewinds: number}[];
}

export interface Metric {
  current: number | null;
  previous: number | null;
}

export interface Headline {
  students: Metric;
  activeThisWeek: Metric;
  averageProgress: Metric;
  finished: Metric;
  medianDaysToFinish: Metric;
  learningHours: Metric;
}

export type ProgressBand = '0' | '1-24' | '25-49' | '50-74' | '75-99' | 'finished';

export interface WhereNowRow {
  itemId: string;
  moduleId: string;
  sectionId: string;
  name: string;
  type: string;
  students: number;
  medianDaysThere: number;
}

export interface CheckOnRow {
  userId: string;
  name: string;
  email: string;
  reason: 'inactive' | 'stuck';
  daysSinceActive: number;
  item: {itemId: string; name: string} | null;
  daysOnItem: number | null;
}

export interface CaCourseSnapshot {
  versionId: string;
  courseId: string;
  computedAt: Date;
  headline: Record<string, Headline>; // keyed by range ("7" | "30" | "90")
  shareWithIncident: Record<string, number>; // keyed by range
  progressBands: {band: ProgressBand; students: number}[];
  funnel: {moduleId: string; name: string; reached: number; completed: number}[];
  whereNow: WhereNowRow[];
  checkOn: CheckOnRow[];
  studyMode: {strictOnly: number; studyOnly: number; both: number};
  checksOn: boolean;
}

/** The overview response (design.md §6). */
export interface CourseInsights {
  status: 'ready' | 'building';
  updatedAt: string | null;
  range: Range;
  headline?: Headline;
  daily?: {
    day: string;
    activeLearners: number;
    learningHours: number;
    newEnrolments: number;
  }[];
  heatmap?: number[][];
  progressBands?: {band: ProgressBand; students: number}[];
  funnel?: {moduleId: string; name: string; reached: number; completed: number}[];
  whereNow?: WhereNowRow[];
  quizzes?: {
    itemId: string;
    moduleId: string;
    sectionId: string;
    name: string;
    attempted: number;
    firstAttemptPassRate: number | null;
    avgAttemptsToPass: number | null;
    scoreBands: number[];
    hardestQuestions: {
      questionId: string;
      text: string;
      correctRate: number;
      answered: number;
    }[];
  }[];
  videos?: {
    itemId: string;
    moduleId: string;
    sectionId: string;
    name: string;
    started: number;
    completed: number;
    rewindHotspots: {startSecond: number; rewinds: number}[];
  }[];
  checkOn?: CheckOnRow[];
  proctoring?: {
    checksOn: boolean;
    daily: {day: string; per100Hours: Partial<Record<string, number>>}[];
    shareWithIncident: number;
  };
  studyMode?: {strictOnly: number; studyOnly: number; both: number};
}
