import {injectable, inject} from 'inversify';
import {Collection, ObjectId} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import type {
  CaCourseDaily,
  CaCourseHeatmapDay,
  CaCourseSnapshot,
  CaItemStats,
  CaLearner,
  CaLearnerDay,
  CaLearnerQuiz,
  CaLearnerVideo,
  CaState,
} from '../interfaces.js';

export const LEASE_MS = 15 * 60 * 1000;

/**
 * Storage for the course analytics read models (`ca_*`). Only the analytics
 * projector writes here, and nothing outside the analytics module reads these
 * collections, so they can be dropped and rebuilt at any time.
 */
@injectable()
export class AnalyticsRepository {
  state!: Collection<CaState>;
  learners!: Collection<CaLearner>;
  learnerQuizzes!: Collection<CaLearnerQuiz>;
  learnerVideos!: Collection<CaLearnerVideo>;
  learnerDays!: Collection<CaLearnerDay>;
  courseDaily!: Collection<CaCourseDaily>;
  courseHeatmap!: Collection<CaCourseHeatmapDay>;
  itemStats!: Collection<CaItemStats>;
  snapshots!: Collection<CaCourseSnapshot>;
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
    this.learners = await db.getCollection<CaLearner>('ca_learners');
    this.learnerQuizzes =
      await db.getCollection<CaLearnerQuiz>('ca_learner_quizzes');
    this.learnerVideos =
      await db.getCollection<CaLearnerVideo>('ca_learner_videos');
    this.learnerDays = await db.getCollection<CaLearnerDay>('ca_learner_days');
    this.courseDaily = await db.getCollection<CaCourseDaily>('ca_course_daily');
    this.courseHeatmap =
      await db.getCollection<CaCourseHeatmapDay>('ca_course_heatmap');
    this.itemStats = await db.getCollection<CaItemStats>('ca_item_stats');
    this.snapshots =
      await db.getCollection<CaCourseSnapshot>('ca_course_snapshot');

    await Promise.all([
      this.state.createIndex({versionId: 1}, {unique: true}),
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
      this.snapshots.createIndex({versionId: 1}, {unique: true}),
    ]);

