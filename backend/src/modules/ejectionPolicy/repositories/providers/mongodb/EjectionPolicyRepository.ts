import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {Collection, ObjectId, ClientSession, Filter} from 'mongodb';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {EjectionPolicy} from '#root/modules/ejectionPolicy/classes/transformers/EjectionPolicy.js';
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
      try {
        await this.collection.dropIndex('course_version_cohort_unique_idx');
      } catch (e) {
        // ignore if index doesn't exist
      }

      await this.collection.createIndex(
        {courseId: 1, courseVersionId: 1, cohortId: 1},
        {
          name: 'course_version_cohort_unique_idx',
          unique: true,
          partialFilterExpression: {isDeleted: false},
        },
      );
      await this.collection.createIndex(
        {courseId: 1, courseVersionId: 1, isActive: 1, deletedAt: 1},
        {name: 'course_version_active_deleted_idx'},
      );
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

      courseId: policy.courseId ? new ObjectId(policy.courseId) : null,
      courseVersionId: policy.courseVersionId
        ? new ObjectId(policy.courseVersionId)
        : null,
      cohortId: policy.cohortId ? new ObjectId(policy.cohortId) : null,
      isActive: policy.isActive,
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
      courseId?: string;
      courseVersionId?: string;
      cohortId?: string;
      isActive?: boolean;
    },
    session?: ClientSession,
  ): Promise<EjectionPolicy[]> {
    await this.init();

    const query: Filter<any> = {
      isDeleted: {$ne: true},
      deletedAt: {$exists: false},
    };

    if (filters.courseId) {
      query.courseId = new ObjectId(filters.courseId);
    }

    if (filters.courseVersionId) {
      query.courseVersionId = new ObjectId(filters.courseVersionId);
    }
    if (filters.cohortId) {
      query.cohortId = new ObjectId(filters.cohortId);
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    const docs = await this.collection
      .find(query, {session})
      .sort({createdAt: -1})
      .toArray();

    return docs.map(doc => this.mapToEjectionPolicy(doc));
  }

  /**
   * Get active policies for a specific course version (includes platform-wide policies)
   */
  async findActivePoliciesForCourse(
    courseId: string,
    courseVersionId: string,
    cohortId: string, // add
    session?: ClientSession,
  ): Promise<EjectionPolicy[]> {
    await this.init();

    const query: Filter<any> = {
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      cohortId: new ObjectId(cohortId),
      isActive: true,
      isDeleted: {$ne: true},
      deletedAt: {$exists: false},
    };

    return (
      await this.collection
        .find(query, {session})
        .sort({createdAt: -1})
        .toArray()
    ).map(doc => this.mapToEjectionPolicy(doc));
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

    if (updates.courseVersionId) {
      updateDoc.courseVersionId = new ObjectId(updates.courseVersionId);
    }

    if (updates.cohortId) {
      updateDoc.cohortId = new ObjectId(updates.cohortId);
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
      courseId: doc.courseId,
      courseVersionId: doc.courseVersionId,
      cohortId: doc.cohortId,
      isActive: doc.isActive,

      triggers: doc.triggers,
      actions: doc.actions,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      deletedAt: doc.deletedAt,
    });
  }
  async findByCohort(
    courseId: string,
    courseVersionId: string,
    cohortId: string,
    excludePolicyId?: string,
    session?: ClientSession,
  ): Promise<EjectionPolicy | null> {
    await this.init();

    const query: Filter<any> = {
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      cohortId: new ObjectId(cohortId),
      isDeleted: {$ne: true},
      deletedAt: {$exists: false},
    };

    if (excludePolicyId) {
      query._id = {$ne: new ObjectId(excludePolicyId)};
    }

    const doc = await this.collection.findOne(query, {session});
    return doc ? this.mapToEjectionPolicy(doc) : null;
  }

  async getPolicyForContext(
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ) {
    const policies = await this.collection.find({
      courseId,
      courseVersionId,
      ...(cohortId ? {cohortId} : {}),
      isActive: true,
    });

    // since 1 policy per cohort
    return policies[0] ?? null;
  }
  // Finds a policy regardless of isDeleted status
  async findByIdIncludingDeleted(
    policyId: string,
    session?: ClientSession,
  ): Promise<EjectionPolicy | null> {
    const doc = await this.collection.findOne(
      {_id: new ObjectId(policyId)},
      {session},
    );
    return doc ? new EjectionPolicy(doc) : null;
  }

  // Finds only a soft-deleted policy
  async findDeletedById(
    policyId: string,
    session?: ClientSession,
  ): Promise<EjectionPolicy | null> {
    const doc = await this.collection.findOne(
      {_id: new ObjectId(policyId), isDeleted: true},
      {session},
    );
    return doc ? new EjectionPolicy(doc) : null;
  }
}
