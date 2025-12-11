import {GLOBAL_TYPES} from '#root/types.js';
import {
  ClientSession,
  Collection,
  MongoClient,
  ObjectId,
  UpdateResult,
} from 'mongodb';
import {MongoDatabase} from '../MongoDatabase.js';
import {Course} from '#root/modules/courses/classes/transformers/course.js';
import {CourseVersion} from '#root/modules/courses/classes/transformers/courseVersion.js';
import {inject, injectable} from 'inversify';
import {ICourse, ICourseVersion} from '#root/shared/interfaces/models.js';
import {instanceToPlain} from 'class-transformer';
import {InternalServerError, NotFoundError} from 'routing-controllers';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';

@injectable()
export class CourseRepository implements ICourseRepository {
  private courseCollection: Collection<Course>;
  private courseVersionCollection: Collection<CourseVersion>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.courseCollection = await this.db.getCollection<Course>('newCourse');
    this.courseVersionCollection = await this.db.getCollection<CourseVersion>(
      'newCourseVersion',
    );
  }

  async getDBClient(): Promise<MongoClient> {
    const client = await this.db.getClient();
    if (!client) {
      throw new Error('MongoDB client is not initialized');
    }
    return client;
  }

  async create(
    course: Course,
    session?: ClientSession,
  ): Promise<Course | null> {
    await this.init();
    const result = await this.courseCollection.insertOne(course, {session});
    if (result.acknowledged) {
      const newCourse = await this.courseCollection.findOne(
        {
          _id: result.insertedId,
        },
        {session},
      );
      return Object.assign(new Course(), newCourse) as Course;
    } else {
      return null;
    }
  }
  async read(id: string, session?: ClientSession): Promise<ICourse | null> {
    await this.init();
    const course = await this.courseCollection.findOne(
      {
        _id: new ObjectId(id),
      },
      {session},
    );
    if (course) {
      return Object.assign(new Course(), course) as Course;
    } else {
      return null;
    }
  }

  async update(
    id: string,
    course: Partial<ICourse>,
    session?: ClientSession,
  ): Promise<ICourse | null> {
    await this.init();
    await this.read(id);

    const {_id: _, ...fields} = course;
    const res = await this.courseCollection.findOneAndUpdate(
      {_id: new ObjectId(id)},
      {$set: fields},
      {returnDocument: 'after', session},
    );

    if (res) {
      return Object.assign(new Course(), res) as Course;
    } else {
      return null;
    }
  }

  async delete(courseId: string, session?: ClientSession): Promise<boolean> {
    await this.init();
    // 1. Find the Course document to retrieve its list of version IDs
    const courseDoc = await this.courseCollection.findOne(
      {_id: new ObjectId(courseId)},
      {session},
    );
    console.log('Course DPc ', courseDoc);
    if (!courseDoc) {
      throw new NotFoundError('Course not found');
    }
    if (courseDoc) {
      await this.courseCollection.deleteOne({_id: new ObjectId(courseId)});
    }
    await this.deleteVersion(courseId, session);
    return true;
  }

  async createVersion(
    courseVersion: CourseVersion,
    session?: ClientSession,
  ): Promise<CourseVersion | null> {
    await this.init();
    try {
      const result = await this.courseVersionCollection.insertOne(
        courseVersion,
        {session},
      );
      if (result.acknowledged) {
        const newCourseVersion = await this.courseVersionCollection.findOne(
          {
            _id: result.insertedId,
          },
          {session},
        );

        return instanceToPlain(
          Object.assign(new CourseVersion(), newCourseVersion),
        ) as CourseVersion;
      } else {
        throw new InternalServerError('Failed to create course version');
      }
    } catch (error) {
      throw new InternalServerError(
        'Failed to create course version.\n More Details: ' + error,
      );
    }
  }

  async readVersion(
    versionId: string,
    session?: ClientSession,
  ): Promise<CourseVersion | null> {
    await this.init();
    try {
      const courseVersion = await this.courseVersionCollection.findOne(
        {
          _id: new ObjectId(versionId),
        },
        {session},
      );

      if (courseVersion === null) {
        throw new NotFoundError('Course Version not found');
      }

      return instanceToPlain(
        Object.assign(new CourseVersion(), courseVersion),
      ) as CourseVersion;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to read course version.\n More Details: ' + error,
      );
    }
  }

  async getActiveVersion(
    versionId: string,
    session?: ClientSession,
  ): Promise<ICourseVersion | null> {
    await this.init();

    const courseVersionPipeline = [
      {
        $match: {
          _id: new ObjectId(versionId),
        },
      },
      {
        $set: {
          modules: {
            $map: {
              input: {
                $filter: {
                  input: '$modules',
                  as: 'mod',
                  cond: {$ne: ['$$mod.isDeleted', true]},
                },
              },
              as: 'mod',
              in: {
                moduleId: '$$mod.moduleId',
                name: '$$mod.name',
                description: '$$mod.description',
                order: '$$mod.order',
                createdAt: '$$mod.createdAt',
                updatedAt: '$$mod.updatedAt',
                isDeleted: '$$mod.isDeleted',
                deletedAt: '$$mod.deletedAt',
                sections: {
                  $filter: {
                    input: '$$mod.sections',
                    as: 'sec',
                    cond: {$ne: ['$$sec.isDeleted', true]},
                  },
                },
              },
            },
          },
        },
      },
    ];

    const pipeline = this.courseVersionCollection.aggregate(
      courseVersionPipeline,
      {session},
    );

    const courseVersion = await pipeline.next();

    if (courseVersion === null) {
      throw new NotFoundError('Course Version not found');
    }

    return instanceToPlain(
      Object.assign(new CourseVersion(), courseVersion),
    ) as CourseVersion;
  }

  async deleteVersion(
    courseId: string,
    session?: ClientSession,
  ): Promise<number | null> {
    await this.init();
    try {
      // 1. Delete course version (soft delete)
      const now = new Date();
      const version = await this.courseVersionCollection.findOne(
        {
          courseId: new ObjectId(courseId),
        },
        {session},
      );
      const updatedVersion = await this.courseVersionCollection.deleteOne({
        courseId: new ObjectId(courseId),
      });
      return updatedVersion.deletedCount;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to delete course version.\n More Details: ' + error,
      );
    }
  }
}