    // Read-side indexes on source collections so the projector can find
    // "records for this version since T" without scanning. Index creation
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
    ]);
  }

  // ---------------------------------------------------------------- state

  async getState(versionId: string): Promise<CaState | null> {
    await this.init();
    return this.state.findOne({versionId}, {projection: {_id: 0}});
  }

  /**
   * Takes the single-refresher lease for a version. Returns false when
   * another refresher holds an unexpired lease.
   */
  async acquireLease(
    versionId: string,
    courseId: string,
    owner: string,
    now = new Date(),
  ): Promise<boolean> {
    await this.init();
    try {
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
          $setOnInsert: {
            versionId,
            courseId,
            watermark: null,
            lastRefreshedAt: null,
            firstBuildCompletedAt: null,
            status: 'idle',
          },
        },
        {upsert: true, returnDocument: 'after'},
      );
      return res?.leaseOwner === owner;
    } catch (err: any) {
      // The upsert races with an existing, still-leased row: someone else has it.
      if (err?.code === 11000) return false;
      throw err;
    }
  }

  async releaseLease(
    versionId: string,
    owner: string,
    update: Partial<CaState> = {},
  ): Promise<void> {
    await this.init();
    await this.state.updateOne(
      {versionId, leaseOwner: owner},
      {$set: {...update, leaseOwner: null, leaseUntil: null}},
    );
  }

  async setStatus(versionId: string, update: Partial<CaState>): Promise<void> {
    await this.init();
    await this.state.updateOne({versionId}, {$set: update});
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

  async getLearnerCurrentState(
    versionId: string,
  ): Promise<
    {userId: string; currentItemId: string | null; percent: number}[]
  > {
    await this.init();
    return this.learners
      .find(
        {versionId},
        {projection: {_id: 0, userId: 1, currentItemId: 1, percent: 1}},
      )
      .toArray() as any;
  }

  /** Days currently stored for these learners (used to find affected days). */
  async getLearnerDayKeys(
    versionId: string,
    userIds: string[],
  ): Promise<string[]> {
    await this.init();
    return this.learnerDays.distinct('day', {
      versionId,
      userId: {$in: userIds},
    });
  }

  /** Replaces every tier-1/2 row of the given learners with the new ones. */
  async replaceLearners(
    versionId: string,
    userIds: string[],
    rows: {
      learners: CaLearner[];
      quizzes: CaLearnerQuiz[];
      videos: CaLearnerVideo[];
      days: CaLearnerDay[];
    },
  ): Promise<void> {
    await this.init();
    if (!userIds.length) return;
    const filter = {versionId, userId: {$in: userIds}};
    await Promise.all([
      this.learners.deleteMany(filter),
      this.learnerQuizzes.deleteMany(filter),
      this.learnerVideos.deleteMany(filter),
      this.learnerDays.deleteMany(filter),
    ]);
    const insert = async <T>(col: Collection<any>, docs: T[]) => {
      if (docs.length) await col.insertMany(docs as any[], {ordered: false});
    };
    await Promise.all([
      insert(this.learners, rows.learners),
      insert(this.learnerQuizzes, rows.quizzes),
      insert(this.learnerVideos, rows.videos),
      insert(this.learnerDays, rows.days),
    ]);
  }

  async deleteLearners(versionId: string, userIds: string[]): Promise<void> {
    await this.replaceLearners(versionId, userIds, {
      learners: [],
      quizzes: [],
      videos: [],
      days: [],
    });
  }

  // ------------------------------------------------------------ tier 3

  /**
   * Recomputes ca_course_daily and ca_course_heatmap for the given days (all
   * days when `days` is null) from ca_learner_days.
   */
  async aggregateDays(versionId: string, days: string[] | null): Promise<void> {
    await this.init();
    const match: any = {versionId};
    if (days) match.day = {$in: days};
    const hourSums: Record<string, unknown> = {};
    for (let h = 0; h < 24; h++)
      hourSums[`h${h}`] = {$sum: {$arrayElemAt: ['$secondsByHour', h]}};
    const rows = await this.learnerDays
      .aggregate<any>([
        {$match: match},
        {
          $group: {
            _id: '$day',
            activeLearners: {$sum: {$cond: ['$active', 1, 0]}},
            learningSeconds: {$sum: '$learningSeconds'},
            newEnrolments: {$sum: {$cond: ['$enrolled', 1, 0]}},
            incidents: {$push: '$incidentsByType'},
            ...hourSums,
          },
        },
      ])
      .toArray();

    if (days) {
      await Promise.all([
        this.courseDaily.deleteMany({versionId, day: {$in: days}}),
        this.courseHeatmap.deleteMany({versionId, day: {$in: days}}),
      ]);
    } else {
      await Promise.all([
        this.courseDaily.deleteMany({versionId}),
        this.courseHeatmap.deleteMany({versionId}),
      ]);
    }
    if (!rows.length) return;
    const daily: CaCourseDaily[] = [];
    const heat: CaCourseHeatmapDay[] = [];
    for (const r of rows) {
      const incidentsByType: Record<string, number> = {};
      for (const obj of r.incidents as Record<string, number>[]) {
        for (const [k, v] of Object.entries(obj ?? {}))
          incidentsByType[k] = (incidentsByType[k] ?? 0) + v;
      }
      daily.push({
        versionId,
        day: r._id,
        activeLearners: r.activeLearners,
        learningSeconds: r.learningSeconds,
        newEnrolments: r.newEnrolments,
        incidentsByType,
      });
      heat.push({
        versionId,
        day: r._id,
        secondsByHour: Array.from({length: 24}, (_, h) => r[`h${h}`] ?? 0),
      });
    }
    await this.courseDaily.insertMany(daily);
    await this.courseHeatmap.insertMany(heat);
  }

  /** Distinct learners with an active day / an incident in [fromDay, toDay]. */
  async distinctLearnersBetween(
    versionId: string,
    fromDay: string,
    toDay: string,
    kind: 'active' | 'incident',
  ): Promise<number> {
    await this.init();
    const match: any = {versionId, day: {$gte: fromDay, $lte: toDay}};
    if (kind === 'active') match.active = true;
    else match['incidentsByType'] = {$nin: [{}, null]};
    const [row] = await this.learnerDays
      .aggregate<{
        n: number;
      }>([{$match: match}, {$group: {_id: '$userId'}}, {$count: 'n'}])
      .toArray();
    return row?.n ?? 0;
  }

  async learningSecondsBetween(
    versionId: string,
    fromDay: string,
    toDay: string,
  ): Promise<{seconds: number; days: number}> {
    await this.init();
    const [row] = await this.courseDaily
      .aggregate<{seconds: number; days: number}>([
        {$match: {versionId, day: {$gte: fromDay, $lte: toDay}}},
        {
          $group: {
            _id: null,
            seconds: {$sum: '$learningSeconds'},
            days: {$sum: 1},
          },
        },
      ])
      .toArray();
    return {seconds: row?.seconds ?? 0, days: row?.days ?? 0};
  }

  async quizAggregates(versionId: string) {
    await this.init();
    const perQuiz = await this.learnerQuizzes
      .aggregate<any>([
        {$match: {versionId}},
        {
          $group: {
            _id: '$quizId',
            attempted: {$sum: 1},
            firstPassed: {$sum: {$cond: ['$firstAttemptPassed', 1, 0]}},
            avgAttemptsToPass: {$avg: '$attemptsToPass'},
            scores: {$push: '$firstAttemptScorePct'},
          },
        },
      ])
      .toArray();
    const perQuestion = await this.learnerQuizzes
      .aggregate<any>([
        {$match: {versionId}},
        {$unwind: '$firstAttemptQuestions'},
        {
          $group: {
            _id: {
              quizId: '$quizId',
              questionId: '$firstAttemptQuestions.questionId',
            },
            answered: {$sum: 1},
            correct: {$sum: {$cond: ['$firstAttemptQuestions.correct', 1, 0]}},
          },
        },
      ])
      .toArray();
    return {perQuiz, perQuestion};
  }

  async videoAggregates(versionId: string) {
    await this.init();
    const perVideo = await this.learnerVideos
      .aggregate<any>([
        {$match: {versionId}},
        {
          $group: {
            _id: '$itemId',
            started: {$sum: {$cond: ['$started', 1, 0]}},
            completed: {$sum: {$cond: ['$completed', 1, 0]}},
          },
        },
      ])
      .toArray();
    const perSegment = await this.learnerVideos
      .aggregate<any>([
        {$match: {versionId}},
        {$project: {itemId: 1, segs: {$objectToArray: '$rewindSegments'}}},
        {$unwind: '$segs'},
        {
          $group: {
            _id: {itemId: '$itemId', seg: '$segs.k'},
            rewinds: {$sum: '$segs.v'},
          },
        },
      ])
      .toArray();
    return {perVideo, perSegment};
  }

  async replaceItemStats(
    versionId: string,
    rows: CaItemStats[],
  ): Promise<void> {
    await this.init();
    await this.itemStats.deleteMany({versionId});
    if (rows.length) await this.itemStats.insertMany(rows);
  }

  async replaceSnapshot(snapshot: CaCourseSnapshot): Promise<void> {
    await this.init();
    await this.snapshots.replaceOne({versionId: snapshot.versionId}, snapshot, {
      upsert: true,
    });
  }

  // -------------------------------------------------------------- reads

  async getSnapshot(versionId: string): Promise<CaCourseSnapshot | null> {
    await this.init();
    return this.snapshots.findOne({versionId}, {projection: {_id: 0}});
  }

  async getItemStats(versionId: string): Promise<CaItemStats[]> {
    await this.init();
    return this.itemStats
      .find({versionId}, {projection: {_id: 0}})
      .sort({order: 1})
      .toArray();
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
