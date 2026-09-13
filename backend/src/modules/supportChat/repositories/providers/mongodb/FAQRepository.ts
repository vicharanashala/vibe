import { inject, injectable } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import { IFAQ, SUPPORT_CHAT_CONFIG, FAQCategory } from '../../../types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';

@injectable()
export class FAQRepository {
  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async getCollection(): Promise<Collection<IFAQ>> {
    return this.db.getCollection<IFAQ>(SUPPORT_CHAT_CONFIG.collectionsNames.faq);
  }

  async create(faq: Omit<IFAQ, '_id' | 'createdAt' | 'updatedAt'>): Promise<IFAQ> {
    const collection = await this.getCollection();
    const now = new Date();
    const document = {
      ...faq,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(document);

    return {
      ...document,
      _id: result.insertedId,
    } as IFAQ;
  }

  async findById(id: ObjectId): Promise<IFAQ | null> {
    const collection = await this.getCollection();
    return collection.findOne({ _id: id });
  }

  async findAll(filters?: { isActive?: boolean; category?: FAQCategory }): Promise<IFAQ[]> {
    const collection = await this.getCollection();
    const query: any = {};

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    if (filters?.category) {
      query.category = filters.category;
    }

    return collection.find(query).toArray();
  }

  async updateById(id: ObjectId, updates: Partial<IFAQ>): Promise<IFAQ | null> {
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

    return result as IFAQ | null;
  }

  /**
   * Persists a generated embedding so it is computed once per FAQ rather than
   * on every retrieval. Seeded FAQs arrive without one; the retrieval service
   * backfills them lazily through here.
   */
  async setEmbedding(id: ObjectId, embedding: number[]): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne({ _id: id }, { $set: { embedding } });
  }

  async incrementUsageCount(id: ObjectId): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne({ _id: id }, { $inc: { usageCount: 1 } });
  }

  async deleteById(id: ObjectId): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async search(query: string, limit: number = 10): Promise<IFAQ[]> {
    const collection = await this.getCollection();
    return collection
      .find({
        isActive: true,
        $text: { $search: query },
      })
      .limit(limit)
      .toArray();
  }

  async findByCategory(category: FAQCategory): Promise<IFAQ[]> {
    const collection = await this.getCollection();
    return collection.find({ category, isActive: true }).toArray();
  }

  async findByTag(tag: string): Promise<IFAQ[]> {
    const collection = await this.getCollection();
    return collection.find({ tags: tag, isActive: true }).toArray();
  }

  async findRelated(faqId: ObjectId): Promise<IFAQ[]> {
    const collection = await this.getCollection();
    const faq = await this.findById(faqId);
    if (!faq?.relatedFaqIds || faq.relatedFaqIds.length === 0) {
      return [];
    }

    return collection
      .find({
        _id: { $in: faq.relatedFaqIds },
        isActive: true,
      })
      .toArray();
  }

  async createIndex(): Promise<void> {
    const collection = await this.getCollection();
    await collection.createIndex({ category: 1, isActive: 1 });
    await collection.createIndex({ tags: 1 });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ question: 'text', answer: 'text' });
  }
}
