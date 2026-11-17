import {injectable, inject} from 'inversify';
import {ANALYTICS_TYPES} from '../types.js';
import {AnalyticsRepository} from '../repositories/AnalyticsRepository.js';
import {AnalyticsSourceReader} from '../repositories/AnalyticsSourceReader.js';
import type {
  CaItemCounters,
  CaLearner,
  CourseInsights,
  Range,
} from '../interfaces.js';
import {AnalyticsProjector} from './AnalyticsProjector.js';
import {
  CourseStructure,
  checkOn,
  checkOnTotals,
  learnerHeadline,
  moduleFunnel,
  progressBands,
  studyModeSplit,
  whereNow,
} from './projection.js';
import {addDays, istDay, weekdayOfDay, windowDays} from './time.js';

const hours = (s: number) => Math.round((s / 3600) * 100) / 100;
const hours1 = (s: number) => Math.round((s / 3600) * 10) / 10;

/** A ready overview is reused for this long unless something changed. */
export const OVERVIEW_CACHE_MS = 30 * 1000;

/**
 * Answers the Studio overview. While a version is still being built, each
 * request advances the build by one step and reports progress. Once ready,
 * counter-style figures are read from the event-maintained counters, and
 * time-based figures (inactivity, time on a lesson, medians, bands, funnel)
 * are computed now from the per-learner rows (design §5).
 */
@injectable()
export class AnalyticsQueryService {
  /** Test seam: 0 disables the per-instance cache. */
  cacheMs = OVERVIEW_CACHE_MS;
  private cache = new Map<
    string,
    {at: number; seq: number; value: CourseInsights}
  >();

  constructor(
    @inject(ANALYTICS_TYPES.AnalyticsRepository)
    private readonly repo: AnalyticsRepository,
    @inject(ANALYTICS_TYPES.AnalyticsSourceReader)
    private readonly source: AnalyticsSourceReader,
    @inject(ANALYTICS_TYPES.AnalyticsProjector)
    private readonly projector: AnalyticsProjector,
  ) {}

  async overview(
    courseId: string,
    versionId: string,
    range: Range,
    now = new Date(),
  ): Promise<CourseInsights> {
    let state = await this.repo.getState(versionId);
    if (!state || state.status !== 'ready') {
      ({state} = await this.projector.buildStep(courseId, versionId, now));
      if (!state || state.status !== 'ready') {
        const total = state?.total ?? 0;
        const done = state?.done ?? 0;
        return {
          status: 'building',
          buildProgress: total
            ? Math.min(99, Math.floor((done / total) * 100))
            : 0,
          updatedAt: now.toISOString(),
          range,
        };
      }
    }

    const structure = await this.projector.structure(versionId);
    if (!structure) {
      return {status: 'building', buildProgress: 0, updatedAt: null, range};
    }
    // Normally nothing to do; repairs learners whose recompute was cut short,
    // and picks up enrolments made where no event could fire.
    await this.projector.sweep(structure, undefined, now);
    await this.projector.reconcileRoster(structure, now);
    state = (await this.repo.getState(versionId)) ?? state;

    const key = `${versionId}:${range}`;
    const seq = state.changeSeq ?? 0;
    const hit = this.cache.get(key);
    if (
      this.cacheMs > 0 &&
      hit &&
      hit.seq === seq &&
      now.getTime() - hit.at < this.cacheMs
    )
      return {...hit.value, updatedAt: now.toISOString()};

    const value = await this.compute(courseId, structure, range, now);
    if (this.cacheMs > 0) this.cache.set(key, {at: now.getTime(), seq, value});
    return value;
  }

