import { injectable, inject } from 'inversify';
import { Collection, ClientSession, ObjectId } from 'mongodb';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IAnomalyData } from '#root/modules/anomalies/index.js';

@injectable()
export class AnomalyRepository {
  private anomalyCollection: Collection<IAnomalyData>;

  constructor(
    @inject(GLOBAL_TYPES.Database) private database: MongoDatabase
  ) {}

  private async init(): Promise<void> {
    if (!this.anomalyCollection) {
      this.anomalyCollection = await this.database.getCollection<IAnomalyData>('anomaly_records');
    }
  }

  async createAnomaly(anomaly: IAnomalyData, session?: ClientSession): Promise<IAnomalyData> {
    await this.init();

    const result = await this.anomalyCollection.insertOne(anomaly, { session });
    if (!result.acknowledged) {
      return null;
    }
    
    return { ...anomaly, _id: result.insertedId };
  }

  async getByUser(
    userId: string, 
    courseId: string, 
    versionId: string,
    limit: number,
    skip: number,
    session?: ClientSession
  ): Promise<IAnomalyData[]> {
    await this.init();
    const result = await this.anomalyCollection
      .find({ userId: userId, courseId: courseId, versionId: versionId }, { session })
      .limit(limit)
      .skip(skip)
      .toArray();
    return result;
  }

   async getAllByUser(
    userId: string, 
    courseId: string, 
    versionId: string,
    session?: ClientSession
  ): Promise<IAnomalyData[]> {
    await this.init();
    const result = await this.anomalyCollection
      .find({ userId: userId, courseId: courseId, versionId: versionId }, { session })
      .toArray();
    return result;
  }

  async getById(anomalyId: string, courseId: string, versionId: string, session?: ClientSession): Promise<IAnomalyData | null> {
    await this.init();
    return await this.anomalyCollection.findOne({ _id: new ObjectId(anomalyId), courseId: courseId, versionId: versionId }, { session });
  }

  async getAnomaliesByCourse(
    courseId: string,
    versionId: string,
    limit: number,
    skip: number,
    sortOptions?: { field: string; order: 'asc' | 'desc' },
    session?: ClientSession
  ): Promise<{ data: IAnomalyData[]; total: number }> {
    await this.init();
    
    const sort: { [key: string]: 1 | -1 } = {};
    if (sortOptions?.field) {
      sort[sortOptions.field] = sortOptions.order === 'asc' ? 1 : -1;
    } else {
      sort['createdAt'] = -1;
    }

    const [data, total] = await Promise.all([
      this.anomalyCollection
        .find({ courseId, versionId }, { session })
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .toArray(),
      this.anomalyCollection.countDocuments({ courseId, versionId }, { session })
    ]);

    return { data, total };
  }


  async getAnomaliesByItem(
    courseId: string,
    versionId: string,
    itemId: string,
    limit: number,
    skip: number,
    session?: ClientSession
  ): Promise<IAnomalyData[]> {
    await this.init();
    return await this.anomalyCollection
      .find({ courseId: courseId, versionId: versionId, itemId: itemId }, { session })
      .limit(limit)
      .skip(skip)
      .toArray();
  }

  async getCustomAnomalies(
    courseId: string,
    versionId: string,
    itemId?: string,
    userId?: string,
    session?: ClientSession
  ): Promise<IAnomalyData[]> {
    await this.init();
    // optionally filter by itemId and userId
    const query: any = { courseId: courseId, versionId: versionId };
    if (itemId) {
      query.itemId = itemId;
    }
    if (userId) {
      query.userId = userId;
    }
    return await this.anomalyCollection
      .find(query, { session })
      .toArray();
  }

  async deleteAnomaly(anomalyId: string, courseId: string, versionId: string, session?: ClientSession): Promise<boolean> {
    await this.init();
    const result = await this.anomalyCollection.deleteOne(
      { _id: new ObjectId(anomalyId), courseId: courseId, versionId: versionId },
      { session }
    );
    return result.deletedCount > 0;
  }

  async deleteAnomalysByUser(userId: string, courseId: string, versionId: string, session?: ClientSession): Promise<boolean> {
    await this.init();
    const result = await this.anomalyCollection.deleteMany(
      { userId: userId, courseId: courseId, versionId: versionId },
      { session }
    );
    return result.deletedCount > 0;
  }

  async deleteAnomalyByCourse(courseId: string, versionId: string, session?: ClientSession): Promise<boolean> {
    await this.init();

    const result = await this.anomalyCollection.deleteMany(
      { courseId: courseId, versionId: versionId },
      { session }
    );
    return result.deletedCount > 0;
  }
}