import {Collection, ObjectId, WithId} from 'mongodb';
import {IUser} from 'shared/interfaces/Models';
import {Inject, Service} from 'typedi';
import {MongoDatabase} from '../MongoDatabase';
import {IUserRepository} from 'shared/database/interfaces/IUserRepository';

@Service()
export class UserRepository implements IUserRepository {
  private usersCollection!: Collection<IUser>;

  constructor(@Inject(() => MongoDatabase) private db: MongoDatabase) {}

  /**
   * Ensures that `usersCollection` is initialized before usage.
   */
  private async init(): Promise<void> {
    if (!this.usersCollection) {
      this.usersCollection = await this.db.getCollection<IUser>('users');
    }
  }

  /**
   * Converts `_id: ObjectId` to `id: string` in user objects.
   */
  private transformUser(user: WithId<IUser> | null): IUser | null {
    if (!user) return null;

    const transformedUser: IUser = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      firebaseUID: user.firebaseUID,
      roles: user.roles,
    };
    transformedUser.id = user._id.toString();

    return transformedUser;
  }

  /**
   * Creates a new user in the database.
   * - Generates a MongoDB `_id` internally but uses `firebaseUID` as the external identifier.
   */
  async create(user: IUser): Promise<IUser> {
    await this.init();
    const result = await this.usersCollection.insertOne(user);
    return this.transformUser({...user, _id: result.insertedId})!;
  }

  /**
   * Finds a user by email.
   */
  async findByEmail(email: string): Promise<IUser | null> {
    await this.init();
    const user = await this.usersCollection.findOne({email});
    return this.transformUser(user);
  }

  /**
   * Finds a user by ID.
   */
  async findById(id: string): Promise<IUser | null> {
    await this.init();
    const user = await this.usersCollection.findOne({_id: new ObjectId(id)});
    return this.transformUser(user);
  }

  /**
   * Finds a user by Firebase UID.
   */
  async findByFirebaseUID(firebaseUID: string): Promise<IUser | null> {
    await this.init();
    const user = await this.usersCollection.findOne({firebaseUID});
    return this.transformUser(user);
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
    return this.transformUser(result);
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
    return this.transformUser(result);
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
    return this.transformUser(result);
  }
}
