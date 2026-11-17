/**
 * Course analytics read models (collections prefixed `ca_`), one set per
 * course version. They are derived only from the existing learning records
 * by AnalyticsProjector (on events and in gradual builds) and never written
 * anywhere else. See
 * openspec/changes/studio-course-insights/design.md for the model.
 */

export type Range = 7 | 30 | 90;
export const RANGES: Range[] = [7, 30, 90];

/**
 * Per course version: build status and the single-builder lease. A version
 * with no row has no analytics yet; its first overview request starts a
 * gradual build (design §3).
 */
export interface CaState {
  versionId: string;
  courseId: string;
  status: 'building' | 'ready';
  /** Learners up to and including this user id (string order) are built. */
  cursorUserId: string;
  done: number;
  total: number;
  startedAt: Date;
  readyAt?: Date | null;
  /** Last time the stored learners were compared with the enrolment roster. */
  rosterCheckedAt?: Date | null;
  /** Bumped by every learner recompute; readers cache until it changes. */
  changeSeq?: number;
  leaseOwner?: string | null;
  leaseUntil?: Date | null;
}

/**
 * Per learner: serialises recomputes of one learner across events, build
 * steps and instances. `dirty` means "recompute again": set by every event,
 * cleared by whoever recomputes.
 */
export interface CaLearnerLock {
  versionId: string;
  userId: string;
  dirty: boolean;
  owner?: string | null;
  until?: Date | null;
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
  lastIncidentAt: Date | null;
  /** When these rows were computed; a recompute never replaces newer rows. */
  computedAt: Date;
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

/**
 * Tier 3 counters. Each is the sum of the per-learner rows; events keep them
 * up to date by applying the difference between a learner's old and new rows.
 */
export interface CaCourseDaily {
  versionId: string;
  day: string;
  activeLearners: number;
  learningSeconds: number;
  newEnrolments: number;
  incidentsByType: Record<string, number>;
}

/** Learning seconds per IST hour ("0".."23") for one day. */
export interface CaCourseHeatmapDay {
  versionId: string;
  day: string;
  secondsByHour: Record<string, number>;
}

/** Additive per-item counters; rates and top lists are derived when read. */
export interface CaItemCounters {
  versionId: string;
  itemId: string;
  // QUIZ
  attempted?: number;
  firstPassed?: number;
  passed?: number;
  attemptsToPassSum?: number;
  /** First-attempt score bands "0".."9". */
  scoreBands?: Record<string, number>;
  /** Per question: first attempts answered and answered correctly. */
  questions?: Record<string, {answered: number; correct: number}>;
  // VIDEO
  started?: number;
  completed?: number;
  /** Rewinds keyed by segment start second. */
  segments?: Record<string, number>;
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

export type ProgressBand =
  | '0'
  | '1-24'
  | '25-49'
  | '50-74'
  | '75-99'
  | 'finished';

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

/** The overview response (design.md §6). */
export interface CourseInsights {
  status: 'ready' | 'building';
  /** 0–100, only while building. */
  buildProgress?: number;
  /** When the figures were read (the response time). */
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
  funnel?: {
    moduleId: string;
    name: string;
    reached: number;
    completed: number;
  }[];
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
  /** Totals per reason; `checkOn` itself is capped at 50 rows. */
  checkOnTotals?: {inactive: number; stuck: number};
  proctoring?: {
    checksOn: boolean;
    daily: {day: string; per100Hours: Partial<Record<string, number>>}[];
    shareWithIncident: number;
  };
  studyMode?: {strictOnly: number; studyOnly: number; both: number};
}
