import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {Collection, ObjectId, ClientSession} from 'mongodb';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  INotification,
  NotificationType,
} from '#root/shared/database/interfaces/INotification.js';
import {NotFoundError} from 'routing-controllers';

@injectable()
export class NotificationRepository {
  private notificationCollection!: Collection<INotification>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    this.notificationCollection =
      await this.db.getCollection<INotification>('notifications');
  }

  async create(
    notification: Omit<INotification, '_id'>,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const result = await this.notificationCollection.insertOne(
      notification as any,
      {session},
    );
    return result.insertedId.toString();
  }

  async createMany(
    notifications: Omit<INotification, '_id'>[],
    session?: ClientSession,
  ): Promise<string[]> {
    await this.init();
    if (!notifications.length) return [];
    const result = await this.notificationCollection.insertMany(
      notifications as any[],
      {session},
    );
    return Object.values(result.insertedIds).map(id => id.toString());
  }

  async findByUserId(
    userId: string,
    limit: number = 20,
    onlyUnread: boolean = false,
  ): Promise<INotification[]> {
    await this.init();
    const filter: any = {
      userId: {$in: [userId, new ObjectId(userId)]},
    };
    if (onlyUnread) filter.read = false;

    return this.notificationCollection
      .find(filter)
      .sort({createdAt: -1})
      .limit(limit)
      .toArray();
  }

  async countUnread(userId: string): Promise<number> {
    await this.init();
    return this.notificationCollection.countDocuments({
      userId: {$in: [userId, new ObjectId(userId)]},
      read: false,
    });
  }

  async markAsRead(
    notificationId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const result = await this.notificationCollection.updateOne(
      {
        _id: new ObjectId(notificationId),
        userId: {$in: [userId, new ObjectId(userId)]},
      },
      {$set: {read: true, updatedAt: new Date()}},
      {session},
    );
    if (result.matchedCount === 0) {
      throw new NotFoundError('Notification not found');
    }
  }

  async markAllAsRead(userId: string, session?: ClientSession): Promise<void> {
    await this.init();
    await this.notificationCollection.updateMany(
      {
        userId: {$in: [userId, new ObjectId(userId)]},
        read: false,
      },
      {$set: {read: true, updatedAt: new Date()}},
      {session},
    );
  }
}
