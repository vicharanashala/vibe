import { Collection, ClientSession, ObjectId } from 'mongodb';
import { injectable, inject } from 'inversify';
import { ISessionRiskRepository } from '../../interfaces/ISessionRiskRepository.js';
import { ISessionRisk } from '../../interfaces/ISecurityService.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';

const COLLECTION_NAME = 'sessionRisks';

@injectable()
export class SessionRiskRepository implements ISessionRiskRepository {
  private collection: Collection<Omit<ISessionRisk, '_id'> & { _id?: ObjectId }>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    this.collection = this.database.getDB().collection(COLLECTION_NAME);
  }

  async create(sessionRisk: Omit<ISessionRisk, '_id'>): Promise<void> {
    try {
      await this.collection.updateOne(
        { sessionId: sessionRisk.sessionId },
        { $set: sessionRisk },
        { upsert: true },
      );
    } catch (error) {
      console.error('Error creating session risk record:', error);
      throw error;
    }
  }

  async findBySessionId(sessionId: string): Promise<ISessionRisk | null> {
    try {
      const doc = await this.collection.findOne({ sessionId });
      if (!doc) return null;

      const { _id, ...rest } = doc;
      return {
        ...rest,
        _id: _id?.toString(),
      } as ISessionRisk;
    } catch (error) {
      console.error('Error finding session risk:', error);
      throw error;
    }
  }

  async updateRiskScore(
    sessionId: string,
    increment: number,
    session?: ClientSession,
  ): Promise<void> {
    try {
      await this.collection.updateOne(
        { sessionId },
        { $inc: { riskScore: increment }, $set: { lastUpdated: new Date() } },
        { session },
      );
    } catch (error) {
      console.error('Error updating risk score:', error);
      throw error;
    }
  }

  async updateCaptchaRequired(
    sessionId: string,
    required: boolean,
    session?: ClientSession,
  ): Promise<void> {
    try {
      await this.collection.updateOne(
        { sessionId },
        {
          $set: { captchaRequired: required, lastUpdated: new Date() },
        },
        { session },
      );
    } catch (error) {
      console.error('Error updating captcha required flag:', error);
      throw error;
    }
  }

  async updateReAuthRequired(
    sessionId: string,
    required: boolean,
    session?: ClientSession,
  ): Promise<void> {
    try {
      await this.collection.updateOne(
        { sessionId },
        {
          $set: { reAuthRequired: required, lastUpdated: new Date() },
        },
        { session },
      );
    } catch (error) {
      console.error('Error updating re-auth required flag:', error);
      throw error;
    }
  }

  async incrementHoneypotTriggerCount(
    sessionId: string,
    session?: ClientSession,
  ): Promise<void> {
    try {
      await this.collection.updateOne(
        { sessionId },
        {
          $inc: { honeypotTriggerCount: 1 },
          $set: { lastUpdated: new Date() },
        },
        { session },
      );
    } catch (error) {
      console.error('Error incrementing honeypot trigger count:', error);
      throw error;
    }
  }
}
