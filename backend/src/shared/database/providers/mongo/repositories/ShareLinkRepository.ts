import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {ClientSession, Collection, ObjectId} from 'mongodb';
import {MongoDatabase} from '../MongoDatabase.js';
import {InternalServerError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  ICourse,
  IShareLink,
  IUserActivityEvent,
  IWatchTime,
  ShareLinkStatus,
} from '#root/shared/interfaces/models.js';

/**
 * What a single share-link viewer did inside the shared course version.
 */
export interface ShareLinkViewerActivity {
  totalWatchTimeSeconds: number;
  completedItems: number;
  rewinds: number;
  fastForwards: number;
  lastSeenAt?: Date;
}

@injectable()
export class ShareLinkRepository {
  private shareLinkCollection: Collection<IShareLink>;
  private watchTimeCollection: Collection<IWatchTime>;
  private activityEventCollection: Collection<IUserActivityEvent>;
  private courseCollection: Collection<ICourse>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    if (this.initialized) {
      return;
    }
    this.shareLinkCollection =
      await this.db.getCollection<IShareLink>('shareLinks');
    this.watchTimeCollection =
      await this.db.getCollection<IWatchTime>('watchTime');
    this.activityEventCollection =
      await this.db.getCollection<IUserActivityEvent>('user_activity_events');
    this.courseCollection = await this.db.getCollection<ICourse>('newCourse');

    // The token is the only lookup key on the public open path, so it has to be
    // unique and indexed; the rest serve the instructor's dashboard listing.
    await this.shareLinkCollection.createIndex({token: 1}, {unique: true});
    await this.shareLinkCollection.createIndex({
      courseId: 1,
      courseVersionId: 1,
      createdAt: -1,
    });
    await this.shareLinkCollection.createIndex({guestUserId: 1});

