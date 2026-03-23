import { IUserRepository } from '#shared/database/interfaces/IUserRepository.js';
import { IUser } from '#shared/interfaces/models.js';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { injectable, inject } from 'inversify';
import { Collection, MongoClient, ClientSession, ObjectId } from 'mongodb';
import { MongoDatabase } from '../MongoDatabase.js';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';
import { User } from '#auth/classes/transformers/User.js';
import admin from 'firebase-admin';
import { appConfig } from '#root/config/app.js';

if (!admin.apps.length) {
  if (appConfig.isDevelopment) {
    admin.initializeApp({
      credential: admin.credential.cert({
        clientEmail: appConfig.firebase.clientEmail,
        privateKey: appConfig.firebase.privateKey.replace(/\\n/g, '\n'),
        projectId: appConfig.firebase.projectId,
      }),
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}
@injectable()
export class UserRepository implements IUserRepository {
  private usersCollection!: Collection<IUser>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) { }

  /**
   * Ensures that `usersCollection` is initialized before usage.
   */
  private async init(): Promise<void> {
    if (!this.usersCollection) {
      this.usersCollection = await this.db.getCollection<IUser>('users');
      this.usersCollection.createIndex({ email: 1, firebaseUID: 1 });
    }
  }

  async getDBClient(): Promise<MongoClient> {
    const client = await this.db.getClient();
    if (!client) {
      throw new Error('MongoDB client is not initialized');
    }
    return client;
  }

  /**
   * Creates a new user in the database.
   * - Generates a MongoDB `_id` internally but uses `firebaseUID` as the external identifier.
   */
  async create(user: IUser, session?: ClientSession): Promise<string> {
    await this.init();
    const existingUser = await this.usersCollection.findOne(
      { email: user.email },
      { session },
    );

    if (existingUser) {
      throw new Error('User already exists');
    }
    const result = await this.usersCollection.insertOne(user, { session });
    if (!result.acknowledged) {
      throw new InternalServerError('Failed to create user');
    }
    return result.insertedId.toString();
  }

  /**
   * Finds a user by email.
   */
  async findByEmail(
    email: string,
    session?: ClientSession,
  ): Promise<IUser | null> {
    await this.init();

    const user = await this.usersCollection.findOne({ email }, { session });
    return user;
  }

  /**
   * Finds a user by ID.
   */
  async findById(
    id: string | ObjectId,
    session?: ClientSession,
  ): Promise<IUser | null> {
    await this.init();
    const user = await this.usersCollection.findOne(
      { _id: new ObjectId(id) },
      { session },
    );
    return instanceToPlain(new User(user)) as IUser;
  }

  //   async getUserNamesByIds(userIds:string[]) {
  //   const users = await this.usersCollection.find({ _id: { $in: userIds } }).select('name').lean(); // Assuming 'name' field exists
  //   return users.map(user => user.name);
  // }

  async getUserNamesByIds(userIds: string[], session?: ClientSession) {
    await this.init();
    const users = await this.usersCollection
      .find(
        { _id: { $in: userIds.map(id => new ObjectId(id)) } },
        { projection: { firstName: 1, firebaseUID: 1, _id: 0 }, session }, // <-- projection instead of select
      )
      .toArray();
    const results = await Promise.all(
      users.map(async user => {
        try {
          const userRecord = await admin.auth().getUser(user.firebaseUID);
          return {
            name: user.firstName,
            profileImage: userRecord.photoURL || null,
          };
        } catch (error) {
          console.error(
            `Failed to fetch Firebase user for UID: ${user.firebaseUID}`,
            error,
          );
          return {
            name: user.firstName,
            profileImage: null,
          };
        }
      }),
    );
    return results;

    // return users.map(user => user.firstName);
  }

  /**
   * Finds a user by Firebase UID.
   */
  async findByFirebaseUID(
    firebaseUID: string,
    session?: ClientSession,
  ): Promise<IUser | null> {
    await this.init();
    const user = await this.usersCollection.findOne({ firebaseUID }, { session });
    return user;
  }

  /**
   * Adds a role to a user.
   */
  async makeAdmin(userId: string, session?: ClientSession): Promise<void> {
    await this.init();
    await this.usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { roles: 'admin' } },
      { session },
    );
  }

  /**
   * Updates a user's password.
   */
  async updatePassword(
    firebaseUID: string,
    password: string,
  ): Promise<IUser | null> {
    await this.init();
    const result = await this.usersCollection.findOneAndUpdate(
      { firebaseUID },
      { $set: { password } },
      { returnDocument: 'after' },
    );
    return instanceToPlain(new User(result)) as IUser;
  }

  async edit(
    userId: string,
    userData: Partial<IUser>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: userData },
      { session },
    );
  }

  async getUsersByIds(ids: string[]): Promise<IUser[]> {
    await this.init();
    const objectIds = ids.map(id => new ObjectId(id));
    const users = await this.usersCollection
      .find({ _id: { $in: objectIds } })
      .toArray();
    return users.map(user => ({
      ...user,
      _id: user._id?.toString(),
    }));
  }

  /**
   * Searches for users by name or email
   * @param searchTerm The search term to match against user names or emails
   * @param session Optional MongoDB session
   * @returns Promise with array of user search results
   */
  async searchUsers(searchTerm: string, session?: ClientSession) {
    await this.init();

    const searchRegex = new RegExp(searchTerm, 'i');
    const query = {
      $or: [
        { firstName: { $regex: searchRegex } },
        { lastName: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
      ],
    };

    const projection = {
      _id: 1,
      firstName: 1,
      lastName: 1,
      email: 1,
    };

    const users = await this.usersCollection
      .find(query, { session, projection })
      .toArray();

    return users.map(user => ({
      _id: user._id as ObjectId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    }));
  }

  async deleteDuplicateUsers() {
    const COURSE_ID = new ObjectId("6943b2cafa4e840eb39490b6");

    const cursor = this.usersCollection.aggregate([
      {
        $group: {
          _id: "$email",
          users: { $push: "$_id" },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } },

      {
        $lookup: {
          from: "enrollments",
          let: { userIds: "$users" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$userId", "$$userIds"] },
                    { $eq: ["$courseId", COURSE_ID] }
                  ]
                }
              }
            }
          ],
          as: "enrollments"
        }
      },

      {
        $lookup: {
          from: "watchtime",
          let: { userIds: "$users" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$userId", "$$userIds"] },
                    { $eq: ["$courseId", COURSE_ID] }
                  ]
                }
              }
            }
          ],
          as: "watchtimes"
        }
      },

      {
        $addFields: {
          validUserIds: {
            $setIntersection: [
              "$enrollments.userId",
              "$watchtimes.userId"
            ]
          }
        }
      },

      {
        $project: {
          markDeletedUserIds: {
            $setDifference: ["$users", "$validUserIds"]
          }
        }
      },

      { $match: { "markDeletedUserIds.0": { $exists: true } } }
    ]);

    let totalMarked = 0;

    for await (const doc of cursor) {
      const res = await this.usersCollection.updateMany(
        { _id: { $in: doc.markDeletedUserIds } },
        {
          $set: {
            isDeleted: false,
            updatedAt: new Date()
          }
        }
      );
      totalMarked += res.modifiedCount;
    }

    return totalMarked;
  }



  /**
   * Updates a user's avatar URL.
   */
  async updateAvatar(
    userId: string,
    avatarUrl: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const result = await this.usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { avatar: avatarUrl } },
      { session },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundError('User not found');
    }
  }

}
