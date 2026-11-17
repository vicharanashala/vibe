import type {
  CaLearner,
  CaLearnerDay,
  CaLearnerQuiz,
  CaLearnerVideo,
  CheckOnRow,
  Headline,
  Metric,
  ProgressBand,
  Range,
  WhereNowRow,
} from '../interfaces.js';
import {
  DAY_MS,
  istDay,
  median,
  splitByIstHour,
  windowDays,
  addDays,
} from './time.js';

/** Viewing sessions are capped so an abandoned tab can't add hours. */
export const NON_VIDEO_CAP_SECONDS = 3 * 60 * 60;
export const VIDEO_CAP_MULTIPLIER = 3;
export const REWIND_SEGMENT_SECONDS = 10;
export const INACTIVE_DAYS = 7;
export const STUCK_DAYS = 3;
export const CHECK_ON_LIMIT = 50;
export const WHERE_NOW_LIMIT = 20;

/** Visible course structure in course order (hidden/deleted entries removed). */
export interface CourseItem {
  itemId: string;
  type: string;
  name: string;
  moduleId: string;
  sectionId: string;
  moduleIndex: number;
  /** Position of the item in the whole course, 0-based. */
  order: number;
  durationSeconds: number | null;
}

export interface CourseStructure {
  courseId: string;
  versionId: string;
  modules: {moduleId: string; name: string; itemIds: string[]}[];
  items: Map<string, CourseItem>;
  quizIds: string[];
  videoIds: string[];
  /** Question text by question id, for quizzes in this version. */
  questionText: Map<string, string>;
}

export interface LearnerSources {
  userId: string;
  enrollment: {
    enrollmentDate?: Date | null;
    percentCompleted?: number | null;
    cohortId?: unknown;
    cohort?: unknown;
  };
  progress: {
    currentItem?: unknown;
    completed?: boolean;
    completedAt?: Date | null;
  } | null;
  user: {firstName?: string; lastName?: string; email?: string} | null;
  watchTimes: {
    itemId: unknown;
    startTime?: Date | null;
    endTime?: Date | null;
    isDeleted?: boolean;
  }[];
  submissions: {
    quizId: unknown;
    submittedAt?: Date | null;
    gradingResult?: {
      totalScore?: number;
      totalMaxScore?: number;
      gradingStatus?: string;
      overallFeedback?: {questionId: unknown; status?: string}[];
    } | null;
  }[];
  anomalies: {type?: string; createdAt?: Date | null}[];
  studyViews: {itemId: unknown; firstStudiedAt?: Date | null}[];
  activityEvents: {
    videoId: unknown;
    rewindData?: {to?: string; createdAt?: Date}[];
  }[];
}

export interface LearnerProjection {
  learner: CaLearner;
  quizzes: CaLearnerQuiz[];
  videos: CaLearnerVideo[];
  days: CaLearnerDay[];
}

const str = (v: unknown) => (v == null ? null : String(v));
const emptyHours = () => Array.from({length: 24}, () => 0);

function rewindSegment(to: string | undefined): number | null {
  if (!to) return null;
  const parts = to.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  const s = parts.reduce((acc, n) => acc * 60 + n, 0);
  return Math.floor(s / REWIND_SEGMENT_SECONDS) * REWIND_SEGMENT_SECONDS;
}

/**
 * Builds every tier-1 and tier-2 row for one student from their own records,
 * as of `upTo` (normally now). `previous` is their stored row (null the first
 * time); it only supplies `currentItemSince` when the current item hasn't
 * changed.
 */
