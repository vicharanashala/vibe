import { injectable, inject } from 'inversify';
import { Collection, ClientSession, ObjectId } from 'mongodb';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { IAnomalyRecord } from '#root/shared/interfaces/models.js';
import { Anomaly } from '../../../classes/transformers/Anomaly.js';
import { GLOBAL_TYPES } from '#root/types.js';

@injectable()
export class AnomalyRepository {
  private collection: Collection<IAnomalyRecord>;

  constructor(
    @inject(GLOBAL_TYPES.Database) private database: MongoDatabase
  ) {}

  private async init(): Promise<void> {
    if (!this.collection) {
      // Use the getCollection method which handles connection automatically
      this.collection = await this.database.getCollection<IAnomalyRecord>('anomaly_records');
      
      // Create indexes for better performance
      await this.collection.createIndex({ userId: 1, timestamp: -1 });
      await this.collection.createIndex({ courseId: 1, timestamp: -1 });
      await this.collection.createIndex({ 'sessionMetadata.sessionId': 1 });
    }
  }

  async createAnomaly(anomaly: Anomaly, session?: ClientSession): Promise<Anomaly> {
    await this.init();
    
    const result = await this.collection.insertOne(anomaly, { session });
    
    return { ...anomaly, _id: result.insertedId };
  }

  async getAnomaliesByUser(userId: string, filters: Record<string, any> = {}): Promise<IAnomalyRecord[]> {
    await this.init();

    const query: Record<string, any> = {
      userId: new ObjectId(userId),
      ...filters,
    };

    return await this.collection
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();
  }

  async getAnomaliesBySession(sessionId: string): Promise<IAnomalyRecord[]> {
    await this.init();
    
    return await this.collection
      .find({ 'sessionMetadata.sessionId': sessionId })
      .sort({ timestamp: -1 })
      .toArray();
  }

  async getAnomaliesByCourse(courseId: string, userId?: string): Promise<IAnomalyRecord[]> {
    await this.init();
    
    const filter: any = { courseId: new ObjectId(courseId) };
    if (userId) {
      filter.userId = new ObjectId(userId);
    }
    
    return await this.collection
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray();
  }

  async getAnomalyStats(userId: string, courseId?: string): Promise<{
    totalAnomalies: number;
    totalPenalty: number;
    anomalyTypes: Record<string, number>;
    last24Hours: number;
    averagePerDay: number;
  }> {
    await this.init();
    
    const filter: any = { userId: new ObjectId(userId) };
    if (courseId) {
      filter.courseId = new ObjectId(courseId);
    }

    const anomalies = await this.collection.find(filter).toArray();
    
    const now = new Date();
    const last24Hours = anomalies.filter(a => 
      (now.getTime() - a.timestamp.getTime()) < 24 * 60 * 60 * 1000
    ).length;
    
    const daysSpanned = anomalies.length > 0 ? 
      Math.max(1, Math.ceil((now.getTime() - anomalies[anomalies.length - 1].timestamp.getTime()) / (24 * 60 * 60 * 1000))) : 1;
    
    return {
      totalAnomalies: anomalies.length,
      totalPenalty: anomalies.reduce((sum, a) => sum + a.penaltyPoints, 0),
      anomalyTypes: anomalies.reduce((acc, a) => {
        acc[a.anomalyType] = (acc[a.anomalyType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      last24Hours,
      averagePerDay: Math.round(anomalies.length / daysSpanned * 100) / 100,
    };
  }

  async deleteAnomaly(anomalyId: string, session?: ClientSession): Promise<boolean> {
    await this.init();
    
    const result = await this.collection.deleteOne(
      { _id: new ObjectId(anomalyId) },
      { session }
    );
    
    return result.deletedCount > 0;
  }

  async findAnomalyById(anomalyId: string): Promise<IAnomalyRecord | null> {
    await this.init();
    
    return await this.collection.findOne({ _id: new ObjectId(anomalyId) });
  }
}