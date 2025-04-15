import 'reflect-metadata';
import {instanceToPlain} from 'class-transformer';
import {Course} from 'modules/courses/classes/transformers/Course';
import {CourseVersion} from 'modules/courses/classes/transformers/CourseVersion';
import {ItemsGroup} from 'modules/courses/classes/transformers/Item';
import {Collection, ObjectId} from 'mongodb';
import {ICourseRepository} from 'shared/database/interfaces/ICourseRepository';
import {
  CreateError,
  DeleteError,
  ItemNotFoundError,
  ReadError,
  UpdateError,
} from 'shared/errors/errors';
import {ICourse} from 'shared/interfaces/IUser';
import {Service, Inject} from 'typedi';
import {MongoDatabase} from '../MongoDatabase';

@Service()
export class CourseRepository implements ICourseRepository {
  private courseCollection: Collection<Course>;
  private courseVersionCollection: Collection<CourseVersion>;
  private itemsGroupCollection: Collection<ItemsGroup>;

  constructor(@Inject(() => MongoDatabase) private db: MongoDatabase) {}

  private async init() {
    this.courseCollection = await this.db.getCollection<Course>('newCourse');
    this.courseVersionCollection =
      await this.db.getCollection<CourseVersion>('newCourseVersion');
    this.itemsGroupCollection =
      await this.db.getCollection<ItemsGroup>('itemsGroup');
  }
  async create(course: Course): Promise<Course | null> {
    await this.init();
    try {
      const result = await this.courseCollection.insertOne(course);
      if (result.acknowledged) {
        const newCourse = await this.courseCollection.findOne({
          _id: result.insertedId,
        });
        return instanceToPlain(
          Object.assign(new Course(), newCourse),
        ) as Course;
      } else {
        throw new CreateError('Failed to create course');
      }
    } catch (error) {
      throw new CreateError(
        'Failed to create course.\n More Details: ' + error,
      );
    }
  }
  async read(id: string): Promise<ICourse | null> {
    await this.init();
    try {
      const course = await this.courseCollection.findOne({
        _id: new ObjectId(id),
      });
      if (course === null) {
        throw new ItemNotFoundError('Course not found');
      }
      return instanceToPlain(Object.assign(new Course(), course)) as Course;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw error;
      }
      throw new ReadError('Failed to read course.\n More Details: ' + error);
    }
  }
  async update(id: string, course: Partial<ICourse>): Promise<ICourse | null> {
    await this.init();
    try {
      await this.read(id);

      const {_id: _, ...fields} = course;
      const result = await this.courseCollection.updateOne(
        {_id: new ObjectId(id)},
        {$set: fields},
      );
      if (result.modifiedCount === 1) {
        const updatedCourse = await this.courseCollection.findOne({
          _id: new ObjectId(id),
        });
        return instanceToPlain(
          Object.assign(new Course(), updatedCourse),
        ) as Course;
      } else {
        throw new UpdateError('Failed to update course');
      }
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw error;
      }
      throw new UpdateError(
        'Failed to update course.\n More Details: ' + error,
      );
    }
  }
  async delete(id: string): Promise<boolean> {
    console.log('delete course', id);
    throw new Error('Method not implemented.');
  }
  async createVersion(
    courseVersion: CourseVersion,
  ): Promise<CourseVersion | null> {
    await this.init();
    try {
      const result =
        await this.courseVersionCollection.insertOne(courseVersion);
      if (result.acknowledged) {
        const newCourseVersion = await this.courseVersionCollection.findOne({
          _id: result.insertedId,
        });

        return instanceToPlain(
          Object.assign(new CourseVersion(), newCourseVersion),
        ) as CourseVersion;
      } else {
        throw new CreateError('Failed to create course version');
      }
    } catch (error) {
      throw new CreateError(
        'Failed to create course version.\n More Details: ' + error,
      );
    }
  }
  async readVersion(versionId: string): Promise<CourseVersion | null> {
    await this.init();
    try {
      const courseVersion = await this.courseVersionCollection.findOne({
        _id: new ObjectId(versionId),
      });

      if (courseVersion === null) {
        throw new ItemNotFoundError('Course Version not found');
      }

      return instanceToPlain(
        Object.assign(new CourseVersion(), courseVersion),
      ) as CourseVersion;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw error;
      }
      throw new ReadError(
        'Failed to read course version.\n More Details: ' + error,
      );
    }
  }
  async updateVersion(
    versionId: string,
    courseVersion: CourseVersion,
  ): Promise<CourseVersion | null> {
    await this.init();
    try {
      const {_id: _, ...fields} = courseVersion;
      const result = await this.courseVersionCollection.updateOne(
        {_id: new ObjectId(versionId)},
        {$set: fields},
      );
      if (result.modifiedCount === 1) {
        const updatedCourseVersion = await this.courseVersionCollection.findOne(
          {
            _id: new ObjectId(versionId),
          },
        );
        return instanceToPlain(
          Object.assign(new CourseVersion(), updatedCourseVersion),
        ) as CourseVersion;
      } else {
        throw new UpdateError('Failed to update course version');
      }
    } catch (error) {
      throw new UpdateError(
        'Failed to update course version.\n More Details: ' + error,
      );
    }
  }
  async createItemsGroup(itemsGroup: ItemsGroup): Promise<ItemsGroup | null> {
    await this.init();
    try {
      const result = await this.itemsGroupCollection.insertOne(itemsGroup);
      if (result) {
        console.log('Items created', result.insertedId);
        const newItems = await this.itemsGroupCollection.findOne({
          _id: result.insertedId,
        });
        return instanceToPlain(
          Object.assign(new ItemsGroup(), newItems),
        ) as ItemsGroup;
      } else {
        throw new CreateError('Failed to create items');
      }
    } catch (error) {
      throw new CreateError('Failed to create items.\n More Details: ' + error);
    }
  }
  async readItemsGroup(itemsGroupId: string): Promise<ItemsGroup | null> {
    await this.init();
    try {
      const items = await this.itemsGroupCollection.findOne({
        _id: new ObjectId(itemsGroupId),
      });
      return instanceToPlain(
        Object.assign(new ItemsGroup(), items),
      ) as ItemsGroup;
    } catch (error) {
      throw new ReadError('Failed to read items.\n More Details: ' + error);
    }
  }

  async deleteItem(itemGroupsId: string, itemId: string): Promise<boolean> {
    await this.init();
    try {
      const result = await this.itemsGroupCollection.updateOne(
        {_id: new ObjectId(itemGroupsId)},
        {$pull: {items: {itemId: new ObjectId(itemId)}}},
      );
      if (result.modifiedCount === 1) {
        return true;
      } else {
        throw new DeleteError('Failed to delete item');
      }
    } catch (error) {
      throw new DeleteError('Failed to delete item.\n More Details: ' + error);
    }
  }

  async updateItemsGroup(
    itemsGroupId: string,
    itemsGroup: ItemsGroup,
  ): Promise<ItemsGroup | null> {
    await this.init();
    try {
      const {_id: _, ...fields} = itemsGroup;
      const result = await this.itemsGroupCollection.updateOne(
        {_id: new ObjectId(itemsGroupId)},
        {$set: fields},
      );
      if (result.modifiedCount === 1) {
        const updatedItems = await this.itemsGroupCollection.findOne({
          _id: new ObjectId(itemsGroupId),
        });
        return instanceToPlain(
          Object.assign(new ItemsGroup(), updatedItems),
        ) as ItemsGroup;
      } else {
        throw new UpdateError('Failed to update items');
      }
    } catch (error) {
      throw new UpdateError('Failed to update items.\n More Details: ' + error);
    }
  }
}
