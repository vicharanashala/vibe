import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {Collection, ObjectId, ClientSession, Filter} from 'mongodb';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {EjectionPolicy} from '#root/modules/ejectionPolicy/classes/transformers/EjectionPolicy.js';
import {PolicyScope} from '#root/modules/ejectionPolicy/types.js';
import {GLOBAL_TYPES} from '#root/types.js';

@injectable()
export class EjectionPolicyRepository {
  private collection: Collection<any>;
  private collectionName = 'ejectionPolicies';
  private initialized = false;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private database: MongoDatabase,
  ) {}

  /**
   * Initialize the repository - connects to DB and creates indexes
   * This is called lazily on first use
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.database.connect();
    this.collection = await this.database.getCollection(this.collectionName);

    await this.createIndexes();
    this.initialized = true;
  }

  private async createIndexes() {
    try {
      // Index for finding active policies by scope and course
      await this.collection.createIndex(
        {scope: 1, isActive: 1, deletedAt: 1},
        {name: 'scope_active_deleted_idx'},
      );

      // Index for course-specific policies
      await this.collection.createIndex(
        {courseId: 1, isActive: 1, deletedAt: 1},
        {name: 'course_active_deleted_idx'},
      );

      // Index for priority sorting
      await this.collection.createIndex({priority: -1}, {name: 'priority_idx'});

      console.log('✅ EjectionPolicy indexes created');
    } catch (error) {
      console.error('❌ Error creating EjectionPolicy indexes:', error);
    }
  }

  /**
   * Create a new ejection policy
   */
  async create(
    policy: EjectionPolicy,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();

    const doc = {
      name: policy.name,
      description: policy.description,
      scope: policy.scope,
      courseId: policy.courseId ? new ObjectId(policy.courseId) : null,
      isActive: policy.isActive,
      priority: policy.priority,
      triggers: policy.triggers,
      actions: policy.actions,
      createdBy: new ObjectId(policy.createdBy),
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
    };

    const result = await this.collection.insertOne(doc, {session});
    return result.insertedId.toString();
  }

  /**
   * Find policy by ID
   */
  async findById(
    policyId: string,
    session?: ClientSession,
  ): Promise<EjectionPolicy | null> {
    await this.init();

    const doc = await this.collection.findOne(
      {
        _id: new ObjectId(policyId),
        isDeleted: {$ne: true},
        deletedAt: {$exists: false},
      },
      {session},
    );

    return doc ? this.mapToEjectionPolicy(doc) : null;
  }

  /**
   * Find all policies matching filters
   */
  async find(
    filters: {
      scope?: PolicyScope;
      courseId?: string;
      isActive?: boolean;
    },
    session?: ClientSession,
  ): Promise<EjectionPolicy[]> {
    await this.init();

    const query: Filter<any> = {
      isDeleted: {$ne: true},
      deletedAt: {$exists: false},
    };

    if (filters.scope) {
      query.scope = filters.scope;
    }

    if (filters.courseId) {
      query.courseId = new ObjectId(filters.courseId);
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    const docs = await this.collection
      .find(query, {session})
      .sort({priority: -1})
      .toArray();

    return docs.map(doc => this.mapToEjectionPolicy(doc));
  }

  /**
   * Get active policies for a specific course (includes platform-wide)
   */
  async findActivePoliciesForCourse(
    courseId: string,
    session?: ClientSession,
  ): Promise<EjectionPolicy[]> {
    await this.init();

    const query: Filter<any> = {
      $or: [
        {scope: 'platform'},
        {scope: 'course', courseId: new ObjectId(courseId)},
      ],
      isActive: true,
      isDeleted: {$ne: true},
      deletedAt: {$exists: false},
    };

    const docs = await this.collection
      .find(query, {session})
      .sort({priority: -1})
      .toArray();

    return docs.map(doc => this.mapToEjectionPolicy(doc));
  }

  /**
   * Check if active platform-wide policy exists
   */
  async hasActivePlatformPolicy(
    excludePolicyId?: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    const query: Filter<any> = {
      scope: 'platform',
      isActive: true,
      isDeleted: {$ne: true},
      deletedAt: {$exists: false},
    };

    if (excludePolicyId) {
      query._id = {$ne: new ObjectId(excludePolicyId)};
    }

    const count = await this.collection.countDocuments(query, {session});
    return count > 0;
  }

  /**
   * Update policy
   */
  async update(
    policyId: string,
    updates: Partial<EjectionPolicy>,
    session?: ClientSession,
  ): Promise<EjectionPolicy | null> {
    await this.init();

    const updateDoc: any = {
      ...updates,
      updatedAt: new Date(),
    };

    // Convert ID fields to ObjectId if present
    if (updates.courseId) {
      updateDoc.courseId = new ObjectId(updates.courseId);
    }

    // Don't allow updating createdAt or _id
    delete updateDoc._id;
    delete updateDoc.createdAt;

    const result = await this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(policyId),
        isDeleted: {$ne: true},
        deletedAt: {$exists: false},
      },
      {$set: updateDoc},
      {returnDocument: 'after', session},
    );

    return result ? this.mapToEjectionPolicy(result) : null;
  }

  /**
   * Soft delete policy (following your project's pattern)
   */
  async delete(policyId: string, session?: ClientSession): Promise<boolean> {
    await this.init();

    const result = await this.collection.updateOne(
      {
        _id: new ObjectId(policyId),
        isDeleted: {$ne: true},
        deletedAt: {$exists: false},
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {session},
    );

    return result.modifiedCount > 0;
  }

  /**
   * Map MongoDB document to EjectionPolicy object
   */
  private mapToEjectionPolicy(doc: any): EjectionPolicy {
    return new EjectionPolicy({
      _id: doc._id,
      name: doc.name,
      description: doc.description,
      scope: doc.scope,
      courseId: doc.courseId,
      isActive: doc.isActive,
      priority: doc.priority,
      triggers: doc.triggers,
      actions: doc.actions,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      deletedAt: doc.deletedAt,
    });
  }
}
