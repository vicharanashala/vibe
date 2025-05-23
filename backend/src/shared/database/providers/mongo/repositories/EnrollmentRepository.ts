import 'reflect-metadata';
import {Collection, ObjectId} from 'mongodb';
import {Service, Inject} from 'typedi';
import {MongoDatabase} from '../MongoDatabase';
import {IEnrollment, IProgress} from 'shared/interfaces/Models';
import {CreateError, ReadError} from 'shared/errors/errors';
import {NotFoundError} from 'routing-controllers';

@Service()
export class EnrollmentRepository {
  private enrollmentCollection: Collection<IEnrollment>;
  private progressCollection: Collection<IProgress>;

  constructor(@Inject(() => MongoDatabase) private db: MongoDatabase) {}

  private async init() {
    this.enrollmentCollection =
      await this.db.getCollection<IEnrollment>('enrollment');
    this.progressCollection =
      await this.db.getCollection<IProgress>('progress');
  }

  /**
   * Find an enrollment by ID
   */
  async findById(id: string): Promise<IEnrollment | null> {
    await this.init();
    try {
      return await this.enrollmentCollection.findOne({_id: new ObjectId(id)});
    } catch (error) {
      throw new ReadError(`Failed to find enrollment by ID: ${error.message}`);
    }
  }

  /**
   * Find an existing enrollment for a user in a specific course version
   */
  async findEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<IEnrollment | null> {
    await this.init();

    return await this.enrollmentCollection.findOne({
      userId: userId,
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
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
        throw new CreateError('Failed to create enrollment record');
      }

      const newEnrollment = await this.enrollmentCollection.findOne({
        _id: result.insertedId,
      });

      if (!newEnrollment) {
        throw new NotFoundError('Newly created enrollment not found');
      }

      return newEnrollment;
    } catch (error) {
      throw new CreateError(`Failed to create enrollment: ${error.message}`);
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
    const result = await this.enrollmentCollection.deleteOne(
      {
        userId: userId,
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {session},
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
        throw new CreateError('Failed to create progress record');
      }

      const newProgress = await this.progressCollection.findOne({
        _id: result.insertedId,
      });

      if (!newProgress) {
        throw new NotFoundError('Newly created progress not found');
      }

      return newProgress;
    } catch (error) {
      throw new CreateError(
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
      {session},
    );
  }
}
