import { IEnrollment, IProgress } from '#shared/interfaces/models.js';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection, ObjectId } from 'mongodb';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { MongoDatabase } from '../MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';

@injectable()
export class EnrollmentRepository {
  private enrollmentCollection!: Collection<IEnrollment>;
  private progressCollection!: Collection<IProgress>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) { }

  private async init() {
    this.enrollmentCollection = await this.db.getCollection<IEnrollment>(
      'enrollment',
    );
    this.progressCollection = await this.db.getCollection<IProgress>(
      'progress',
    );
  }

  /**
   * Find an enrollment by ID
   */
  async findById(id: string): Promise<IEnrollment | null> {
    await this.init();
    try {
      return await this.enrollmentCollection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      throw new InternalServerError(
        `Failed to find enrollment by ID: ${error.message}`,
      );
    }
  }

  /**
   * Find an existing enrollment for a user in a specific course version
   */
  async findEnrollment(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
  ): Promise<IEnrollment | null> {
    await this.init();

    const courseObjectId = new ObjectId(courseId);
    const courseVersionObjectId = new ObjectId(courseVersionId);

    // temp: Try both userId as string and ObjectId (if valid)
    const userFilter = [
      userId,
      ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    ].filter(Boolean);

    // const userObjectid = new ObjectId(userId)

    return await this.enrollmentCollection.findOne({
      userId: { $in: userFilter },
      courseId: courseObjectId,
      courseVersionId: courseVersionObjectId,
    });
  }

  /**
   * Create a new enrollment record
   */
  async createEnrollment(enrollment: IEnrollment): Promise<IEnrollment> {
    await this.init();
    try {
      const result = await this.enrollmentCollection.insertOne(enrollment);
      if (!result.acknowledged) {
        throw new InternalServerError('Failed to create enrollment record');
      }

      const newEnrollment = await this.enrollmentCollection.findOne({
        _id: result.insertedId,
      });

      if (!newEnrollment) {
        throw new NotFoundError('Newly created enrollment not found');
      }

      return newEnrollment;
    } catch (error) {
      throw new InternalServerError(
        `Failed to create enrollment: ${error.message}`,
      );
    }
  }
  /**
   * Delete an enrollment record for a user in a specific course version
   */
  async deleteEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: any,
  ): Promise<void> {
    await this.init();

    const courseObjectId = new ObjectId(courseId);
    const courseVersionObjectId = new ObjectId(courseVersionId);

    // temp: Try both userId as string and ObjectId (if valid)
    const userFilter = [
      userId,
      ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    ].filter(Boolean);

    // const userObjectid = new ObjectId(userId)

    const result = await this.enrollmentCollection.deleteOne(
      {
        userId: { $in: userFilter },
        courseId: courseObjectId,
        courseVersionId: courseVersionObjectId,
      },
      { session },
    );
    if (result.deletedCount === 0) {
      throw new NotFoundError('Enrollment not found to delete');
    }
  }

  /**
   * Create a new progress tracking record
   */
  async createProgress(progress: IProgress): Promise<IProgress> {
    await this.init();
    try {
      const result = await this.progressCollection.insertOne(progress);
      if (!result.acknowledged) {
        throw new InternalServerError('Failed to create progress record');
      }

      const newProgress = await this.progressCollection.findOne({
        _id: result.insertedId,
      });

      if (!newProgress) {
        throw new NotFoundError('Newly created progress not found');
      }

      return newProgress;
    } catch (error) {
      throw new InternalServerError(
        `Failed to create progress tracking: ${error.message}`,
      );
    }
  }

  async deleteProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: any,
  ): Promise<void> {
    await this.init();
    await this.progressCollection.deleteMany(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      { session },
    );
  }

  /**
   * Get paginated enrollments for a user
   */
  async getEnrollments(userId: string, skip: number, limit: number) {
    await this.init();

    // temp: Try both userId as string and ObjectId (if valid)
    const userFilter = [
      userId,
      ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    ].filter(Boolean);

    // const userObjectid = new ObjectId(userId)

    return await this.enrollmentCollection
      .find({ userId: { $in: userFilter } })
      .skip(skip)
      .limit(limit)
      .sort({ enrollmentDate: -1 })
      .toArray();
  }

  async getAllEnrollments(userId: string, session?: ClientSession) {
    await this.init();

    // temp: Try both userId as string and ObjectId (if valid)
    const userFilter = [
      userId,
      ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    ].filter(Boolean);

    // const userObjectid = new ObjectId(userId)

    return await this.enrollmentCollection
      .find({ userId: { $in: userFilter } }, { session })
      .sort({ enrollmentDate: -1 })
      .toArray();
  }

  async getCourseVersionEnrollments(
    courseId: string,
    courseVersionId: string,
    skip: number,
    limit: number,
    search: string,
    sortBy: 'name' | 'enrollmentDate' | 'progress',
    sortOrder: 'asc' | 'desc',
    session?: ClientSession
  ) {
    await this.init();

    const matchStage: any = {
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
    };

    // decide sort field
    let sortField: any = {};
    if (sortBy === 'name') {
      // sort by firstName + lastName
      sortField = { firstName: sortOrder === 'asc' ? 1 : -1, lastName: sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'enrollmentDate') {
      sortField = { enrollmentDate: sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'progress') {
      sortField = { 'progress.percentCompleted': sortOrder === 'asc' ? 1 : -1 };
    }

    const aggregationPipeline: any[] = [
      { $match: matchStage },
      {
        $addFields: {
          userId: { $toObjectId: '$userId' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: {
          path: '$userInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          userId: { $toString: '$userInfo._id' },
          _id: { $toString: '$_id' },
          courseId: { $toString: '$courseId' },
          courseVersionId: { $toString: '$courseVersionId' },
          firstName: '$userInfo.firstName',
          lastName: '$userInfo.lastName',
          email: '$userInfo.email',
        },
      },
    ];

    // search
    if (search && search.trim() !== '') {
      aggregationPipeline.push({
        $match: {
          $or: [
            { 'userInfo.firstName': { $regex: search, $options: 'i' } },
            { 'userInfo.lastName': { $regex: search, $options: 'i' } },
            { 'userInfo.email': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    // sorting
    aggregationPipeline.push({ $sort: sortField });

    // pagination
    aggregationPipeline.push({ $skip: skip }, { $limit: limit });

    // count separately
    const totalDocuments = await this.enrollmentCollection.countDocuments(matchStage);
    const enrollments = await this.enrollmentCollection
      .aggregate(aggregationPipeline, { session })
      .toArray();

    const totalPages = typeof limit === 'number' && limit > 0 ? Math.ceil(totalDocuments / limit) : 1;

    return {
      totalDocuments,
      totalPages,
      currentPage: Math.floor(skip / limit) + 1,
      enrollments,
    };
  }


  /**
   * Count total enrollments for a user
   */
  async countEnrollments(userId: string) {
    await this.init();

    // temp: Try both userId as string and ObjectId (if valid)
    const userFilter = [
      userId,
      ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    ].filter(Boolean);

    // const userObjectid = new ObjectId(userId)

    return await this.enrollmentCollection.countDocuments({
      userId: { $in: userFilter },
    });
  }

  async bulkUpdateEnrollments(
    bulkOperations: any[],
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    try {
      const result = await this.enrollmentCollection.bulkWrite(bulkOperations, { session });
      console.log(`Enrollment bulk update result: ${JSON.stringify(result)}`);
    } catch (error) {
      throw new InternalServerError(
        'Failed to bulk update enrollments.\n More Details: ' + error,
      );
    }
  }
  async getByCourseVersion(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<any[]> {
    await this.init();
    return this.enrollmentCollection
      .find(
        {
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
        },
        { session },
      )
      .toArray();
  }


}