export function projectLearner(
  structure: CourseStructure,
  src: LearnerSources,
  previous: CaLearner | null,
  upTo: Date,
): LearnerProjection {
  const {versionId} = structure;
  const userId = src.userId;
  const days = new Map<string, CaLearnerDay>();
  const day = (d: string) => {
    let row = days.get(d);
    if (!row) {
      row = {
        versionId,
        userId,
        day: d,
        active: false,
        enrolled: false,
        learningSeconds: 0,
        secondsByHour: emptyHours(),
        incidentsByType: {},
      };
      days.set(d, row);
    }
    return row;
  };

  let lastActive = 0;
  const touch = (t?: Date | null) => {
    if (t && t.getTime() <= upTo.getTime() && t.getTime() > lastActive)
      lastActive = t.getTime();
  };

  // Viewing sessions: completion, learning time, video start/finish.
  const completed = new Set<string>();
  const videoState = new Map<string, {started: boolean; completed: boolean}>();
  // Everything is projected "as of upTo": newer records are picked up by the
  // next refresh, so a rebuild and an incremental refresh at the same moment
  // give the same figures.
  const after = (t?: Date | null) => !!t && t.getTime() > upTo.getTime();
  for (const w0 of src.watchTimes) {
    if (w0.isDeleted || after(w0.startTime)) continue;
    const w = after(w0.endTime) ? {...w0, endTime: null} : w0;
    const itemId = str(w.itemId);
    if (!itemId) continue;
    const item = structure.items.get(itemId);
    touch(w.startTime);
    touch(w.endTime);
    if (item?.type === 'VIDEO') {
      const v = videoState.get(itemId) ?? {started: false, completed: false};
      v.started = true;
      if (w.endTime) v.completed = true;
      videoState.set(itemId, v);
    }
    if (!w.startTime || !w.endTime) continue;
    if (item) completed.add(itemId);
    const cap =
      item?.type === 'VIDEO' && item.durationSeconds
        ? item.durationSeconds * VIDEO_CAP_MULTIPLIER
        : NON_VIDEO_CAP_SECONDS;
    const seconds = Math.min(
      Math.max(0, (w.endTime.getTime() - w.startTime.getTime()) / 1000),
      cap,
    );
    if (seconds <= 0) continue;
    const end = new Date(w.startTime.getTime() + seconds * 1000);
    for (const piece of splitByIstHour(w.startTime, end)) {
      const row = day(piece.day);
      row.active = true;
      row.learningSeconds += piece.seconds;
      row.secondsByHour[piece.hour] += piece.seconds;
    }
  }

  // Quiz attempts, oldest first.
  const byQuiz = new Map<string, LearnerSources['submissions']>();
  for (const s of src.submissions) {
    if (after(s.submittedAt)) continue;
    const quizId = str(s.quizId);
    if (!quizId || !structure.items.has(quizId)) continue;
    touch(s.submittedAt);
    if (s.submittedAt) day(istDay(s.submittedAt)).active = true;
    const list = byQuiz.get(quizId) ?? [];
    list.push(s);
    byQuiz.set(quizId, list);
  }
  const quizzes: CaLearnerQuiz[] = [];
  for (const [quizId, list] of byQuiz) {
    list.sort(
      (a, b) =>
        (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0),
    );
    const pct = (s: (typeof list)[number]) => {
      const max = s.gradingResult?.totalMaxScore ?? 0;
      return max > 0 ? ((s.gradingResult?.totalScore ?? 0) / max) * 100 : null;
    };
    const passIndex = list.findIndex(
      s => s.gradingResult?.gradingStatus === 'PASSED',
    );
    const scores = list.map(pct).filter((n): n is number => n != null);
    const first = list[0];
    quizzes.push({
      versionId,
      userId,
      quizId,
      attempts: list.length,
      firstAttemptPassed: passIndex === 0,
      attemptsToPass: passIndex >= 0 ? passIndex + 1 : null,
      firstAttemptScorePct: pct(first),
      bestScorePct: scores.length ? Math.max(...scores) : null,
      firstAttemptQuestions: (first.gradingResult?.overallFeedback ?? [])
        .filter(f => f.questionId != null)
        .map(f => ({
          questionId: String(f.questionId),
          correct: f.status === 'CORRECT',
        })),
    });
    if (passIndex >= 0) completed.add(quizId);
  }

  // Proctoring incidents.
  let incidentCount = 0;
  let lastIncident = 0;
  for (const a of src.anomalies) {
    if (!a.createdAt || after(a.createdAt)) continue;
    incidentCount += 1;
    lastIncident = Math.max(lastIncident, a.createdAt.getTime());
    touch(a.createdAt);
    const row = day(istDay(a.createdAt));
    const type = a.type ?? 'UNKNOWN';
    row.incidentsByType[type] = (row.incidentsByType[type] ?? 0) + 1;
  }

  // Study mode.
  for (const v of src.studyViews) {
    if (!v.firstStudiedAt || after(v.firstStudiedAt)) continue;
    touch(v.firstStudiedAt);
    day(istDay(v.firstStudiedAt)).active = true;
  }

  // Rewinds.
  const rewinds = new Map<string, Record<string, number>>();
  for (const e of src.activityEvents) {
    const itemId = str(e.videoId);
    if (!itemId || !structure.items.has(itemId)) continue;
    const segs = rewinds.get(itemId) ?? {};
    for (const r of e.rewindData ?? []) {
      const seg = rewindSegment(r.to);
      if (seg == null) continue;
      segs[String(seg)] = (segs[String(seg)] ?? 0) + 1;
    }
    rewinds.set(itemId, segs);
  }
  const videos: CaLearnerVideo[] = [];
  for (const itemId of new Set([...videoState.keys(), ...rewinds.keys()])) {
    if (structure.items.get(itemId)?.type !== 'VIDEO') continue;
    const st = videoState.get(itemId) ?? {started: false, completed: false};
    videos.push({
      versionId,
      userId,
      itemId,
      started: st.started,
      completed: st.completed,
      rewindSegments: rewinds.get(itemId) ?? {},
    });
  }

  const enrolledAt = src.enrollment.enrollmentDate ?? null;
  if (enrolledAt) day(istDay(enrolledAt)).enrolled = true;

  const percent = Number(src.enrollment.percentCompleted ?? 0) || 0;
  const finished = percent >= 100 || src.progress?.completed === true;
  const completedAt = finished
    ? (src.progress?.completedAt ?? (lastActive ? new Date(lastActive) : null))
    : null;

  const currentItemId = str(src.progress?.currentItem);
  const lastActiveAt = lastActive ? new Date(lastActive) : null;
  let currentItemSince: Date | null;
  if (previous && previous.currentItemId === currentItemId) {
    currentItemSince = previous.currentItemSince ?? lastActiveAt ?? enrolledAt;
  } else if (previous) {
    currentItemSince = lastActiveAt ?? upTo;
  } else {
    currentItemSince = lastActiveAt ?? enrolledAt;
  }

  // Furthest module and fully completed modules.
  let furthest = -1;
  const curItem = currentItemId
    ? structure.items.get(currentItemId)
    : undefined;
  if (curItem) furthest = curItem.moduleIndex;
  for (const id of completed) {
    const it = structure.items.get(id);
    if (it && it.moduleIndex > furthest) furthest = it.moduleIndex;
  }
  if (finished) furthest = structure.modules.length - 1;
  const completedModuleIds = structure.modules
    .filter(m => m.itemIds.length && m.itemIds.every(id => completed.has(id)))
    .map(m => m.moduleId);

  const name =
    `${src.user?.firstName ?? ''} ${src.user?.lastName ?? ''}`.trim() ||
    src.user?.email ||
    '';

  const learner: CaLearner = {
    versionId,
    userId,
    name,
    email: src.user?.email ?? '',
    cohort: str(src.enrollment.cohortId ?? src.enrollment.cohort),
    enrolledAt,
    percent,
    finished,
    completedAt,
    lastActiveAt,
    currentItemId,
    currentItemSince,
    furthestModuleIndex: furthest,
    completedModuleIds,
    usedStrict:
      src.watchTimes.some(w => !w.isDeleted && !after(w.startTime)) ||
      src.submissions.some(s => !after(s.submittedAt)),
    usedStudy: src.studyViews.some(v => !after(v.firstStudiedAt)),
    incidentCount,
    lastIncidentAt: lastIncident ? new Date(lastIncident) : null,
    computedAt: upTo,
  };

  return {learner, quizzes, videos, days: [...days.values()]};
}

