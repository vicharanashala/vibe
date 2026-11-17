import {injectable, inject} from 'inversify';
import {randomUUID} from 'crypto';
import {ANALYTICS_TYPES} from '../types.js';
import {AnalyticsRepository} from '../repositories/AnalyticsRepository.js';
import {
  AnalyticsSourceReader,
  RosterEntry,
} from '../repositories/AnalyticsSourceReader.js';
import {
  CaCourseSnapshot,
  CaItemStats,
  CaLearner,
  Headline,
  RANGES,
} from '../interfaces.js';
import {
  CourseStructure,
  LearnerProjection,
  checkOn,
  learnerHeadline,
  moduleFunnel,
  progressBands,
  projectLearner,
  scoreBand,
  studyModeSplit,
  whereNow,
} from './projection.js';
import {addDays, istDay} from './time.js';

/** Writes still in flight when a refresh starts are picked up next time. */
export const SAFETY_MARGIN_MS = 2 * 60 * 1000;
const BATCH = 500;

export interface RefreshResult {
  versionId: string;
  outcome: 'refreshed' | 'rebuilt' | 'skipped' | 'locked' | 'missing';
  learnersRecomputed: number;
}

/**
 * Keeps the course analytics read models up to date from the existing
 * learning records. It only ever reads those records (via
 * AnalyticsSourceReader) and only writes `ca_*` collections, so nothing it
 * does can change a student's progress.
 */
@injectable()
export class AnalyticsProjector {
  /** Test seam: lets tests make a refresh fail midway. */
  beforeAggregate?: () => Promise<void> | void;

  constructor(
    @inject(ANALYTICS_TYPES.AnalyticsRepository)
    private readonly repo: AnalyticsRepository,
    @inject(ANALYTICS_TYPES.AnalyticsSourceReader)
    private readonly source: AnalyticsSourceReader,
  ) {}

  /** Incremental refresh: only students with new records since the watermark. */
  async refreshVersion(
    courseId: string,
    versionId: string,
    now = new Date(),
  ): Promise<RefreshResult> {
    const state = await this.repo.getState(versionId);
    if (!state?.firstBuildCompletedAt || !state.watermark) {
      return this.rebuildVersion(courseId, versionId, now);
    }
    const owner = randomUUID();
    if (!(await this.repo.acquireLease(versionId, courseId, owner, now))) {
      return {versionId, outcome: 'locked', learnersRecomputed: 0};
    }
    try {
      await this.repo.setStatus(versionId, {status: 'refreshing'});
      const structure = await this.source.loadStructure(versionId);
      if (!structure) {
        await this.repo.releaseLease(versionId, owner, {status: 'idle'});
        return {versionId, outcome: 'missing', learnersRecomputed: 0};
      }
      const upTo = new Date(now.getTime() - SAFETY_MARGIN_MS);
      const dirty = await this.source.dirtyUserIds(
        courseId,
        versionId,
        structure.quizIds,
        state.watermark,
        upTo,
      );

      // Roster comparison: catches enrolments, unenrolments and progress
      // changes that leave no timestamped record.
      const roster = await this.source.loadRoster(courseId, versionId);
      const stored = await this.repo.getLearnerCurrentState(versionId);
      const storedById = new Map(stored.map(s => [s.userId, s]));
      const rosterIds = new Set(roster.map(r => r.userId));
      for (const r of roster) {
        const s = storedById.get(r.userId);
        const cur = r.progress?.currentItem
          ? String(r.progress.currentItem)
          : null;
        const pct = Number(r.enrollment.percentCompleted ?? 0) || 0;
        if (!s || s.currentItemId !== cur || s.percent !== pct)
          dirty.add(r.userId);
      }
      const removed = stored
        .map(s => s.userId)
        .filter(id => !rosterIds.has(id));

      // After a failed run the per-learner rows may be newer than the course
      // summaries, so the summaries are rebuilt in full even with no new records.
      const recovering = state.status === 'failed';
      if (!dirty.size && !removed.length && !recovering) {
        await this.repo.releaseLease(versionId, owner, {
          watermark: upTo,
          lastRefreshedAt: now,
          status: 'idle',
        });
        return {versionId, outcome: 'skipped', learnersRecomputed: 0};
      }

      const dirtyRoster = roster.filter(r => dirty.has(r.userId));
      const affectedDays = new Set<string>();
      for (const d of await this.repo.getLearnerDayKeys(versionId, [
        ...dirtyRoster.map(r => r.userId),
        ...removed,
      ]))
        affectedDays.add(d);
      if (removed.length) await this.repo.deleteLearners(versionId, removed);
      const recomputed = await this.recomputeLearners(
        structure,
        dirtyRoster,
        upTo,
        affectedDays,
      );

      await this.beforeAggregate?.();
      await this.aggregate(
        structure,
        recovering ? null : [...affectedDays],
        now,
      );
      await this.repo.releaseLease(versionId, owner, {
        watermark: upTo,
        lastRefreshedAt: now,
        status: 'idle',
        lastError: null,
      });
      return {versionId, outcome: 'refreshed', learnersRecomputed: recomputed};
    } catch (err) {
      await this.repo.releaseLease(versionId, owner, {
        status: 'failed',
        lastError: String((err as Error)?.message ?? err),
      });
      throw err;
    }
  }

