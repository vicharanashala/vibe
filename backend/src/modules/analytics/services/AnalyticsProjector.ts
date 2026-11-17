import {injectable, inject} from 'inversify';
import {randomUUID} from 'crypto';
import {ANALYTICS_TYPES} from '../types.js';
import {AnalyticsRepository} from '../repositories/AnalyticsRepository.js';
import {AnalyticsSourceReader} from '../repositories/AnalyticsSourceReader.js';
import type {CaState} from '../interfaces.js';
import {
  CounterIncrement,
  CourseStructure,
  LearnerProjection,
  counterDelta,
  projectLearner,
} from './projection.js';

/** One build step processes at most this many learners… */
export const BUILD_STEP_LEARNERS = 500;
/** …or stops after this long, whichever comes first (design §3). */
export const BUILD_STEP_MS = 3000;
/** Learners recomputed together (one set of indexed reads per chunk). */
const CHUNK = 50;
/** Dirty learners swept per request (crash recovery; normally zero). */
export const SWEEP_LIMIT = 200;
const STRUCTURE_TTL_MS = 60 * 1000;
/** How often a ready version's learners are compared with the roster. */
export const ROSTER_CHECK_MS = 5 * 60 * 1000;
/** Learners fixed per roster check (the rest on the next check). */
const ROSTER_FIX_LIMIT = 500;

export interface BuildStepResult {
  state: CaState | null;
  /** Learners processed in this step (0 when another holder had the lease). */
  processed: number;
}

/**
 * Keeps the course analytics read models up to date.
 *
 * - Events: `learnerChanged` recomputes that one learner from their own
 *   records and applies the old→new difference to the course counters.
 * - First view: `buildStep` builds a version gradually, a bounded batch of
 *   learners per overview request.
 *
 * Both paths use the same per-learner recompute under a per-learner lock, so
 * the course counters always equal the sum of the learner rows. It only reads
 * learning records (via AnalyticsSourceReader) and only writes `ca_*`.
 */
@injectable()
export class AnalyticsProjector {
  /** Test seams: the size and time budget of one build step. */
  stepLearners = BUILD_STEP_LEARNERS;
  stepMs = BUILD_STEP_MS;
  private structures = new Map<
    string,
    {at: number; value: CourseStructure | null}
  >();

  constructor(
    @inject(ANALYTICS_TYPES.AnalyticsRepository)
    private readonly repo: AnalyticsRepository,
    @inject(ANALYTICS_TYPES.AnalyticsSourceReader)
    private readonly source: AnalyticsSourceReader,
  ) {}

  /** Course structure, cached briefly per instance. */
  async structure(versionId: string): Promise<CourseStructure | null> {
    const hit = this.structures.get(versionId);
    if (hit && Date.now() - hit.at < STRUCTURE_TTL_MS) return hit.value;
    const value = await this.source.loadStructure(versionId);
    this.structures.set(versionId, {at: Date.now(), value});
    return value;
  }

  /**
   * An event changed this learner's records. Does nothing for a version
   * without analytics. During a build, learners the build hasn't reached yet
   * are only marked: the build reads their up-to-date records when it gets
   * there.
   */
  async learnerChanged(
    versionId: string,
    userId: string,
    now = new Date(),
  ): Promise<void> {
    const state = await this.repo.getState(versionId);
    if (!state) return;
    await this.repo.markDirty(versionId, userId);
    if (state.status !== 'ready' && userId > state.cursorUserId) return;
    const structure = await this.structure(versionId);
    if (!structure) return;
    await this.recomputeLearners(structure, [userId], now);
  }

  /**
   * Recomputes these learners under their locks. Learners locked by someone
   * else stay dirty; that holder recomputes them again before releasing.
   */
  async recomputeLearners(
    structure: CourseStructure,
    userIds: string[],
    now = new Date(),
  ): Promise<number> {
    const {courseId, versionId} = structure;
    const owner = randomUUID();
    let pending = await this.repo.lockLearners(versionId, userIds, owner, now);
    let recomputed = 0;
    while (pending.length) {
      const [roster, oldRows] = await Promise.all([
        this.source.loadRoster(courseId, versionId, pending),
        this.repo.getLearnerRows(versionId, pending),
      ]);
      const enrolled = new Map(roster.map(r => [r.userId, r]));
      const records = await this.source.loadLearnerRecords(
        courseId,
        versionId,
        structure.quizIds,
        [...enrolled.keys()],
      );
      const replacements = new Map<string, LearnerProjection | null>();
      const incs: CounterIncrement[] = [];
      for (const userId of pending) {
        const old = oldRows.get(userId) ?? null;
        // Never replace rows computed later than this pass.
        if (old && old.learner.computedAt > now) continue;
        const entry = enrolled.get(userId);
        const next = entry
          ? projectLearner(
              structure,
              {
                userId,
                enrollment: entry.enrollment,
                progress: entry.progress,
                ...records.get(userId)!,
              },
              old?.learner ?? null,
              now,
            )
          : null;
        if (!old && !next) continue;
        replacements.set(userId, next);
        incs.push(...counterDelta(old, next));
      }
      await this.repo.replaceLearnerRows(versionId, replacements);
      await this.repo.applyIncrements(versionId, incs);
      if (replacements.size) await this.repo.bumpChangeSeq(versionId);
      recomputed += replacements.size;
      pending = await this.repo.releaseLearners(
        versionId,
        pending,
        owner,
        new Date(),
      );
    }
    return recomputed;
  }