    this.initialized = true;
  }

  async createMany(
    shareLinks: IShareLink[],
    session?: ClientSession,
  ): Promise<string[]> {
    await this.init();
    if (shareLinks.length === 0) {
      return [];
    }
    try {
      const result = await this.shareLinkCollection.insertMany(shareLinks, {
        session,
      });
      return Object.values(result.insertedIds).map(id => id.toString());
    } catch {
      throw new InternalServerError('Failed to create share links');
    }
  }

  async findByToken(
    token: string,
    session?: ClientSession,
  ): Promise<IShareLink | null> {
    await this.init();
    return this.shareLinkCollection.findOne({token}, {session});
  }

  async findById(
    id: string,
    session?: ClientSession,
  ): Promise<IShareLink | null> {
    await this.init();
    return this.shareLinkCollection.findOne(
      {_id: new ObjectId(id)} as any,
      {session},
    );
  }

  async findByIds(
    ids: string[],
    session?: ClientSession,
  ): Promise<IShareLink[]> {
    await this.init();
    return this.shareLinkCollection
      .find({_id: {$in: ids.map(id => new ObjectId(id))}} as any, {session})
      .toArray();
  }

  async findByCourseVersion(
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IShareLink[]> {
    await this.init();
    return this.shareLinkCollection
      .find(
        {
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
          ...(cohortId ? {cohortId: new ObjectId(cohortId)} : {}),
        },
        {session},
      )
      .sort({createdAt: -1})
      .toArray();
  }

  async findActiveByRecipient(
    recipientEmail: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IShareLink | null> {
    await this.init();
    return this.shareLinkCollection.findOne(
      {
        recipientEmail,
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        ...(cohortId ? {cohortId: new ObjectId(cohortId)} : {}),
        status: {$in: [ShareLinkStatus.ACTIVE, ShareLinkStatus.OPENED]},
        expiresAt: {$gt: new Date()},
      },
      {session},
    );
  }

  async update(
    id: string,
    changes: Partial<IShareLink>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.shareLinkCollection.updateOne(
      {_id: new ObjectId(id)} as any,
      {$set: changes},
      {session},
    );
  }

  /**
   * Records an open. `guestUserId` is only written the first time, so a
   * forwarded link keeps attributing everything to its original recipient.
   */
  async recordOpen(
    id: string,
    guestUserId: ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const now = new Date();
    await this.shareLinkCollection.updateOne(
      {_id: new ObjectId(id)} as any,
      {
        $set: {
          status: ShareLinkStatus.OPENED,
          lastOpenedAt: now,
        },
        $inc: {openCount: 1},
        // $min on an absent field writes it, so this stamps the first open only.
        $min: {firstOpenedAt: now},
      } as any,
      {session},
    );
    await this.shareLinkCollection.updateOne(
      {_id: new ObjectId(id), guestUserId: {$exists: false}} as any,
      {$set: {guestUserId}},
      {session},
    );
  }

  /**
   * The instructor's hidden holder for videos shared outside any course, if
   * they have one. There is at most one per instructor.
   */
  async findQuickShareContainerCourse(
    instructorId: string,
    session?: ClientSession,
  ): Promise<ICourse | null> {
    await this.init();
    return this.courseCollection.findOne(
      {
        instructors: new ObjectId(instructorId),
        isQuickShareContainer: true,
        isDeleted: {$ne: true},
      } as any,
      {session},
    );
  }

  /** Flags a freshly created course as a quick-share holder. */
  async markCourseAsQuickShareContainer(
    courseId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.courseCollection.updateOne(
      {_id: new ObjectId(courseId)} as any,
      {$set: {isQuickShareContainer: true}},
      {session},
    );
  }

  /**
   * Rolls up what each guest viewer did in the shared course version.
   *
   * Guests record watch time and activity through the same pipelines as any
   * enrolled learner, so this reads the ordinary collections rather than a
   * parallel store — keyed by the guest userId the token was bound to.
   */
  async getViewerActivity(
    guestUserIds: ObjectId[],
    courseId: string,
    courseVersionId: string,
  ): Promise<Map<string, ShareLinkViewerActivity>> {
    await this.init();
    const activity = new Map<string, ShareLinkViewerActivity>();
    if (guestUserIds.length === 0) {
      return activity;
    }

    const scope = {
      userId: {$in: guestUserIds},
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      isDeleted: {$ne: true},
    };

    const watchRows = await this.watchTimeCollection
      .aggregate<{
        _id: ObjectId;
        totalWatchTimeSeconds: number;
        completedItems: ObjectId[];
        lastSeenAt: Date;
      }>([
        {$match: scope},
        {
          $group: {
            _id: '$userId',
            totalWatchTimeSeconds: {
              $sum: {
                $cond: [
                  {$ifNull: ['$endTime', false]},
                  {
                    $divide: [
                      {$subtract: ['$endTime', '$startTime']},
                      1000,
                    ],
                  },
                  0,
                ],
              },
            },
            // A session with an endTime is a finished item, matching how
            // completion is read everywhere else.
            completedItems: {
              $addToSet: {
                $cond: [{$ifNull: ['$endTime', false]}, '$itemId', '$$REMOVE'],
              },
            },
            lastSeenAt: {$max: {$ifNull: ['$endTime', '$startTime']}},
          },
        },
      ])
      .toArray();

    for (const row of watchRows) {
      activity.set(row._id.toString(), {
        totalWatchTimeSeconds: Math.max(
          0,
          Math.round(row.totalWatchTimeSeconds ?? 0),
        ),
        completedItems: row.completedItems?.length ?? 0,
        rewinds: 0,
        fastForwards: 0,
        lastSeenAt: row.lastSeenAt,
      });
    }

    const interactionRows = await this.activityEventCollection
      .aggregate<{_id: ObjectId; rewinds: number; fastForwards: number}>([
        {$match: scope},
        {
          $group: {
            _id: '$userId',
            rewinds: {$sum: {$ifNull: ['$rewinds', 0]}},
            fastForwards: {$sum: {$ifNull: ['$fastForwards', 0]}},
          },
        },
      ])
      .toArray();

    for (const row of interactionRows) {
      const key = row._id.toString();
      const existing = activity.get(key);
      if (existing) {
        existing.rewinds = row.rewinds ?? 0;
        existing.fastForwards = row.fastForwards ?? 0;
      } else {
        activity.set(key, {
          totalWatchTimeSeconds: 0,
          completedItems: 0,
          rewinds: row.rewinds ?? 0,
          fastForwards: row.fastForwards ?? 0,
        });
      }
    }

    return activity;
  }
}
