import {
  ClientSession,
  Collection,
  MongoClient,
  ObjectId,
  WithId,
} from 'mongodb';
import {IUser} from '../../../../interfaces/Models';
import {inject, injectable} from 'inversify';
import {MongoDatabase} from '../MongoDatabase';
import {IUserRepository} from '../../../interfaces/IUserRepository';
import {plainToClass, plainToInstance} from 'class-transformer';
import {User} from 'modules/auth/classes/transformers/User';
import GLOBAL_TYPES from '../../../../../types';

@injectable()
export class UserRepository implements IUserRepository {
  private usersCollection!: Collection<IUser>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  /**
   * Ensures that `usersCollection` is initialized before usage.
   */
  private async init(): Promise<void> {
    if (!this.usersCollection) {
      this.usersCollection = await this.db.getCollection<IUser>('users');
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
  async create(user: IUser, session?: ClientSession): Promise<IUser> {
    await this.init();
    const result = await this.usersCollection.insertOne(user, {session});
    return plainToInstance(User, result);
  }

  /**
   * Finds a user by email.
   */
  async findByEmail(
    email: string,
    session?: ClientSession,
  ): Promise<IUser | null> {
    await this.init();
    const user = await this.usersCollection.findOne({email}, {session});
    return plainToInstance(User, user);
  }

  /**
   * Finds a user by ID.
   */
  async findById(id: string | ObjectId): Promise<IUser | null> {
    await this.init();
    const user = await this.usersCollection.findOne({_id: new ObjectId(id)});
    return plainToInstance(User, user);
  }

  /**
   * Finds a user by Firebase UID.
   */
  async findByFirebaseUID(firebaseUID: string): Promise<IUser | null> {
    await this.init();
    const user = await this.usersCollection.findOne({firebaseUID});
    return plainToInstance(User, user);
  }

  /**
   * Adds a role to a user.
   */
  async addRole(firebaseUID: string, role: string): Promise<IUser | null> {
    await this.init();
    const result = await this.usersCollection.findOneAndUpdate(
      {firebaseUID},
      {$addToSet: {roles: role}},
      {returnDocument: 'after'},
    );
    return plainToInstance(User, result);
  }

  /**
   * Removes a role from a user.
   */
  async removeRole(firebaseUID: string, role: string): Promise<IUser | null> {
    await this.init();
    const result = await this.usersCollection.findOneAndUpdate(
      {firebaseUID},
      {$pull: {roles: role}},
      {returnDocument: 'after'},
    );
    return plainToInstance(User, result);
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
      {firebaseUID},
      {$set: {password}},
      {returnDocument: 'after'},
    );
    return plainToInstance(User, result);
  }
}
