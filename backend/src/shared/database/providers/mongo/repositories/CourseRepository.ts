import 'reflect-metadata';
import {instanceToPlain} from 'class-transformer';
import {Course} from 'modules/courses/classes/transformers/Course';
import {CourseVersion} from 'modules/courses/classes/transformers/CourseVersion';
import {Item, ItemsGroup} from 'modules/courses/classes/transformers/Item';
import {Collection, ObjectId} from 'mongodb';
import {ICourseRepository} from 'shared/database/interfaces/ICourseRepository';
import {
  CreateError,
  DeleteError,
  ReadError,
  UpdateError,
} from 'shared/errors/errors';
import {
  ICourse,
  IModule,
  IEnrollment,
  IProgress,
} from 'shared/interfaces/Models';
import {Service, Inject} from 'typedi';
import {MongoDatabase} from '../MongoDatabase';
import {NotFoundError} from 'routing-controllers';

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
        return Object.assign(new Course(), newCourse) as Course;
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
        throw new NotFoundError('Course not found');
      }
      return instanceToPlain(Object.assign(new Course(), course)) as Course;
    } catch (error) {
      if (error instanceof NotFoundError) {
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
      if (error instanceof NotFoundError) {
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
        throw new NotFoundError('Course Version not found');
      }

      return instanceToPlain(
        Object.assign(new CourseVersion(), courseVersion),
      ) as CourseVersion;
    } catch (error) {
      if (error instanceof NotFoundError) {
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
  async deleteVersion(
    courseId: string,
    versionId: string,
  ): Promise<CourseVersion | null> {
    await this.init();
    try {
      // 1. find the course version to Delete.
      const courseVersion = await this.courseVersionCollection.findOne({
        _id: new ObjectId(versionId),
      });

      const course = await this.courseCollection.findOne({
        _id: new ObjectId(courseId),
      });

      if (!course) {
        throw new NotFoundError('Course not found');
      }

      // 2. check if the course version exists.
      if (!courseVersion) {
        throw new NotFoundError('Course Version not found');
      }

      // 3. Extract itemGroupsIds before deleting the course version.
      const itemGroupsIds = courseVersion.modules.flatMap(module =>
        module.sections.map(section => new ObjectId(section.itemsGroupId)),
      );

      // 4. Delete course version
      const versionDeleteResult = await this.courseVersionCollection.deleteOne({
        _id: new ObjectId(versionId),
      });

      if (versionDeleteResult.deletedCount !== 1) {
        throw new DeleteError('Failed to delete course version');
      }

      // 5. Remove courseVersionId from the course

      const courseUpdateResult = await this.courseCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {$pull: {versions: versionId}},
      );

      if (courseUpdateResult.modifiedCount !== 1) {
        throw new DeleteError('Failed to update course');
      }

      // 6. Cascade Delete item groups

      const itemDeletionResult = await this.itemsGroupCollection.deleteMany({
        _id: {$in: itemGroupsIds},
      });

      if (itemDeletionResult.deletedCount === 0) {
        throw new DeleteError('Failed to delete item groups');
      }

      // 7. Return the deleted course version
      return courseVersion;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DeleteError(
        'Failed to delete course version.\n More Details: ' + error,
      );
    }
  }
  async createItemsGroup(itemsGroup: ItemsGroup): Promise<ItemsGroup | null> {
    await this.init();
    try {
      const result = await this.itemsGroupCollection.insertOne(itemsGroup);
      if (result) {
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
  async readItem(courseVersionId: string, itemId: string): Promise<Item> {
    await this.init();
    const courseVersion = await this.readVersion(courseVersionId);
    const itemGroupsIds = courseVersion.modules.flatMap(module =>
      module.sections.map(section => section.itemsGroupId),
    );

    // Find the item in the items groups
    for (const itemGroupId of itemGroupsIds) {
      const itemsGroup = await this.readItemsGroup(itemGroupId.toString());
      const item = itemsGroup.items.find(
        item => item.itemId.toString() === itemId,
      );
      if (!item) {
        continue;
      } else {
        return item;
      }
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

  async deleteModule(
    versionId: string,
    moduleId: string,
  ): Promise<boolean | null> {
    await this.init();
    try {
      // Convert versionId and moduleId to ObjectId
      const versionObjectId = new ObjectId(versionId);
      const moduleObjectId = new ObjectId(moduleId);

      // Find the course version
      const courseVersion = await this.courseVersionCollection.findOne({
        _id: versionObjectId,
      });

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
          );

          if (itemDeletionResult.deletedCount === 0) {
            throw new DeleteError('Failed to delete item groups');
          }
        } catch (error) {
          throw new DeleteError('Item deletion failed');
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
        throw new DeleteError('Failed to update course version');
      }

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof DeleteError) {
        throw error;
      }
      throw new DeleteError(
        'Failed to delete module.\n More Details: ' + error,
      );
    }
  }
  async getFirstOrderItems(courseVersionId: string): Promise<{
    moduleId: ObjectId;
    sectionId: ObjectId;
    itemId: ObjectId;
  }> {
    await this.init();
    try {
      const version = await this.readVersion(courseVersionId);
      if (!version || !version.modules || version.modules.length === 0) {
        throw new ReadError('Course version has no modules');
      }

      // Sort modules by order and get first
      const sortedModules = version.modules.sort((a, b) =>
        a.order.localeCompare(b.order),
      );
      const firstModule = sortedModules[0];

      if (!firstModule.sections || firstModule.sections.length === 0) {
        throw new ReadError('Module has no sections');
      }

      // Sort sections by order and get first
      const sortedSections = firstModule.sections.sort((a, b) =>
        a.order.localeCompare(b.order),
      );
      const firstSection = sortedSections[0];

      if (!firstSection.itemsGroupId) {
        throw new ReadError('Section has no items group');
      }

      // Get items for first section
      const itemsGroup = await this.readItemsGroup(
        firstSection.itemsGroupId.toString(),
      );

      if (!itemsGroup || !itemsGroup.items || itemsGroup.items.length === 0) {
        throw new ReadError('Items group has no items');
      }

      // Sort items by order and get first
      const sortedItems = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      );
      const firstItem = sortedItems[0];

      return {
        moduleId: new ObjectId(firstModule.moduleId),
        sectionId: new ObjectId(firstSection.sectionId),
        itemId: new ObjectId(firstItem.itemId),
      };
    } catch (error) {
      throw new ReadError(
        'Failed to get first order items.\n More Details: ' + error,
      );
    }
  }
}