  /** Full rebuild of one version from the source records. */
  async rebuildVersion(
    courseId: string,
    versionId: string,
    now = new Date(),
  ): Promise<RefreshResult> {
    const owner = randomUUID();
    if (!(await this.repo.acquireLease(versionId, courseId, owner, now))) {
      return {versionId, outcome: 'locked', learnersRecomputed: 0};
    }
    try {
      await this.repo.setStatus(versionId, {status: 'rebuilding'});
      const structure = await this.source.loadStructure(versionId);
      if (!structure) {
        await this.repo.releaseLease(versionId, owner, {status: 'idle'});
        return {versionId, outcome: 'missing', learnersRecomputed: 0};
      }
      const upTo = new Date(now.getTime() - SAFETY_MARGIN_MS);
      const roster = await this.source.loadRoster(courseId, versionId);
      const stored = await this.repo.getLearnerCurrentState(versionId);
      const rosterIds = new Set(roster.map(r => r.userId));
      const removed = stored
        .map(s => s.userId)
        .filter(id => !rosterIds.has(id));
      if (removed.length) await this.repo.deleteLearners(versionId, removed);
      const recomputed = await this.recomputeLearners(
        structure,
        roster,
        upTo,
        new Set(),
      );
      await this.beforeAggregate?.();
      await this.aggregate(structure, null, now);
      await this.repo.releaseLease(versionId, owner, {
        watermark: upTo,
        lastRefreshedAt: now,
        firstBuildCompletedAt: now,
        status: 'idle',
        lastError: null,
      });
      return {versionId, outcome: 'rebuilt', learnersRecomputed: recomputed};
    } catch (err) {
      await this.repo.releaseLease(versionId, owner, {
        status: 'failed',
        lastError: String((err as Error)?.message ?? err),
      });
      throw err;
    }
  }

  /** Every version with active students, one at a time. */
  async refreshAllActive(
    mode: 'refresh' | 'rebuild',
    versions: {courseId: string; courseVersionId: string}[],
  ): Promise<{done: number; failed: number; results: RefreshResult[]}> {
    let done = 0;
    let failed = 0;
    const results: RefreshResult[] = [];
    for (const v of versions) {
      try {
        const r =
          mode === 'rebuild'
            ? await this.rebuildVersion(v.courseId, v.courseVersionId)
            : await this.refreshVersion(v.courseId, v.courseVersionId);
        results.push(r);
        done += 1;
      } catch (err) {
        failed += 1;
        console.error(
          `[analytics] ${mode} failed for ${v.courseId}/${v.courseVersionId}:`,
          err,
        );
      }
    }
    return {done, failed, results};
  }

  private async recomputeLearners(
    structure: CourseStructure,
    roster: RosterEntry[],
    upTo: Date,
    affectedDays: Set<string>,
  ): Promise<number> {
    const {courseId, versionId} = structure;
    for (let i = 0; i < roster.length; i += BATCH) {
      const batch = roster.slice(i, i + BATCH);
      const ids = batch.map(r => r.userId);
      const [records, previous] = await Promise.all([
        this.source.loadLearnerRecords(
          courseId,
          versionId,
          structure.quizIds,
          ids,
        ),
        this.repo.getLearners(versionId, ids),
      ]);
      const prevById = new Map(previous.map(p => [p.userId, p]));
      const projections: LearnerProjection[] = batch.map(r =>
        projectLearner(
          structure,
          {
            userId: r.userId,
            enrollment: r.enrollment,
            progress: r.progress,
            ...records.get(r.userId)!,
          },
          prevById.get(r.userId) ?? null,
          upTo,
        ),
      );
      for (const p of projections)
        for (const d of p.days) affectedDays.add(d.day);
      await this.repo.replaceLearners(versionId, ids, {
        learners: projections.map(p => p.learner),
        quizzes: projections.flatMap(p => p.quizzes),
        videos: projections.flatMap(p => p.videos),
        days: projections.flatMap(p => p.days),
      });
    }
    return roster.length;
  }

