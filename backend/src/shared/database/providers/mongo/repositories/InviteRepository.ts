import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {ClientSession, Collection, MongoClient, ObjectId} from 'mongodb';
import {MongoDatabase} from '../MongoDatabase.js';
import {InternalServerError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
import {Invite} from '#root/modules/notifications/index.js';

@injectable()
export class InviteRepository {
  private inviteCollection: Collection<Invite>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    this.inviteCollection = await this.db.getCollection<Invite>('invites');
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
      const result = await this.inviteCollection.insertOne(invite, {session});
      return result.insertedId.toString();
    } catch {
      throw new InternalServerError('Failed to create invite');
    }
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
    return invite;
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
    return invites;
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

    if (result.modifiedCount === 0) {
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
    return invites;
  }

  async findInvitesByCourse(
    courseId: string,
    courseVersionId: string,
    inviteStatus: string,
    currentPage: number,
    limit: number,
    search: string,
    sort: string,
    session?: ClientSession,
  ): Promise<{invites: Invite[]; totalDocuments: number; totalPages: number}> {
    await this.init();

    const filter: any = {courseId, courseVersionId};

    if (inviteStatus) {
      filter.inviteStatus = inviteStatus;
    }

    if (search) {
      filter.email = {$regex: search, $options: 'i'};
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

    return {invites, totalDocuments, totalPages};
  }
}