  private async compute(
    courseId: string,
    structure: CourseStructure,
    range: Range,
    now: Date,
  ): Promise<CourseInsights> {
    const {versionId} = structure;
    const today = istDay(now);
    const from = addDays(today, -range + 1);
    const prevEnd = addDays(today, -range);
    const prevFrom = addDays(prevEnd, -range + 1);
    const [learners, counters, daily, heat, checksOn] = await Promise.all([
      this.repo.learnersForRead(versionId),
      this.repo.getItemCounters(versionId),
      this.repo.getDaily(versionId, prevFrom, today),
      this.repo.getHeatmap(versionId, from, today),
      this.source.proctoringChecksOn(courseId, versionId),
    ]);
    const [activeCur, activePrev] = await Promise.all([
      this.repo.distinctActiveLearners(versionId, addDays(today, -6), today),
      this.repo.distinctActiveLearners(
        versionId,
        addDays(prevEnd, -6),
        prevEnd,
      ),
    ]);

    const dailyByDay = new Map(daily.map(d => [d.day, d]));
    const days = windowDays(today, range);
    const prevDays = windowDays(prevEnd, range);
    const sumSeconds = (ds: string[]) =>
      ds.reduce((a, d) => a + (dailyByDay.get(d)?.learningSeconds ?? 0), 0);
    const prevHasDays = prevDays.some(d => dailyByDay.has(d));

    const headline = learnerHeadline(learners, range, today, {
      activeThisWeek: {current: activeCur, previous: activePrev || null},
      learningHours: {
        current: hours1(sumSeconds(days)),
        previous: prevHasDays ? hours1(sumSeconds(prevDays)) : null,
      },
      shareWithIncident: 0,
    });

    const heatmap = Array.from({length: 7}, () =>
      Array.from({length: 24}, () => 0),
    );
    for (const h of heat) {
      const w = weekdayOfDay(h.day);
      for (const [hour, secs] of Object.entries(h.secondsByHour ?? {}))
        heatmap[w][Number(hour)] += secs;
    }

    const fromStart = new Date(`${from}T00:00:00+05:30`);
    const withIncident = learners.filter(
      (l: CaLearner) => l.lastIncidentAt && l.lastIncidentAt >= fromStart,
    ).length;

    const {quizzes, videos} = await this.items(structure, counters);

    return {
      status: 'ready',
      updatedAt: now.toISOString(),
      range,
      headline,
      daily: days.map(day => {
        const d = dailyByDay.get(day);
        return {
          day,
          activeLearners: d?.activeLearners ?? 0,
          learningHours: hours(d?.learningSeconds ?? 0),
          newEnrolments: d?.newEnrolments ?? 0,
        };
      }),
      heatmap: heatmap.map(row => row.map(hours)),
      progressBands: progressBands(learners),
      funnel: moduleFunnel(structure, learners),
      whereNow: whereNow(structure, learners, now),
      quizzes,
      videos,
      checkOn: checkOn(structure, learners, now),
      checkOnTotals: checkOnTotals(structure, learners, now),
      proctoring: {
        checksOn,
        daily: days.map(day => {
          const d = dailyByDay.get(day);
          const h = (d?.learningSeconds ?? 0) / 3600;
          const per100Hours: Record<string, number> = {};
          if (d && h > 0)
            for (const [type, n] of Object.entries(d.incidentsByType ?? {}))
              if (n) per100Hours[type] = Math.round((n / h) * 100 * 10) / 10;
          return {day, per100Hours};
        }),
        shareWithIncident: learners.length ? withIncident / learners.length : 0,
      },
      studyMode: studyModeSplit(learners),
    };
  }

  /** Quiz and video figures from the counters, in course order. */
  private async items(structure: CourseStructure, counters: CaItemCounters[]) {
    const byItem = new Map(counters.map(c => [c.itemId, c]));
    const hardestByQuiz = new Map<
      string,
      {questionId: string; answered: number; correctRate: number}[]
    >();
    for (const id of structure.quizIds) {
      const qs = byItem.get(id)?.questions ?? {};
      hardestByQuiz.set(
        id,
        Object.entries(qs)
          // Zero increments are never written, so a field can be missing.
          .filter(([, q]) => (q.answered ?? 0) > 0)
          .map(([questionId, q]) => ({
            questionId,
            answered: q.answered,
            correctRate: (q.correct ?? 0) / q.answered,
          }))
          .sort(
            (a, b) => a.correctRate - b.correctRate || b.answered - a.answered,
          )
          .slice(0, 5),
      );
    }
    const texts = await this.source.questionTexts(
      [...hardestByQuiz.values()].flat().map(q => q.questionId),
    );

    const ordered = [...structure.items.values()].sort(
      (a, b) => a.order - b.order,
    );
    const base = (it: (typeof ordered)[number]) => ({
      itemId: it.itemId,
      moduleId: it.moduleId,
      sectionId: it.sectionId,
      name: it.name,
    });
    const quizzes = ordered
      .filter(it => it.type === 'QUIZ')
      .map(it => {
        const c = byItem.get(it.itemId);
        const attempted = c?.attempted ?? 0;
        const passed = c?.passed ?? 0;
        return {
          ...base(it),
          attempted,
          firstAttemptPassRate: attempted
            ? (c?.firstPassed ?? 0) / attempted
            : null,
          avgAttemptsToPass: passed
            ? Math.round(((c?.attemptsToPassSum ?? 0) / passed) * 100) / 100
            : null,
          scoreBands: Array.from(
            {length: 10},
            (_, i) => c?.scoreBands?.[String(i)] ?? 0,
          ),
          hardestQuestions: (hardestByQuiz.get(it.itemId) ?? []).map(h => ({
            ...h,
            text: texts.get(h.questionId) ?? '',
          })),
        };
      });
    const videos = ordered
      .filter(it => it.type === 'VIDEO')
      .map(it => {
        const c = byItem.get(it.itemId);
        return {
          ...base(it),
          started: c?.started ?? 0,
          completed: c?.completed ?? 0,
          rewindHotspots: Object.entries(c?.segments ?? {})
            .map(([seg, rewinds]) => ({startSecond: Number(seg), rewinds}))
            .filter(s => s.rewinds > 0)
            .sort(
              (a, b) => b.rewinds - a.rewinds || a.startSecond - b.startSecond,
            )
            .slice(0, 5),
        };
      });
    return {quizzes, videos};
  }
}
