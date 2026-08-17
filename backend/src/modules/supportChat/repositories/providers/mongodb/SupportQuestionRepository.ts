import { inject, injectable } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import {
  ISupportEscalation,
  ISupportQuestion,
  SUPPORT_CHAT_CONFIG,
  SupportQuestionStatus,
  ResolutionRating,
} from '../../../types.js';

/**
 * Scope for the admin-facing queries. `courseIds` of `undefined` means
 * unrestricted (admins); an empty array means "no courses in reach", which must
 * match nothing rather than everything.
 */
export interface SupportQuestionQuery {
  statuses?: SupportQuestionStatus[];
  courseIds?: ObjectId[];
  limit?: number;
}
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';

@injectable()
export class SupportQuestionRepository {
  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async getCollection(): Promise<Collection<ISupportQuestion>> {
    return this.db.getCollection<ISupportQuestion>(
      SUPPORT_CHAT_CONFIG.collectionsNames.questions,
    );
  }

  async create(question: Omit<ISupportQuestion, '_id' | 'createdAt' | 'updatedAt'>): Promise<ISupportQuestion> {
    const collection = await this.getCollection();
    const now = new Date();
    const document = {
      ...question,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(document);

    return {
      ...document,
      _id: result.insertedId,
    } as ISupportQuestion;
  }

  async findById(id: ObjectId): Promise<ISupportQuestion | null> {
    const collection = await this.getCollection();
    return collection.findOne({ _id: id });
  }

  async findByUserId(userId: ObjectId, limit: number = 50): Promise<ISupportQuestion[]> {
    const collection = await this.getCollection();
    return collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * The one query the admin dashboard runs. Statuses and course scope are both
   * optional, but an empty `courseIds` is honoured as a real restriction — an
   * instructor who teaches nothing must not fall through to every question.
   */
  async findForAdmin(query: SupportQuestionQuery = {}): Promise<ISupportQuestion[]> {
    const collection = await this.getCollection();
    const filter = this.buildAdminFilter(query);

    return collection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 50)
      .toArray();
  }

  private buildAdminFilter(query: Pick<SupportQuestionQuery, 'statuses' | 'courseIds'>) {
    const filter: Record<string, unknown> = {};

    if (query.statuses?.length) {
      filter.status = { $in: query.statuses };
    }
    if (query.courseIds) {
      filter.courseId = { $in: query.courseIds };
    }

    return filter;
  }

  async updateById(id: ObjectId, updates: Partial<ISupportQuestion>): Promise<ISupportQuestion | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return result as ISupportQuestion | null;
  }

  async updateStatus(id: ObjectId, status: SupportQuestionStatus): Promise<ISupportQuestion | null> {
    return this.updateById(id, { status });
  }

  async setAdminResponse(
    id: ObjectId,
    response: string,
    respondedByUserId: ObjectId
  ): Promise<ISupportQuestion | null> {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          adminResponse: {
            respondedBy: respondedByUserId,
            response,
            responseAt: new Date(),
          },
          status: SupportQuestionStatus.ANSWERED,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return result as ISupportQuestion | null;
  }

  async setFaqMatch(id: ObjectId, faqId: ObjectId, confidence: number): Promise<ISupportQuestion | null> {
    return this.updateById(id, {
      matchedFaqId: faqId,
      confidenceScore: confidence,
      status: SupportQuestionStatus.ANSWERED,
    });
  }

  async setEscalation(
    id: ObjectId,
    escalation: ISupportEscalation
  ): Promise<ISupportQuestion | null> {
    return this.updateById(id, {
      escalation,
      status: SupportQuestionStatus.ESCALATED,
    });
  }

  async linkFaqCreated(id: ObjectId, faqId: ObjectId): Promise<ISupportQuestion | null> {
    return this.updateById(id, { faqCreatedFromThis: faqId });
  }

  async setResolutionRating(id: ObjectId, rating: 'helpful' | 'not_helpful'): Promise<ISupportQuestion | null> {
    const resolutionRating =
      rating === 'helpful' ? ResolutionRating.HELPFUL : ResolutionRating.NOT_HELPFUL;
    return this.updateById(id, { resolutionRating });
  }

  async markAsSeenByLearner(id: ObjectId): Promise<ISupportQuestion | null> {
    return this.updateById(id, { learnersSeenResponse: true });
  }

  async getStats(
    query: { courseIds?: ObjectId[]; startDate?: Date; endDate?: Date } = {}
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    avgResolutionTime: number;
  }> {
    const collection = await this.getCollection();
    const { courseIds, startDate, endDate } = query;

    const matchStage: any = this.buildAdminFilter({ courseIds });
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const stats = await collection
      .aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', SupportQuestionStatus.PENDING] }, 1, 0] },
            },
            answered: {
              $sum: { $cond: [{ $eq: ['$status', SupportQuestionStatus.ANSWERED] }, 1, 0] },
            },
            resolved: {
              $sum: { $cond: [{ $eq: ['$status', SupportQuestionStatus.RESOLVED] }, 1, 0] },
            },
            escalated: {
              $sum: { $cond: [{ $eq: ['$status', SupportQuestionStatus.ESCALATED] }, 1, 0] },
            },
            avgResolutionTime: {
              $avg: {
                $cond: [
                  { $ne: ['$adminResponse', null] },
                  {
                    $subtract: ['$adminResponse.responseAt', '$createdAt'],
                  },
                  null,
                ],
              },
            },
          },
        },
      ])
      .toArray();

    if (stats.length === 0) {
      return {
        total: 0,
        byStatus: {
          [SupportQuestionStatus.PENDING]: 0,
          [SupportQuestionStatus.ANSWERED]: 0,
          [SupportQuestionStatus.RESOLVED]: 0,
          [SupportQuestionStatus.ESCALATED]: 0,
        },
        avgResolutionTime: 0,
      };
    }

    const result = stats[0];
    return {
      total: result.total,
      byStatus: {
        [SupportQuestionStatus.PENDING]: result.pending,
        [SupportQuestionStatus.ANSWERED]: result.answered,
        [SupportQuestionStatus.RESOLVED]: result.resolved,
        [SupportQuestionStatus.ESCALATED]: result.escalated,
      },
      avgResolutionTime: Math.floor(result.avgResolutionTime / (1000 * 60)) || 0,
    };
  }

  async createIndex(): Promise<void> {
    const collection = await this.getCollection();
    await collection.createIndex({ userId: 1, createdAt: -1 });
    await collection.createIndex({ status: 1, createdAt: -1 });
    await collection.createIndex({ courseId: 1, status: 1 });
    await collection.createIndex({ createdAt: -1 });
  }
}