  /** Tier 3: course summaries from the per-learner rows. */
  private async aggregate(
    structure: CourseStructure,
    days: string[] | null,
    now: Date,
  ): Promise<void> {
    const {courseId, versionId} = structure;
    if (!days || days.length) await this.repo.aggregateDays(versionId, days);

    const learners: CaLearner[] = await this.repo.getLearners(versionId);
    const today = istDay(now);
    const headline: Record<string, Headline> = {};
    const shareWithIncident: Record<string, number> = {};
    const activeCur = await this.repo.distinctLearnersBetween(
      versionId,
      addDays(today, -6),
      today,
      'active',
    );
    for (const range of RANGES) {
      const prevEnd = addDays(today, -range);
      const activePrev = await this.repo.distinctLearnersBetween(
        versionId,
        addDays(prevEnd, -6),
        prevEnd,
        'active',
      );
      const hoursCur = await this.repo.learningSecondsBetween(
        versionId,
        addDays(today, -range + 1),
        today,
      );
      const hoursPrev = await this.repo.learningSecondsBetween(
        versionId,
        addDays(prevEnd, -range + 1),
        prevEnd,
      );
      const withIncident = await this.repo.distinctLearnersBetween(
        versionId,
        addDays(today, -range + 1),
        today,
        'incident',
      );
      const hours = (s: number) => Math.round((s / 3600) * 10) / 10;
      headline[String(range)] = learnerHeadline(learners, range, today, {
        activeThisWeek: {
          current: activeCur,
          previous: activePrev || null,
        },
        learningHours: {
          current: hours(hoursCur.seconds),
          previous: hoursPrev.days ? hours(hoursPrev.seconds) : null,
        },
        shareWithIncident: 0,
      });
      shareWithIncident[String(range)] = learners.length
        ? withIncident / learners.length
        : 0;
    }

    const snapshot: CaCourseSnapshot = {
      versionId,
      courseId,
      computedAt: now,
      headline,
      shareWithIncident,
      progressBands: progressBands(learners),
      funnel: moduleFunnel(structure, learners),
      whereNow: whereNow(structure, learners, now),
      checkOn: checkOn(structure, learners, now),
      studyMode: studyModeSplit(learners),
      checksOn: await this.source.proctoringChecksOn(courseId, versionId),
    };
    await this.repo.replaceSnapshot(snapshot);
    await this.repo.replaceItemStats(
      versionId,
      await this.itemStats(structure),
    );
  }

  private async itemStats(structure: CourseStructure): Promise<CaItemStats[]> {
    const {versionId} = structure;
    const [{perQuiz, perQuestion}, {perVideo, perSegment}] = await Promise.all([
      this.repo.quizAggregates(versionId),
      this.repo.videoAggregates(versionId),
    ]);
    const quizRows = new Map(perQuiz.map((q: any) => [String(q._id), q]));
    const questionsByQuiz = new Map<
      string,
      {questionId: string; answered: number; correct: number}[]
    >();
    for (const q of perQuestion) {
      const list = questionsByQuiz.get(q._id.quizId) ?? [];
      list.push({
        questionId: q._id.questionId,
        answered: q.answered,
        correct: q.correct,
      });
      questionsByQuiz.set(q._id.quizId, list);
    }
    const hardest = new Map<
      string,
      {questionId: string; answered: number; correctRate: number}[]
    >();
    for (const [quizId, list] of questionsByQuiz) {
      hardest.set(
        quizId,
        list
          .filter(q => q.answered > 0)
          .map(q => ({
            questionId: q.questionId,
            answered: q.answered,
            correctRate: q.correct / q.answered,
          }))
          .sort(
            (a, b) => a.correctRate - b.correctRate || b.answered - a.answered,
          )
          .slice(0, 5),
      );
    }
    const texts = await this.source.questionTexts(
      [...hardest.values()].flat().map(q => q.questionId),
    );
    const videoRows = new Map(perVideo.map((v: any) => [String(v._id), v]));
    const segsByVideo = new Map<
      string,
      {startSecond: number; rewinds: number}[]
    >();
    for (const s of perSegment) {
      const list = segsByVideo.get(s._id.itemId) ?? [];
      list.push({startSecond: Number(s._id.seg), rewinds: s.rewinds});
      segsByVideo.set(s._id.itemId, list);
    }

    const out: CaItemStats[] = [];
    for (const item of structure.items.values()) {
      const base = {
        versionId,
        itemId: item.itemId,
        moduleId: item.moduleId,
        sectionId: item.sectionId,
        name: item.name,
        order: item.order,
      };
      if (item.type === 'QUIZ') {
        const q: any = quizRows.get(item.itemId);
        const bands = Array.from({length: 10}, () => 0);
        for (const s of (q?.scores ?? []) as (number | null)[])
          if (s != null) bands[scoreBand(s)] += 1;
        out.push({
          ...base,
          type: 'QUIZ',
          attempted: q?.attempted ?? 0,
          firstAttemptPassRate: q?.attempted
            ? q.firstPassed / q.attempted
            : null,
          avgAttemptsToPass:
            q?.avgAttemptsToPass == null
              ? null
              : Math.round(q.avgAttemptsToPass * 100) / 100,
          scoreBands: bands,
          hardestQuestions: (hardest.get(item.itemId) ?? []).map(h => ({
            ...h,
            text: texts.get(h.questionId) ?? '',
          })),
        });
      } else if (item.type === 'VIDEO') {
        const v: any = videoRows.get(item.itemId);
        out.push({
          ...base,
          type: 'VIDEO',
          started: v?.started ?? 0,
          completed: v?.completed ?? 0,
          rewindHotspots: (segsByVideo.get(item.itemId) ?? [])
            .filter(s => s.rewinds > 0)
            .sort(
              (a, b) => b.rewinds - a.rewinds || a.startSecond - b.startSecond,
            )
            .slice(0, 5),
        });
      }
    }
    return out;
  }
}
