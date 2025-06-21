import 'reflect-metadata';
import {instanceToPlain} from 'class-transformer';
import {injectable, inject} from 'inversify';
import {Course, CourseVersion, ItemsGroup} from '#courses/classes/index.js';
import {
  ClientSession,
  Collection,
  DeleteResult,
  MongoClient,
  ObjectId,
  UpdateResult,
} from 'mongodb';
import {IInviteRepository} from '#shared/database/interfaces/IInviteRepository.js';
import {ICourse, ICourseVersion} from '#shared/interfaces/models.js';
import {MongoDatabase} from '../MongoDatabase.js';
import {NotFoundError} from 'routing-controllers';
import {ResultSetDependencies} from 'mathjs';
import { GLOBAL_TYPES } from '#root/types.js';

@injectable()
export class InviteRepository implements IInviteRepository {
  private inviteCollection: Collection<any>;
  private courseCollection: Collection<Course>;
  private courseVersionCollection: Collection<CourseVersion>;
  private itemsGroupCollection: Collection<ItemsGroup>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    this.inviteCollection = await this.db.getCollection<any>('newInvite');
    this.courseCollection = await this.db.getCollection<Course>('newCourse');
    this.courseVersionCollection =
      await this.db.getCollection<CourseVersion>('newCourseVersion');
    this.itemsGroupCollection =
      await this.db.getCollection<ItemsGroup>('itemsGroup');
  }

  async getDBClient(): Promise<MongoClient> {
    const client = await this.db.getClient();
    if (!client) {
      throw new Error('MongoDB client is not initialized');
    }
    return client;
  }

  async create(invite: any, session?: ClientSession): Promise<any> {
    await this.init();
    
    try {
      
      const result = await this.inviteCollection.insertOne(invite, {session});
      return result;
    } catch {
      throw new Error('Failed to create invite');
    }
  }
  async findInviteByEmail(email: string): Promise<any | null> {
    await this.init(); // Ensure collection is initialized

    try {
      const invites = await this.inviteCollection.find({email}).toArray();
      return invites;
    } catch (error) {
      
      throw new Error('Failed to find invite by email');
    }
  }

  async updateInvite(invite: any): Promise<void> {
    await this.init();

    if (!invite._id) {
      throw new Error('Invite must have an _id to be updated');
    }

    const {_id, ...updateData} = invite;

    const result = await this.inviteCollection.updateOne(
      {_id: new ObjectId(_id)},
      {$set: updateData},
    );

    if (result.modifiedCount === 0) {
      throw new Error(`Failed to update invite with ID: ${_id}`);
    }
  }

  async findInviteByToken(token: string): Promise<any | null> {
    await this.init(); // Ensure collection is initialized

    try {
      const invite = await this.inviteCollection.findOne({ _id: new ObjectId(token) });
      return invite;
    } catch (error) {
      throw error;
    }
  }
}
