import { inject, injectable } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import { ISupportQuestion, SUPPORT_CHAT_CONFIG, SupportQuestionStatus, ResolutionRating } from '../../../types.js';
import { GLOBAL_TYPES } from '#root/types.js';

@injectable()
export class SupportQuestionRepository {
  constructor(@inject(GLOBAL_TYPES.Database) private db: any) {}

  private getCollection(): Collection<ISupportQuestion> {
    return this.db.collection(SUPPORT_CHAT_CONFIG.collectionsNames.questions);
  }

  async create(question: Omit<ISupportQuestion, '_id' | 'createdAt' | 'updatedAt'>): Promise<ISupportQuestion> {
    const collection = this.getCollection();
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
    const collection = this.getCollection();
    return collection.findOne({ _id: id });
  }

  async findByUserId(userId: ObjectId, limit: number = 50): Promise<ISupportQuestion[]> {
    const collection = this.getCollection();
    return collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async findByCourseId(courseId: ObjectId, filters?: { status?: SupportQuestionStatus }): Promise<ISupportQuestion[]> {
    const collection = this.getCollection();
    const query: any = { courseId };

    if (filters?.status) {
      query.status = filters.status;
    }

    return collection.find(query).sort({ createdAt: -1 }).toArray();
  }

  async findByStatus(status: SupportQuestionStatus, limit: number = 50): Promise<ISupportQuestion[]> {
    const collection = this.getCollection();
    return collection
      .find({ status })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async findPending(limit: number = 50): Promise<ISupportQuestion[]> {
    return this.findByStatus(SupportQuestionStatus.PENDING, limit);
  }

  async updateById(id: ObjectId, updates: Partial<ISupportQuestion>): Promise<ISupportQuestion | null> {
    const collection = this.getCollection();
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
    const collection = this.getCollection();
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

  async getStats(courseId?: ObjectId, startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byStatus: Record<string, number>;
    avgResolutionTime: number;
  }> {
    const collection = this.getCollection();

    const matchStage: any = {};
    if (courseId) {
      matchStage.courseId = courseId;
    }
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
      },
      avgResolutionTime: Math.floor(result.avgResolutionTime / (1000 * 60)) || 0,
    };
  }

  async createIndex(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ userId: 1, createdAt: -1 });
    await collection.createIndex({ status: 1, createdAt: -1 });
    await collection.createIndex({ courseId: 1, status: 1 });
    await collection.createIndex({ createdAt: -1 });
  }
}