export function progressBand(
  l: Pick<CaLearner, 'percent' | 'finished'>,
): ProgressBand {
  if (l.finished) return 'finished';
  const p = l.percent;
  if (p <= 0) return '0';
  if (p < 25) return '1-24';
  if (p < 50) return '25-49';
  if (p < 75) return '50-74';
  return '75-99';
}

const BANDS: ProgressBand[] = [
  '0',
  '1-24',
  '25-49',
  '50-74',
  '75-99',
  'finished',
];

/** Range-specific figures that come from the learner-day rows (aggregated in MongoDB). */
export interface WindowFigures {
  activeThisWeek: Metric;
  learningHours: Metric;
  shareWithIncident: number;
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY_MS;

/**
 * Headline metrics computable from learner rows, for one range.
 * `today` is the IST day the window ends on.
 */
export function learnerHeadline(
  learners: CaLearner[],
  range: Range,
  today: string,
  windows: WindowFigures,
): Headline {
  const cur = new Set(windowDays(today, range));
  const prev = new Set(windowDays(addDays(today, -range), range));
  const prevEnd = addDays(today, -range);
  const finishedIn = (days: Set<string>) =>
    learners.filter(l => l.completedAt && days.has(istDay(l.completedAt)));
  const finishedCur = finishedIn(cur);
  const finishedPrev = finishedIn(prev);
  const toFinish = (ls: CaLearner[]) =>
    median(
      ls
        .filter(l => l.enrolledAt && l.completedAt)
        .map(l => daysBetween(l.enrolledAt!, l.completedAt!)),
    );
  const mdCur = toFinish(finishedCur);
  const mdPrev = toFinish(finishedPrev);
  const studentsPrev = learners.filter(
    l => l.enrolledAt && istDay(l.enrolledAt) <= prevEnd,
  ).length;
  return {
    students: {current: learners.length, previous: studentsPrev || null},
    activeThisWeek: windows.activeThisWeek,
    averageProgress: {
      current: learners.length
        ? round(learners.reduce((a, l) => a + l.percent, 0) / learners.length)
        : null,
      previous: null,
    },
    finished: {
      current: finishedCur.length,
      previous: finishedPrev.length || null,
    },
    medianDaysToFinish: {
      current: mdCur == null ? null : round(mdCur),
      previous: mdPrev == null ? null : round(mdPrev),
    },
    learningHours: windows.learningHours,
  };
}

export function progressBands(learners: CaLearner[]) {
  const counts = new Map<ProgressBand, number>(BANDS.map(b => [b, 0]));
  for (const l of learners) {
    const b = progressBand(l);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return BANDS.map(band => ({band, students: counts.get(band) ?? 0}));
}

export function moduleFunnel(
  structure: CourseStructure,
  learners: CaLearner[],
) {
  return structure.modules.map((m, i) => ({
    moduleId: m.moduleId,
    name: m.name,
    reached: learners.filter(l => l.furthestModuleIndex >= i).length,
    completed: learners.filter(l => l.completedModuleIds.includes(m.moduleId))
      .length,
  }));
}

export function whereNow(
  structure: CourseStructure,
  learners: CaLearner[],
  now: Date,
): WhereNowRow[] {
  const groups = new Map<string, number[]>();
  for (const l of learners) {
    if (l.finished || !l.currentItemId) continue;
    if (!structure.items.has(l.currentItemId)) continue;
    const list = groups.get(l.currentItemId) ?? [];
    list.push(
      l.currentItemSince
        ? Math.max(0, daysBetween(l.currentItemSince, now))
        : 0,
    );
    groups.set(l.currentItemId, list);
  }
  return [...groups.entries()]
    .map(([itemId, ds]) => {
      const it = structure.items.get(itemId)!;
      return {
        itemId,
        moduleId: it.moduleId,
        sectionId: it.sectionId,
        name: it.name,
        type: it.type,
        students: ds.length,
        medianDaysThere: round(median(ds) ?? 0),
      };
    })
    .sort(
      (a, b) =>
        b.students - a.students || b.medianDaysThere - a.medianDaysThere,
    )
    .slice(0, WHERE_NOW_LIMIT);
}

/** Every unfinished student who is inactive 7+ days or stuck 3+ days, most overdue first. */
function allCheckOn(
  structure: CourseStructure,
  learners: CaLearner[],
  now: Date,
): CheckOnRow[] {
  const rows: CheckOnRow[] = [];
  for (const l of learners) {
    if (l.finished) continue;
    const since = l.lastActiveAt ?? l.enrolledAt;
    const daysSinceActive = since ? Math.floor(daysBetween(since, now)) : 0;
    const daysOnItem = l.currentItemSince
      ? Math.floor(daysBetween(l.currentItemSince, now))
      : null;
    const it = l.currentItemId
      ? structure.items.get(l.currentItemId)
      : undefined;
    let reason: CheckOnRow['reason'] | null = null;
    if (since && daysSinceActive >= INACTIVE_DAYS) reason = 'inactive';
    else if (it && daysOnItem != null && daysOnItem >= STUCK_DAYS)
      reason = 'stuck';
    if (!reason) continue;
    rows.push({
      userId: l.userId,
      name: l.name,
      email: l.email,
      reason,
      daysSinceActive,
      item: it ? {itemId: it.itemId, name: it.name} : null,
      daysOnItem: it ? daysOnItem : null,
    });
  }
  return rows.sort(
    (a, b) =>
      b.daysSinceActive - a.daysSinceActive ||
      (b.daysOnItem ?? 0) - (a.daysOnItem ?? 0),
  );
}

/** The students to check on, capped at CHECK_ON_LIMIT rows. */
export function checkOn(
  structure: CourseStructure,
  learners: CaLearner[],
  now: Date,
): CheckOnRow[] {
  return allCheckOn(structure, learners, now).slice(0, CHECK_ON_LIMIT);
}

/** How many students meet each check-on reason in total (the list itself is capped). */
export function checkOnTotals(
  structure: CourseStructure,
  learners: CaLearner[],
  now: Date,
): {inactive: number; stuck: number} {
  const totals = {inactive: 0, stuck: 0};
  for (const row of allCheckOn(structure, learners, now))
    totals[row.reason] += 1;
  return totals;
}

export function studyModeSplit(learners: CaLearner[]) {
  let strictOnly = 0;
  let studyOnly = 0;
  let both = 0;
  for (const l of learners) {
    if (l.usedStrict && l.usedStudy) both += 1;
    else if (l.usedStrict) strictOnly += 1;
    else if (l.usedStudy) studyOnly += 1;
  }
  return {strictOnly, studyOnly, both};
}

/** 10 bands of a 0–100 score: 0–9, 10–19, … 90–100. */
export function scoreBand(pct: number): number {
  return Math.min(9, Math.max(0, Math.floor(pct / 10)));
}

/** Which tier-3 counter document a contribution goes to. */
export type CounterTarget =
  | {col: 'daily'; day: string}
  | {col: 'heat'; day: string}
  | {col: 'item'; itemId: string};

export interface CounterIncrement {
  target: CounterTarget;
  /** Field path → amount, ready for `$inc`. */
  inc: Record<string, number>;
}

const targetKey = (t: CounterTarget) =>
  t.col === 'item' ? `item:${t.itemId}` : `${t.col}:${t.day}`;

/**
 * What one learner's rows add to the course counters. The counters are the
 * sum of this over every learner, so an event applies `counterDelta(old, new)`.
 */
export function counterContributions(
  p: Pick<LearnerProjection, 'quizzes' | 'videos' | 'days'> | null,
): Map<string, CounterIncrement> {
  const out = new Map<string, CounterIncrement>();
  if (!p) return out;
  const add = (target: CounterTarget, field: string, n: number) => {
    if (!n) return;
    const key = targetKey(target);
    let row = out.get(key);
    if (!row) {
      row = {target, inc: {}};
      out.set(key, row);
    }
    row.inc[field] = (row.inc[field] ?? 0) + n;
  };
  for (const d of p.days) {
    const daily = {col: 'daily', day: d.day} as const;
    add(daily, 'activeLearners', d.active ? 1 : 0);
    add(daily, 'learningSeconds', d.learningSeconds);
    add(daily, 'newEnrolments', d.enrolled ? 1 : 0);
    for (const [type, n] of Object.entries(d.incidentsByType ?? {}))
      add(daily, `incidentsByType.${type}`, n);
    const heat = {col: 'heat', day: d.day} as const;
    d.secondsByHour.forEach((secs, h) => add(heat, `secondsByHour.${h}`, secs));
  }
  for (const q of p.quizzes) {
    const t = {col: 'item', itemId: q.quizId} as const;
    add(t, 'attempted', 1);
    add(t, 'firstPassed', q.firstAttemptPassed ? 1 : 0);
    add(t, 'passed', q.attemptsToPass != null ? 1 : 0);
    add(t, 'attemptsToPassSum', q.attemptsToPass ?? 0);
    if (q.firstAttemptScorePct != null)
      add(t, `scoreBands.${scoreBand(q.firstAttemptScorePct)}`, 1);
    for (const f of q.firstAttemptQuestions) {
      add(t, `questions.${f.questionId}.answered`, 1);
      add(t, `questions.${f.questionId}.correct`, f.correct ? 1 : 0);
    }
  }
  for (const v of p.videos) {
    const t = {col: 'item', itemId: v.itemId} as const;
    add(t, 'started', v.started ? 1 : 0);
    add(t, 'completed', v.completed ? 1 : 0);
    for (const [seg, n] of Object.entries(v.rewindSegments ?? {}))
      add(t, `segments.${seg}`, n);
  }
  return out;
}

/** `new − old` per counter field, dropping zeroes. Empty when nothing changed. */
export function counterDelta(
  oldRows: Pick<LearnerProjection, 'quizzes' | 'videos' | 'days'> | null,
  newRows: Pick<LearnerProjection, 'quizzes' | 'videos' | 'days'> | null,
): CounterIncrement[] {
  const a = counterContributions(oldRows);
  const b = counterContributions(newRows);
  const out: CounterIncrement[] = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const target = (b.get(key) ?? a.get(key))!.target;
    const inc: Record<string, number> = {};
    const fields = new Set([
      ...Object.keys(a.get(key)?.inc ?? {}),
      ...Object.keys(b.get(key)?.inc ?? {}),
    ]);
    for (const f of fields) {
      const n = (b.get(key)?.inc[f] ?? 0) - (a.get(key)?.inc[f] ?? 0);
      // Float learning seconds: ignore rounding noise.
      if (Math.abs(n) > 1e-9) inc[f] = n;
    }
    if (Object.keys(inc).length) out.push({target, inc});
  }
  return out;
}