  /**
   * Advances a version's gradual build by one bounded step, starting it if
   * the version has no analytics yet. Returns the state after the step.
   */
  async buildStep(
    courseId: string,
    versionId: string,
    now = new Date(),
  ): Promise<BuildStepResult> {
    let state = await this.repo.getState(versionId);
    if (!state) {
      const ids = await this.source.rosterUserIds(courseId, versionId);
      await this.repo.createBuildState(versionId, courseId, ids.length, now);
      state = await this.repo.getState(versionId);
    }
    if (!state || state.status === 'ready') return {state, processed: 0};

    const owner = randomUUID();
    if (!(await this.repo.acquireLease(versionId, owner, now)))
      return {state, processed: 0};
    let processed = 0;
    try {
      const structure = await this.structure(versionId);
      if (!structure) return {state, processed: 0};
      const all = await this.source.rosterUserIds(courseId, versionId);
      let cursor = state.cursorUserId;
      const todo = all.filter(id => id > cursor);
      const started = Date.now();
      let done = state.done;
      while (
        processed < todo.length &&
        processed < this.stepLearners &&
        Date.now() - started < this.stepMs
      ) {
        const chunk = todo.slice(
          processed,
          Math.min(processed + CHUNK, this.stepLearners),
        );
        await this.recomputeLearners(structure, chunk, now);
        processed += chunk.length;
        done += chunk.length;
        cursor = chunk[chunk.length - 1];
        await this.repo.updateState(versionId, {
          cursorUserId: cursor,
          done,
          total: Math.max(all.length, done),
        });
      }
      // Events on learners already built whose recompute didn't finish.
      await this.sweep(structure, cursor, now);
      if (processed >= todo.length) {
        await this.repo.updateState(versionId, {
          status: 'ready',
          readyAt: new Date(),
          rosterCheckedAt: now,
          done,
          total: done,
        });
      }
    } finally {
      await this.repo.releaseLease(versionId, owner);
    }
    return {state: await this.repo.getState(versionId), processed};
  }

  /**
   * Recomputes dirty learners nobody is working on (after a crash or an
   * interrupted recompute), up to SWEEP_LIMIT. During a build, only learners
   * the build has already reached.
   */
  async sweep(
    structure: CourseStructure,
    upToUserId?: string,
    now = new Date(),
  ): Promise<number> {
    let ids = await this.repo.dirtyLearners(structure.versionId, SWEEP_LIMIT);
    if (upToUserId !== undefined) ids = ids.filter(id => id <= upToUserId);
    if (!ids.length) return 0;
    return this.recomputeLearners(structure, ids, now);
  }

  /**
   * Enrolments made inside another service's transaction can't notify after
   * commit, so a ready version's stored learners are compared with the roster
   * at most every ROSTER_CHECK_MS, and differences recomputed.
   */
  async reconcileRoster(
    structure: CourseStructure,
    now = new Date(),
  ): Promise<number> {
    const {courseId, versionId} = structure;
    const state = await this.repo.getState(versionId);
    const last = state?.rosterCheckedAt?.getTime() ?? 0;
    if (
      !state ||
      state.status !== 'ready' ||
      now.getTime() - last < ROSTER_CHECK_MS
    )
      return 0;
    await this.repo.updateState(versionId, {rosterCheckedAt: now});
    const [roster, stored] = await Promise.all([
      this.source.rosterUserIds(courseId, versionId),
      this.repo.learnerIds(versionId),
    ]);
    const inRoster = new Set(roster);
    const inStore = new Set(stored);
    const diff = [
      ...roster.filter(id => !inStore.has(id)),
      ...stored.filter(id => !inRoster.has(id)),
    ].slice(0, ROSTER_FIX_LIMIT);
    if (!diff.length) return 0;
    let fixed = 0;
    for (let i = 0; i < diff.length; i += CHUNK)
      fixed += await this.recomputeLearners(
        structure,
        diff.slice(i, i + CHUNK),
        now,
      );
    return fixed;
  }

  /** Admin rebuild: drop the version's analytics; the next view rebuilds. */
  async resetVersion(versionId: string): Promise<void> {
    this.structures.delete(versionId);
    await this.repo.deleteVersion(versionId);
  }
}
