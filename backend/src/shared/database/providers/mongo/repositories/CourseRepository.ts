import {GLOBAL_TYPES} from '#root/types.js';
import {ICourseRepository} from '#shared/database/interfaces/ICourseRepository.js';
import {ICourse, ICourseVersion} from '#shared/interfaces/models.js';
import {instanceToPlain} from 'class-transformer';
import {injectable, inject} from 'inversify';
import {
  Collection,
  MongoClient,
  ClientSession,
  ObjectId,
  DeleteResult,
  UpdateResult,
} from 'mongodb';
import {NotFoundError, InternalServerError} from 'routing-controllers';
import {MongoDatabase} from '../MongoDatabase.js';
import {Course} from '#courses/classes/transformers/Course.js';
import {CourseVersion} from '#courses/classes/transformers/CourseVersion.js';
import {ItemsGroup} from '#courses/classes/transformers/Item.js';

@injectable()
export class CourseRepository implements ICourseRepository {
  private courseCollection: Collection<Course>;
  private courseVersionCollection: Collection<CourseVersion>;
  private itemsGroupCollection: Collection<ItemsGroup>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.courseCollection = await this.db.getCollection<Course>('newCourse');
    this.courseVersionCollection =
      await this.db.getCollection<CourseVersion>('newCourseVersion');
    this.itemsGroupCollection =
      await this.db.getCollection<ItemsGroup>('itemsGroup');
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

