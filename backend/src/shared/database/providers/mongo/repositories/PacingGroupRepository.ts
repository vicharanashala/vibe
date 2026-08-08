import 'reflect-metadata';
import { Collection, ObjectId, ClientSession } from 'mongodb';
import { injectable, inject } from 'inversify';
import { MongoDatabase } from '../MongoDatabase.js';
import { IPacingGroup } from '#shared/interfaces/models.js';
import { IPacingGroupRepository } from '#shared/database/interfaces/IPacingGroupRepository.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { InternalServerError } from 'routing-controllers';

@injectable()
export class PacingGroupRepository implements IPacingGroupRepository {
  private pacingGroupCollection!: Collection<IPacingGroup>;
  private initialized = false;

  constructor(
    @inject(GLOBAL_TYPES.Database) private db: MongoDatabase,
  ) { }

  private async init() {
    if (!this.initialized) {
      this.pacingGroupCollection = await this.db.getCollection<IPacingGroup>('pacingGroups');
      this.initialized = true;

      // Index to search by userId quickly
      await this.pacingGroupCollection.createIndex({ userId: 1 });
    }
  }

  async getByUserId(
    userId: string | ObjectId,
    session?: ClientSession,
  ): Promise<IPacingGroup | null> {
    await this.init();
    try {
      return await this.pacingGroupCollection.findOne(
        { userId: new ObjectId(userId) },
        { session },
      );
    } catch (error) {
      console.error('Error finding pacing group by userId:', error);
      throw new InternalServerError(`Failed to find pacing group: ${error.message}`);
    }
  }

  async upsertForUser(
    userId: string | ObjectId,
    targetCompletionDate: Date,
    courseSelections: Array<{
      courseId: string | ObjectId;
      courseVersionId: string | ObjectId;
      cohortId?: string | ObjectId;
    }>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    try {
      const now = new Date();
      await this.pacingGroupCollection.updateOne(
        { userId: new ObjectId(userId) },
        {
          $set: {
            targetCompletionDate: new Date(targetCompletionDate),
            courseSelections: courseSelections.map(selection => ({
              courseId: new ObjectId(selection.courseId),
              courseVersionId: new ObjectId(selection.courseVersionId),
              cohortId: selection.cohortId ? new ObjectId(selection.cohortId) : undefined,
            })),
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true, session },
      );
    } catch (error) {
      console.error('Error upserting pacing group for user:', error);
      throw new InternalServerError(`Failed to upsert pacing group: ${error.message}`);
    }
  }

  async clearForUser(
    userId: string | ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    try {
      await this.pacingGroupCollection.deleteOne(
        { userId: new ObjectId(userId) },
        { session },
      );
    } catch (error) {
      console.error('Error clearing pacing group for user:', error);
      throw new InternalServerError(`Failed to clear pacing group: ${error.message}`);
    }
  }
}
