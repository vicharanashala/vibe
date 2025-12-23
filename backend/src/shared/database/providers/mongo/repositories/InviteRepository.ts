import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {ClientSession, Collection, MongoClient, ObjectId} from 'mongodb';
import {MongoDatabase} from '../MongoDatabase.js';
import {InternalServerError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
import {Invite} from '#root/modules/notifications/index.js';
import {InviteType} from '#root/shared/interfaces/models.js';

import {writeFile} from 'fs/promises';
import path from 'path';
@injectable()
export class InviteRepository {
  private inviteCollection: Collection<Invite>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    this.inviteCollection = await this.db.getCollection<Invite>('invites');

    this.inviteCollection.createIndex({email: 1, inviteStatus: 1});
    this.inviteCollection.createIndex({
      courseId: 1,
      courseVersionId: 1,
      createdAt: -1,
    });
    this.inviteCollection.createIndex({courseVersionId: 1});
  }

  async getDBClient(): Promise<MongoClient> {
    const client = await this.db.getClient();
    if (!client) {
      throw new Error('MongoDB client is not initialized');
    }
    return client;
  }

  async create(invite: Invite, session?: ClientSession): Promise<string> {
    await this.init();
    try {
      if (invite.type === InviteType.BULK) {
        invite.usedCount = 0;
      }
      const result = await this.inviteCollection.insertOne(invite, {session});
      const invitee = await this.inviteCollection.findOne({
        _id: result.insertedId,
      });
      return result.insertedId.toString();
    } catch {
      throw new InternalServerError('Failed to create invite');
    }
  }

  async incrementUsedCount(
    inviteId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    // const result = await this.inviteCollection.updateOne(
    //   {_id: new ObjectId(inviteId)},{$inc:{usedCount:1}},{session})
  }

  async all() {
    return this.inviteCollection.find();
  }

  async findInviteById(
    id: string,
    session?: ClientSession,
  ): Promise<Invite | null> {
    await this.init(); // Ensure collection is initialized
    const invite = await this.inviteCollection.findOne(
      {_id: new ObjectId(id)},
      {session},
    );
    if (!invite) return null;

    return {
      ...invite,
      courseId: invite.courseId?.toString(),
      courseVersionId: invite.courseVersionId?.toString(),
      usedCount: invite.usedCount || 0,
    };
  }

  async findInvitesByIds(
    ids: string[],
    session?: ClientSession,
  ): Promise<Invite[]> {
    await this.init(); // Ensure collection is initialized

    if (!ids || ids.length === 0) {
      return [];
    }

    const objectIds = ids.map(id => new ObjectId(id));
    const invites = await this.inviteCollection
      .find({_id: {$in: objectIds}}, {session})
      .toArray();

    return invites.map(invite => ({
      ...invite,
      courseId: invite.courseId?.toString(),
      courseVersionId: invite.courseVersionId?.toString(),
    }));
  }

  async updateInvite(
    inviteId: string,
    inviteData: Partial<Invite>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();

    const result = await this.inviteCollection.updateOne(
      {_id: new ObjectId(inviteId)},
      {$set: inviteData},
      {session},
    );

    if (result.matchedCount === 0) {
      throw new Error(`Failed to update invite with ID: ${inviteId}`);
    }
  }

  async findInvitesByEmail(
    email: string,
    session?: ClientSession,
  ): Promise<Invite[]> {
    await this.init(); // Ensure collection is initialized

    const invites = await this.inviteCollection
      .find({email}, {session})
      .toArray();

    return invites.map(invite => ({
      ...invite,
      _id: invite._id.toString(),
      courseId: invite.courseId?.toString(),
      courseVersionId: invite.courseVersionId?.toString(),
    }));
  }

  async findPendingInvitesByEmail(
    email: string,
    session?: ClientSession,
  ): Promise<Invite[]> {
    await this.init(); // Ensure collection is initialized

    const invites = await this.inviteCollection
      .find({email, inviteStatus: 'PENDING'}, {session})
      .toArray();

    return invites.map(invite => ({
      ...invite,
      _id: invite._id.toString(),
      courseId: invite.courseId?.toString(),
      courseVersionId: invite.courseVersionId?.toString(),
    }));
  }

  async findInvitesByCourse(
    courseId: string,
    courseVersionId: string,
    inviteStatus: string,
    currentPage: number,
    limit: number,
    search: string,
    sort: string,
    startDate?: string,
    endDate?: string,
    session?: ClientSession,
  ): Promise<{invites: Invite[]; totalDocuments: number; totalPages: number}> {
    await this.init();

    const courseIdObj = ObjectId.isValid(courseId)
      ? new ObjectId(courseId)
      : null;
    const courseVersionIdObj = ObjectId.isValid(courseVersionId)
      ? new ObjectId(courseVersionId)
      : null;

    const filter: any = {
      courseId: {$in: [courseId, ...(courseIdObj ? [courseIdObj] : [])]},
      courseVersionId: {
        $in: [
          courseVersionId,
          ...(courseVersionIdObj ? [courseVersionIdObj] : []),
        ],
      },
    };
    // const filter: any = {courseId, courseVersionId};

    if (inviteStatus) {
      filter.inviteStatus = inviteStatus;
    }

    if (search) {
      filter.email = {$regex: search, $options: 'i'};
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const startDateTime = new Date(startDate);
        startDateTime.setUTCHours(0, 0, 0, 0);
        filter.createdAt.$gte = startDateTime;
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setUTCHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateTime;
      }
    }

    const sortStage: Record<string, 1 | -1> = (() => {
      switch (sort) {
        case 'accept_date_desc':
          return {acceptedAt: -1};
        case 'accept_date_asc':
          return {acceptedAt: 1};
        default:
          return {createdAt: -1};
      }
    })();

    const skip = (currentPage - 1) * limit;

    const [invites, totalDocuments] = await Promise.all([
      this.inviteCollection
        .find(filter, {session})
        .sort(sortStage)
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.inviteCollection.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalDocuments / limit);

    const normalizedInvites = invites.map(invite => ({
      ...invite,
      courseId: invite.courseId?.toString(),
      courseVersionId: invite.courseVersionId?.toString(),
    }));

    return {invites: normalizedInvites, totalDocuments, totalPages};
  }

  async deleteInviteByVersionId(versionId: string, session?: ClientSession) {
    await this.init();
    await this.inviteCollection.deleteMany(
      {courseVersionId: new ObjectId(versionId)},
      {session},
    );
  }

  async removePendingInvite() {
    await this.init();
    const courseId = new ObjectId('6943b2cafa4e840eb39490b6');

    const result = await this.inviteCollection
      .aggregate([
        {$match: {courseId}},

        // Lookup user by email
        {
          $lookup: {
            from: 'users',
            localField: 'email',
            foreignField: 'email',
            as: 'user',
          },
        },

        // Take first user if exists
        {
          $addFields: {
            user: {$arrayElemAt: ['$user', 0]},
          },
        },

        // Lookup enrollment
        {
          $lookup: {
            from: 'enrollment',
            let: {userId: '$user._id'},
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {$eq: ['$userId', '$$userId']},
                      {$eq: ['$courseId', courseId]},
                    ],
                  },
                },
              },
              {$project: {_id: 1}},
            ],
            as: 'enrollment',
          },
        },

        // Project fields
        {
          $project: {
            email: 1,
            isEnrolled: {$gt: [{$size: '$enrollment'}, 0]},
            enrollmentId: {
              $cond: [
                {$gt: [{$size: '$enrollment'}, 0]},
                {$toString: {$arrayElemAt: ['$enrollment._id', 0]}},
                null,
              ],
            },
          },
        },

        // Group into enrolled/notEnrolled using conditional $addToSet
        {
          $group: {
            _id: null,
            enrolled: {
              $addToSet: {
                $cond: [
                  '$isEnrolled',
                  {email: '$email', enrollmentId: '$enrollmentId'},
                  '$$REMOVE',
                ],
              },
            },
            notEnrolled: {
              $addToSet: {
                $cond: [{$not: '$isEnrolled'}, {email: '$email'}, '$$REMOVE'],
              },
            },
          },
        },

        // Project totals
        {
          $project: {
            _id: 0,
            enrolled: 1,
            notEnrolled: 1,
            totalInvites: {
              $add: [{$size: '$enrolled'}, {$size: '$notEnrolled'}],
            },
            enrolledCount: {$size: '$enrolled'},
            notEnrolledCount: {$size: '$notEnrolled'},
          },
        },
      ])
      .toArray();

    const data = result[0];
    const filePath = 'invite_report.txt';

    // Build readable text
    let text = '';
    text += `Total Invites: ${data.totalInvites}\n`;
    text += `Enrolled Count: ${data.enrolledCount}\n`;
    text += `Not Enrolled Count: ${data.notEnrolledCount}\n\n`;

    text += 'Not Enrolled Users:\n';
    data.notEnrolled.forEach((u: any, index: number) => {
      text += `${index + 1}. ${u.email}\n`;
    });

    text += '\nEnrolled Users:\n';
    data.enrolled.forEach((u: any, index: number) => {
      text += `${index + 1}. ${u.email} | Enrollment ID: ${u.enrollmentId}\n`;
    });

    // Write to file asynchronously
    await writeFile(filePath, text, 'utf8');

    console.log(`Invite report written to ${filePath}`);
    return data;
  }

  // async removePendingInvite() {
  //   await this.init();

  //   const duplicates = await this.inviteCollection
  //     .aggregate([
  //       {$match: {courseId: new ObjectId('6943b2cafa4e840eb39490b6')}},
  //       {
  //         $group: {
  //           _id: '$email',
  //           ids: {$push: '$_id'},
  //           count: {$sum: 1},
  //         },
  //       },
  //       {
  //         $match: {
  //           count: {$gt: 1},
  //         },
  //       },
  //     ])
  //     .toArray();

  //   // console.log('duplicates: ', duplicates.length);
  //   const idsToDelete = duplicates.flatMap(d => d.ids.slice(1));
  //   // console.log('idsToDelete: ', idsToDelete.length);

  //   if (idsToDelete.length > 0) {
  //     await this.inviteCollection.deleteMany({
  //       _id: {$in: idsToDelete},
  //     });
  //   }
  // }
}
