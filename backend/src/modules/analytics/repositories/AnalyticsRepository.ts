import {injectable, inject} from 'inversify';
import {Collection, ObjectId} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import type {
  CaCourseDaily,
  CaCourseHeatmapDay,
  CaItemCounters,
  CaLearner,
  CaLearnerDay,
  CaLearnerLock,
  CaLearnerQuiz,
  CaLearnerVideo,
  CaState,
} from '../interfaces.js';
import type {
  CounterIncrement,
  LearnerProjection,
} from '../services/projection.js';

/** A build step holds the version lease at most this long. */
export const LEASE_MS = 60 * 1000;
/** A learner recompute holds that learner's lock at most this long. */
export const LEARNER_LOCK_MS = 30 * 1000;

/**
 * Storage for the course analytics read models (`ca_*`). Only the analytics
 * projector writes here, and nothing outside the analytics module reads these
 * collections, so they can be dropped and rebuilt at any time.
 */
@injectable()
export class AnalyticsRepository {
  state!: Collection<CaState>;
  locks!: Collection<CaLearnerLock>;
  learners!: Collection<CaLearner>;
  learnerQuizzes!: Collection<CaLearnerQuiz>;
  learnerVideos!: Collection<CaLearnerVideo>;
  learnerDays!: Collection<CaLearnerDay>;
  courseDaily!: Collection<CaCourseDaily>;
  courseHeatmap!: Collection<CaCourseHeatmapDay>;
  itemStats!: Collection<CaItemCounters>;
  private initialized: Promise<void> | null = null;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  init(): Promise<void> {
    this.initialized ??= this.doInit().catch(err => {
      this.initialized = null;
      throw err;
    });
    return this.initialized;
  }

  private async doInit(): Promise<void> {
    const db = this.db;
    this.state = await db.getCollection<CaState>('ca_state');
    this.locks = await db.getCollection<CaLearnerLock>('ca_learner_locks');
    this.learners = await db.getCollection<CaLearner>('ca_learners');
    this.learnerQuizzes =
      await db.getCollection<CaLearnerQuiz>('ca_learner_quizzes');
    this.learnerVideos =
      await db.getCollection<CaLearnerVideo>('ca_learner_videos');
    this.learnerDays = await db.getCollection<CaLearnerDay>('ca_learner_days');
    this.courseDaily = await db.getCollection<CaCourseDaily>('ca_course_daily');
    this.courseHeatmap =
      await db.getCollection<CaCourseHeatmapDay>('ca_course_heatmap');
    this.itemStats = await db.getCollection<CaItemCounters>('ca_item_stats');

    await Promise.all([
      this.state.createIndex({versionId: 1}, {unique: true}),
      this.locks.createIndex({versionId: 1, userId: 1}, {unique: true}),
      this.locks.createIndex({versionId: 1, dirty: 1}),
      this.learners.createIndex({versionId: 1, userId: 1}, {unique: true}),
      this.learnerQuizzes.createIndex(
        {versionId: 1, userId: 1, quizId: 1},
        {unique: true},
      ),
      this.learnerQuizzes.createIndex({versionId: 1, quizId: 1}),
      this.learnerVideos.createIndex(
        {versionId: 1, userId: 1, itemId: 1},
        {unique: true},
      ),
      this.learnerVideos.createIndex({versionId: 1, itemId: 1}),
      this.learnerDays.createIndex(
        {versionId: 1, userId: 1, day: 1},
        {unique: true},
      ),
      this.learnerDays.createIndex({versionId: 1, day: 1}),
      this.courseDaily.createIndex({versionId: 1, day: 1}, {unique: true}),
      this.courseHeatmap.createIndex({versionId: 1, day: 1}, {unique: true}),
      this.itemStats.createIndex({versionId: 1, itemId: 1}, {unique: true}),
    ]);

    // Read-side indexes on source collections so per-learner recomputes stay
    // indexed. Index creation
    // only; nothing about how these records are written changes.
    const ensure = async (
      name: string,
      keys: Record<string, 1>,
      indexName: string,
    ) => {
      try {
        const col = await this.db.getCollection<any>(name);
        await col.createIndex(keys, {name: indexName, background: true});
      } catch (err) {
        console.warn(`[analytics] could not create index ${indexName}:`, err);
      }
    };
    await Promise.all([
      ensure(
        'anomaly_records',
        {versionId: 1, createdAt: 1},
        'analytics_versionId_createdAt',
      ),
      ensure(
        'user_activity_events',
        {courseVersionId: 1, updatedAt: 1},
        'analytics_courseVersionId_updatedAt',
      ),
      ensure(
        'studyViews',
        {courseVersionId: 1, firstStudiedAt: 1},
        'analytics_courseVersionId_firstStudiedAt',
      ),
      // Per-learner recomputes look one student up in a version. Without
      // these, an event in a large course scans the version's whole roster.
      ensure(
        'enrollment',
        {userId: 1, courseVersionId: 1},
        'analytics_userId_courseVersionId',
      ),
      ensure(
        'studyViews',
        {userId: 1, courseVersionId: 1},
        'analytics_userId_courseVersionId',
      ),
      ensure(
        'user_activity_events',
        {userId: 1, courseVersionId: 1},
        'analytics_userId_courseVersionId',
      ),
    ]);
  }

