import {injectable, inject} from 'inversify';
import {ANALYTICS_TYPES} from '../types.js';
import {AnalyticsRepository} from '../repositories/AnalyticsRepository.js';
import type {CourseInsights, Range} from '../interfaces.js';
import {addDays, istDay, weekdayOfDay, windowDays} from './time.js';

const hours = (s: number) => Math.round((s / 3600) * 100) / 100;

/**
 * Answers the Studio overview from the precomputed read models only: the
 * state row, the snapshot, the item stats and two range slices.
 */
@injectable()
export class AnalyticsQueryService {
  constructor(
    @inject(ANALYTICS_TYPES.AnalyticsRepository)
    private readonly repo: AnalyticsRepository,
  ) {}

  async overview(
    versionId: string,
    range: Range,
    now = new Date(),
  ): Promise<CourseInsights> {
    const state = await this.repo.getState(versionId);
    if (!state?.firstBuildCompletedAt) {
      return {status: 'building', updatedAt: null, range};
    }
    const today = istDay(now);
    const from = addDays(today, -range + 1);
    const [snapshot, items, daily, heat] = await Promise.all([
      this.repo.getSnapshot(versionId),
      this.repo.getItemStats(versionId),
      this.repo.getDaily(versionId, from, today),
      this.repo.getHeatmap(versionId, from, today),
    ]);
    if (!snapshot) return {status: 'building', updatedAt: null, range};

    const dailyByDay = new Map(daily.map(d => [d.day, d]));
    const days = windowDays(today, range);

    const heatmap = Array.from({length: 7}, () =>
      Array.from({length: 24}, () => 0),
    );
    for (const h of heat) {
      const w = weekdayOfDay(h.day);
      h.secondsByHour.forEach((s, hour) => (heatmap[w][hour] += s));
    }

    return {
      status: 'ready',
      updatedAt: (state.lastRefreshedAt ?? snapshot.computedAt).toISOString(),
      range,
      headline: snapshot.headline[String(range)],
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
      progressBands: snapshot.progressBands,
      funnel: snapshot.funnel,
      whereNow: snapshot.whereNow,
      quizzes: items
        .filter(i => i.type === 'QUIZ')
        .map(i => ({
          itemId: i.itemId,
          moduleId: i.moduleId,
          sectionId: i.sectionId,
          name: i.name,
          attempted: i.attempted ?? 0,
          firstAttemptPassRate: i.firstAttemptPassRate ?? null,
          avgAttemptsToPass: i.avgAttemptsToPass ?? null,
          scoreBands: i.scoreBands ?? Array.from({length: 10}, () => 0),
          hardestQuestions: i.hardestQuestions ?? [],
        })),
      videos: items
        .filter(i => i.type === 'VIDEO')
        .map(i => ({
          itemId: i.itemId,
          moduleId: i.moduleId,
          sectionId: i.sectionId,
          name: i.name,
          started: i.started ?? 0,
          completed: i.completed ?? 0,
          rewindHotspots: i.rewindHotspots ?? [],
        })),
      checkOn: snapshot.checkOn,
      proctoring: {
        checksOn: snapshot.checksOn,
        daily: days.map(day => {
          const d = dailyByDay.get(day);
          const h = (d?.learningSeconds ?? 0) / 3600;
          const per100Hours: Record<string, number> = {};
          if (d && h > 0)
            for (const [type, n] of Object.entries(d.incidentsByType ?? {}))
              per100Hours[type] = Math.round((n / h) * 100 * 10) / 10;
          return {day, per100Hours};
        }),
        shareWithIncident: snapshot.shareWithIncident[String(range)] ?? 0,
      },
      studyMode: snapshot.studyMode,
    };
  }
}
