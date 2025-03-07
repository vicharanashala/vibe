import { MongoClient, Db, Collection, Document, ObjectId, WithId } from "mongodb";
import { IUser } from "shared/interfaces/IUser";
import { Inject, Service } from "typedi";

export interface IDatabase<T = unknown> {
    database: T | null;
    disconnect(): Promise<T | null>;
    isConnected(): boolean;
}

/**
 * @class MongoDatabase
 * @implements {IDatabase<Db>}
 * @description A service class for managing MongoDB connections and operations.
 * 
 * @example
 * const mongoDatabase = new MongoDatabase('mongodb://localhost:27017', 'myDatabase');
 * 
 * @template Db
 */
@Service()
export class MongoDatabase implements IDatabase<Db> {
    private client: MongoClient;
    public database: Db | null;

    /**
     * Creates an instance of MongoDatabase.
     * @param {string} uri - The MongoDB connection URI.
     * @param {string} dbName - The name of the database to connect to.
     */
    constructor(private readonly uri: string, private readonly dbName: string) {
        this.client = new MongoClient(uri);
    }

    /**
     * Connects to the MongoDB database.
     * @returns {Promise<Db>} The connected database instance.
     * @throws Will throw an error if the connection fails.
     */
    private async connect(): Promise<Db> {
        console.log("Connecting to MongoDB:", this.dbName);
        try {
            await this.client.connect();
            console.log("Connected to MongoDB:", this.dbName);
            this.database = this.client.db(this.dbName);
            return this.database;
        } catch (error) {
            console.error("Error connecting to MongoDB:", error);
            throw error;
        }
    }

    /**
     * Disconnects from the MongoDB database.
     * @returns {Promise<Db | null>} The disconnected database instance, or null if already disconnected.
     */
    public async disconnect(): Promise<Db | null> {
        if (this.client) {
            await this.client.close();
            console.log("Disconnected from MongoDB");
            this.database = null;
        }
        return this.database;
    }

    /**
     * Checks if the database is connected.
     * @returns {boolean} True if the database is connected, false otherwise.
     */
    public isConnected(): boolean {
        return this.database !== null;
    }

    /**
     * Retrieves a collection from the connected database.
     * @template T
     * @param {string} name - The name of the collection to retrieve.
     * @returns {Collection<T>} The MongoDB collection.
     * @throws Will throw an error if the database is not connected.
     */
    /**
     * Retrieves a collection from the connected database.
     * @template T
     * @param {string} name - The name of the collection to retrieve.
     * @returns {Promise<Collection<T>>} The MongoDB collection.
     * @throws Will throw an error if the database is not connected.
     */
    public async getCollection<T extends Document>(name: string): Promise<Collection<T>> {
        if (!this.database) {
            await this.connect();
        }
        if (!this.database) {
            throw new Error("Database is not connected");
        }
        return this.database.collection<T>(name);
    }
}

// ----------------- User Repository -----------------

/**
 * Interface representing a repository for user-related operations.
 */
export interface IUserRepository {
    /**
     * Creates a new user.
     * @param user - The user to create.
     * @returns A promise that resolves to the created user.
     */
    create(user: IUser): Promise<IUser>;

    /**
     * Finds a user by their email.
     * @param email - The email of the user to find.
     * @returns A promise that resolves to the user if found, or null if not found.
     */
    findByEmail(email: string): Promise<IUser | null>;

    /**
     * Adds a role to a user.
     * @param userId - The ID of the user to add the role to.
     * @param role - The role to add.
     * @returns A promise that resolves to the updated user if successful, or null if not.
     */
    addRole(userId: string, role: string): Promise<IUser | null>;

    /**
     * Removes a role from a user.
     * @param userId - The ID of the user to remove the role from.
     * @param role - The role to remove.
     * @returns A promise that resolves to the updated user if successful, or null if not.
     */
    removeRole(userId: string, role: string): Promise<IUser | null>;

    /**
     * Updates the password of a user.
     * @param userId - The ID of the user to update the password for.
     * @param password - The new password.
     * @returns A promise that resolves to the updated user if successful, or null if not.
     */
    updatePassword(userId: string, password: string): Promise<IUser | null>;
}

@Service()
export class UserRepository {
    private usersCollection!: Collection<IUser>;

    constructor(@Inject(() => MongoDatabase) private db: MongoDatabase) {}

    /**
     * Ensures that `usersCollection` is initialized before usage.
     */
    private async init(): Promise<void> {
        if (!this.usersCollection) {
            this.usersCollection = await this.db.getCollection<IUser>("users");
        }
    }

    /**
     * Converts `_id: ObjectId` to `_id: string` in user objects.
     */
    private transformUser(user: WithId<IUser> | null): IUser | null {
        if (!user) return null;

        const transformedUser:IUser = {
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
        return this.transformUser({ ...user, _id: result.insertedId })!;
    }

    /**
     * Finds a user by email.
     */
    async findByEmail(email: string): Promise<IUser | null> {
        await this.init();
        const user = await this.usersCollection.findOne({ email });
        return this.transformUser(user);
    }

    /**
     * Finds a user by Firebase UID.
     */
    async findByFirebaseUID(firebaseUID: string): Promise<IUser | null> {
        await this.init();
        const user = await this.usersCollection.findOne({ firebaseUID });
        return this.transformUser(user);
    }

    /**
     * Adds a role to a user.
     */
    async addRole(firebaseUID: string, role: string): Promise<IUser | null> {
        await this.init();
        const result = await this.usersCollection.findOneAndUpdate(
            { firebaseUID },
            { $addToSet: { roles: role } },
            { returnDocument: "after" }
        );
        return this.transformUser(result);
    }

    /**
     * Removes a role from a user.
     */
    async removeRole(firebaseUID: string, role: string): Promise<IUser | null> {
        await this.init();
        const result = await this.usersCollection.findOneAndUpdate(
            { firebaseUID },
            { $pull: { roles: role } },
            { returnDocument: "after" }
        );
        return this.transformUser(result);
    }

    /**
     * Updates a user's password.
     */
    async updatePassword(firebaseUID: string, password: string): Promise<IUser | null> {
        await this.init();
        const result = await this.usersCollection.findOneAndUpdate(
            { firebaseUID },
            { $set: { password } },
            { returnDocument: "after" }
        );
        return this.transformUser(result);
    }
}