  async delete(id: string, session?: ClientSession): Promise<boolean> {
    await this.init();
    // 1. Find the Course document to retrieve its list of version IDs
    const courseDoc = await this.courseCollection.findOne(
      {_id: new ObjectId(id)},
      {session},
    );
    if (!courseDoc) {
      throw new NotFoundError('Course not found');
    }

    // 2. If the course has versions, delete each one:
    //    - Read raw version document from courseVersionCollection
    //    - Extract all itemsGroupId values from its modules/sections
    //    - Call deleteVersion(...) to delete the version and its items
    const versionIds: string[] = Array.isArray((courseDoc as any).versions)
      ? (courseDoc as any).versions.map((v: any) => v.toString())
      : [];

    for (const versionId of versionIds) {
      // 2a. Fetch the raw CourseVersion document
      const rawVersion = await this.courseVersionCollection.findOne(
        {_id: new ObjectId(versionId)},
        {session},
      );
      if (!rawVersion) {
        throw new NotFoundError(`CourseVersion with ID ${versionId} not found`);
      }

      // 2b. Walk through modules → sections → collect all itemsGroupId
      const itemGroupsIds: ObjectId[] = [];
      if (Array.isArray((rawVersion as any).modules)) {
        for (const mod of (rawVersion as any).modules as any[]) {
          if (Array.isArray(mod.sections)) {
            for (const sec of mod.sections as any[]) {
              itemGroupsIds.push(new ObjectId(sec.itemsGroupId));
            }
          }
        }
      }

      // 2c. Invoke the existing deleteVersion(...) method
      await this.deleteVersion(id, versionId, itemGroupsIds, session);
    }

    // 3. Finally, delete the Course document itself
    const deleteCourseResult = await this.courseCollection.deleteOne(
      {_id: new ObjectId(id)},
      {session},
    );
    if (deleteCourseResult.deletedCount !== 1) {
      throw new InternalServerError('Failed to delete course');
    }
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
  async updateVersion(
    versionId: string,
    courseVersion: CourseVersion,
    session?: ClientSession,
  ): Promise<ICourseVersion | null> {
    await this.init();
    try {
      const {_id: _, ...fields} = courseVersion;
      const result = await this.courseVersionCollection.updateOne(
        {_id: new ObjectId(versionId)},
        {$set: fields},
        {session},
      );
      if (result.modifiedCount === 1) {
        const updatedCourseVersion = await this.courseVersionCollection.findOne(
          {
            _id: new ObjectId(versionId),
          },
          {session},
        );
        return instanceToPlain(
          Object.assign(new CourseVersion(), updatedCourseVersion),
        ) as CourseVersion;
      } else {
        throw new InternalServerError('Failed to update course version');
      }
    } catch (error) {
      throw new InternalServerError(
        'Failed to update course version.\n More Details: ' + error,
      );
    }
  }
  async deleteVersion(
    courseId: string,
    versionId: string,
    itemGroupsIds: ObjectId[],
    session?: ClientSession,
  ): Promise<DeleteResult | null> {
    await this.init();
    try {
      // 1. Delete course version
      const versionDeleteResult = await this.courseVersionCollection.deleteOne(
        {
          _id: new ObjectId(versionId),
        },
        {session},
      );

      if (versionDeleteResult.deletedCount !== 1) {
        throw new InternalServerError('Failed to delete course version');
      }

      // 2. Remove courseVersionId from the course
      const courseUpdateResult = await this.courseCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {$pull: {versions: versionId}},
        {session},
      );

      if (courseUpdateResult.modifiedCount !== 1) {
        throw new InternalServerError('Failed to update course');
      }

      // 3. Cascade Delete item groups
      const itemDeletionResult = await this.itemsGroupCollection.deleteMany(
        {
          _id: {$in: itemGroupsIds},
        },
        {session},
      );

      if (itemDeletionResult.deletedCount === 0) {
        throw new InternalServerError('Failed to delete item groups');
      }

      // 4. Return the deleted course version
      return versionDeleteResult;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to delete course version.\n More Details: ' + error,
      );
    }
  }

  async deleteSection(
    versionId: string,
    moduleId: string,
    sectionId: string,
    courseVersion: CourseVersion,
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();
    try {
      // Convert versionId and moduleId to ObjectId
      const moduleObjectId = new ObjectId(moduleId);

      // Find the module to delete
      const module = courseVersion.modules.find(m =>
        new ObjectId(m.moduleId).equals(moduleObjectId),
      );

      if (!module) {
        throw new NotFoundError('Module not found');
      }

      // Cascade delete sections and items
      if (module.sections.length > 0) {
        const section = module.sections.find(
          section => section.sectionId === sectionId,
        );
        const itemGroupId = section?.itemsGroupId;

        try {
          const itemDeletionResult = await this.itemsGroupCollection.deleteOne(
            {
              _id: itemGroupId,
            },
            {session},
          );

          if (!itemDeletionResult.acknowledged) {
            throw new InternalServerError('Failed to delete item groups');
          }
        } catch (error) {
          throw new InternalServerError('Item deletion failed');
        }
      } else {
        throw new NotFoundError('Section not found');
      }

      // Remove the section from the course version
      const updatedModules = courseVersion.modules.map(m => {
        if (new ObjectId(m.moduleId).equals(moduleObjectId)) {
          return {
            ...m,
            sections: m.sections.filter(
              s => !new ObjectId(s.sectionId).equals(sectionId),
            ),
          };
        }
        return m;
      });

      const updateResult = await this.courseVersionCollection.updateOne(
        {_id: new ObjectId(versionId)},
        {$set: {modules: updatedModules}},
        {session},
      );

      if (updateResult.modifiedCount !== 1) {
        throw new InternalServerError('Failed to update Section');
      }

      return updateResult;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof InternalServerError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to delete Section.\n More Details: ' + error,
      );
    }
  }

  async deleteModule(
    versionId: string,
    moduleId: string,
    session?: ClientSession,
  ): Promise<boolean | null> {
    await this.init();
    try {
      // Convert versionId and moduleId to ObjectId
      const versionObjectId = new ObjectId(versionId);
      const moduleObjectId = new ObjectId(moduleId);

      // Find the course version
      const courseVersion = await this.courseVersionCollection.findOne(
        {
          _id: versionObjectId,
        },
        {session},
      );

      if (!courseVersion) {
        throw new NotFoundError('Course Version not found');
      }

      // Find the module to delete
      const module = courseVersion.modules.find(m =>
        new ObjectId(m.moduleId).equals(moduleObjectId),
      );

      if (!module) {
        throw new NotFoundError('Module not found');
      }

      // Cascade delete sections and items
      if (module.sections.length > 0) {
        const itemGroupsIds = module.sections.map(
          section => new ObjectId(section.itemsGroupId),
        );

        try {
          const itemDeletionResult = await this.itemsGroupCollection.deleteMany(
            {
              _id: {$in: itemGroupsIds},
            },
            {session},
          );

          if (itemDeletionResult.deletedCount === 0) {
            throw new InternalServerError('Failed to delete item groups');
          }
        } catch (error) {
          throw new InternalServerError('Item deletion failed');
        }
      }

      // Remove the module from the course version
      const updatedModules = courseVersion.modules.filter(
        m => !new ObjectId(m.moduleId).equals(moduleObjectId),
      );

      const updateResult = await this.courseVersionCollection.updateOne(
        {_id: versionObjectId},
        {$set: {modules: updatedModules}},
      );

      if (updateResult.modifiedCount !== 1) {
        throw new InternalServerError('Failed to update course version');
      }

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof InternalServerError) {
        throw error;
      }
      throw new InternalServerError(
        'Failed to delete module.\n More Details: ' + error,
      );
    }
  }
}