  // ---------------------------------------------------------------- state

  async getState(versionId: string): Promise<CaState | null> {
    await this.init();
    return this.state.findOne({versionId}, {projection: {_id: 0}});
  }

  /** Starts a first build (no-op if a state row already exists). */
  async createBuildState(
    versionId: string,
    courseId: string,
    total: number,
    now: Date,
  ): Promise<void> {
    await this.init();
    try {
      await this.state.updateOne(
        {versionId},
        {
          $setOnInsert: {
            versionId,
            courseId,
            status: 'building',
            cursorUserId: '',
            done: 0,
            total,
            startedAt: now,
            readyAt: null,
            leaseOwner: null,
            leaseUntil: null,
          },
        },
        {upsert: true},
      );
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
  }

  async updateState(versionId: string, update: Partial<CaState>) {
    await this.init();
    await this.state.updateOne({versionId}, {$set: update});
  }

  /** Bumped by every recompute; lets readers cache until something changes. */
  async bumpChangeSeq(versionId: string): Promise<void> {
    await this.init();
    await this.state.updateOne({versionId}, {$inc: {changeSeq: 1} as any});
  }

  /** Takes the single-builder lease. False while another holder's lease runs. */
  async acquireLease(
    versionId: string,
    owner: string,
    now = new Date(),
  ): Promise<boolean> {
    await this.init();
    const res = await this.state.findOneAndUpdate(
      {
        versionId,
        $or: [
          {leaseUntil: {$exists: false}},
          {leaseUntil: null},
          {leaseUntil: {$lt: now}},
        ],
      },
      {
        $set: {
          leaseOwner: owner,
          leaseUntil: new Date(now.getTime() + LEASE_MS),
        },
      },
      {returnDocument: 'after'},
    );
    return res?.leaseOwner === owner;
  }

  async releaseLease(versionId: string, owner: string): Promise<void> {
    await this.init();
    await this.state.updateOne(
      {versionId, leaseOwner: owner},
      {$set: {leaseOwner: null, leaseUntil: null}},
    );
  }

  /** Deletes every analytics row of a version, so the next view rebuilds it. */
  async deleteVersion(versionId: string): Promise<void> {
    await this.init();
    await Promise.all(
      [
        this.state,
        this.locks,
        this.learners,
        this.learnerQuizzes,
        this.learnerVideos,
        this.learnerDays,
        this.courseDaily,
        this.courseHeatmap,
        this.itemStats,
      ].map(c => (c as Collection<any>).deleteMany({versionId})),
    );
  }

  // ---------------------------------------------------------- learner locks

  /** Records that a learner needs recomputing. */
  async markDirty(versionId: string, userId: string): Promise<void> {
    await this.init();
    try {
      await this.locks.updateOne(
        {versionId, userId},
        {$set: {dirty: true}},
        {upsert: true},
      );
    } catch (err: any) {
      // Concurrent upsert of the same lock row: the other one set it.
      if (err?.code !== 11000) throw err;
      await this.locks.updateOne({versionId, userId}, {$set: {dirty: true}});
    }
  }

  /**
   * Takes the locks of these learners that nobody else holds, clearing their
   * dirty flag (the holder is about to recompute them). Returns the ids taken.
   */
  async lockLearners(
    versionId: string,
    userIds: string[],
    owner: string,
    now = new Date(),
  ): Promise<string[]> {
    await this.init();
    if (!userIds.length) return [];
    const free = {
      $or: [{owner: null}, {owner: {$exists: false}}, {until: {$lt: now}}],
    };
    const until = new Date(now.getTime() + LEARNER_LOCK_MS);
    try {
      await this.locks.bulkWrite(
        userIds.map(userId => ({
          updateOne: {
            filter: {versionId, userId, ...free},
            update: {$set: {owner, until, dirty: false}},
            upsert: true,
          },
        })),
        {ordered: false},
      );
    } catch (err: any) {
      // Held locks make their upserts collide with the existing row; those
      // learners simply aren't ours.
      if (err?.code !== 11000 && !err?.writeErrors) throw err;
    }
    const mine = await this.locks
      .find(
        {versionId, userId: {$in: userIds}, owner},
        {projection: {_id: 0, userId: 1}},
      )
      .toArray();
    return mine.map(m => m.userId);
  }

  /**
   * Releases the locks that stayed clean. Learners marked dirty meanwhile stay
   * locked, get their flag cleared, and are returned for another recompute.
   */
  async releaseLearners(
    versionId: string,
    userIds: string[],
    owner: string,
    now = new Date(),
  ): Promise<string[]> {
    await this.init();
    if (!userIds.length) return [];
    await this.locks.updateMany(
      {versionId, userId: {$in: userIds}, owner, dirty: false},
      {$set: {owner: null, until: null}},
    );
    const again = await this.locks
      .find(
        {versionId, userId: {$in: userIds}, owner},
        {projection: {_id: 0, userId: 1}},
      )
      .toArray();
    if (!again.length) return [];
    const ids = again.map(a => a.userId);
    await this.locks.updateMany(
      {versionId, userId: {$in: ids}, owner},
      {
        $set: {
          dirty: false,
          until: new Date(now.getTime() + LEARNER_LOCK_MS),
        },
      },
    );
    return ids;
  }

  /** Dirty learners nobody is recomputing (e.g. after a crash), oldest first. */
  async dirtyLearners(
    versionId: string,
    limit: number,
    now = new Date(),
  ): Promise<string[]> {
    await this.init();
    const rows = await this.locks
      .find(
        {
          versionId,
          dirty: true,
          $or: [{owner: null}, {owner: {$exists: false}}, {until: {$lt: now}}],
        },
        {projection: {_id: 0, userId: 1}},
      )
      .limit(limit)
      .toArray();
    return rows.map(r => r.userId);
  }

  // ------------------------------------------------------- tier 1 and 2

  async getLearners(
    versionId: string,
    userIds?: string[],
  ): Promise<CaLearner[]> {
    await this.init();
    return this.learners
      .find(userIds ? {versionId, userId: {$in: userIds}} : {versionId}, {
        projection: {_id: 0},
      })
      .toArray();
  }

  /** Ids of the learners with stored rows. */
  async learnerIds(versionId: string): Promise<string[]> {
    await this.init();
    return this.learners.distinct('userId', {versionId});
  }

  /** Every stored row of these learners, grouped by learner. */
  async getLearnerRows(
    versionId: string,
    userIds: string[],
  ): Promise<Map<string, LearnerProjection>> {
    await this.init();
    const filter = {versionId, userId: {$in: userIds}};
    const opts = {projection: {_id: 0}};
    const [learners, quizzes, videos, days] = await Promise.all([
      this.learners.find(filter, opts).toArray(),
      this.learnerQuizzes.find(filter, opts).toArray(),
      this.learnerVideos.find(filter, opts).toArray(),
      this.learnerDays.find(filter, opts).toArray(),
    ]);
    const out = new Map<string, LearnerProjection>();
    for (const l of learners)
      out.set(l.userId, {learner: l, quizzes: [], videos: [], days: []});
    for (const q of quizzes) out.get(q.userId)?.quizzes.push(q);
    for (const v of videos) out.get(v.userId)?.videos.push(v);
    for (const d of days) out.get(d.userId)?.days.push(d);
    return out;
  }

  /**
   * Replaces every tier-1/2 row of the given learners. A learner mapped to
   * null (no longer enrolled) loses all their rows. Callers hold the learners'
   * locks, so this never races another recompute of the same learner.
   */
  async replaceLearnerRows(
    versionId: string,
    rows: Map<string, LearnerProjection | null>,
  ): Promise<void> {
    await this.init();
    const userIds = [...rows.keys()];
    if (!userIds.length) return;
    const filter = {versionId, userId: {$in: userIds}};
    await Promise.all([
      this.learners.deleteMany(filter),
      this.learnerQuizzes.deleteMany(filter),
      this.learnerVideos.deleteMany(filter),
      this.learnerDays.deleteMany(filter),
    ]);
    const present = [...rows.values()].filter(
      (p): p is LearnerProjection => !!p,
    );
    const insert = async (col: Collection<any>, docs: unknown[]) => {
      if (docs.length) await col.insertMany(docs as any[], {ordered: false});
    };
    await Promise.all([
      insert(
        this.learners,
        present.map(p => p.learner),
      ),
      insert(
        this.learnerQuizzes,
        present.flatMap(p => p.quizzes),
      ),
      insert(
        this.learnerVideos,
        present.flatMap(p => p.videos),
      ),
      insert(
        this.learnerDays,
        present.flatMap(p => p.days),
      ),
    ]);
  }

  // ------------------------------------------------------------ tier 3

  /** Applies counter differences (upserting counter rows as needed). */
  async applyIncrements(
    versionId: string,
    incs: CounterIncrement[],
  ): Promise<void> {
    await this.init();
    const byCol = {daily: [] as any[], heat: [] as any[], item: [] as any[]};
    for (const {target, inc} of incs) {
      const filter =
        target.col === 'item'
          ? {versionId, itemId: target.itemId}
          : {versionId, day: target.day};
      byCol[target.col].push({
        updateOne: {filter, update: {$inc: inc}, upsert: true},
      });
    }
    await Promise.all([
      byCol.daily.length &&
        this.courseDaily.bulkWrite(byCol.daily, {ordered: false}),
      byCol.heat.length &&
        this.courseHeatmap.bulkWrite(byCol.heat, {ordered: false}),
      byCol.item.length &&
        this.itemStats.bulkWrite(byCol.item, {ordered: false}),
    ]);
  }

  /** Distinct learners with an active day in [fromDay, toDay]. */
  async distinctActiveLearners(
    versionId: string,
    fromDay: string,
    toDay: string,
  ): Promise<number> {
    await this.init();
    const [row] = await this.learnerDays
      .aggregate<{
        n: number;
      }>([
        {$match: {versionId, day: {$gte: fromDay, $lte: toDay}, active: true}},
        {$group: {_id: '$userId'}},
        {$count: 'n'},
      ])
      .toArray();
    return row?.n ?? 0;
  }

  // -------------------------------------------------------------- reads

  /** The per-learner fields the read-time figures need, for one version. */
  async learnersForRead(versionId: string): Promise<CaLearner[]> {
    await this.init();
    return this.learners
      .find(
        {versionId},
        {
          projection: {
            _id: 0,
            userId: 1,
            name: 1,
            email: 1,
            enrolledAt: 1,
            percent: 1,
            finished: 1,
            completedAt: 1,
            lastActiveAt: 1,
            currentItemId: 1,
            currentItemSince: 1,
            furthestModuleIndex: 1,
            completedModuleIds: 1,
            usedStrict: 1,
            usedStudy: 1,
            lastIncidentAt: 1,
          },
        },
      )
      .toArray();
  }

  async getItemCounters(versionId: string): Promise<CaItemCounters[]> {
    await this.init();
    return this.itemStats.find({versionId}, {projection: {_id: 0}}).toArray();
  }

  async getDaily(versionId: string, fromDay: string, toDay: string) {
    await this.init();
    return this.courseDaily
      .find(
        {versionId, day: {$gte: fromDay, $lte: toDay}},
        {projection: {_id: 0}},
      )
      .toArray();
  }

  async getHeatmap(versionId: string, fromDay: string, toDay: string) {
    await this.init();
    return this.courseHeatmap
      .find(
        {versionId, day: {$gte: fromDay, $lte: toDay}},
        {projection: {_id: 0}},
      )
      .toArray();
  }
}

export const toObjectIdOrString = (id: string): (string | ObjectId)[] =>
  ObjectId.isValid(id) && String(new ObjectId(id)) === id
    ? [id, new ObjectId(id)]
    : [id];
