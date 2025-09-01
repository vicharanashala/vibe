import { injectable, inject } from 'inversify';
import { ClientSession } from 'mongodb';
import { NotFoundError, InternalServerError } from 'routing-controllers';
import { COURSES_TYPES } from '#courses/types.js';
import { CourseVersion } from '#courses/classes/transformers/CourseVersion.js';
import {
  ItemsGroup,
  ItemBase,
  ItemRef,
} from '#courses/classes/transformers/Item.js';
import { Section } from '#courses/classes/transformers/Section.js';
import {
  CreateItemBody,
  UpdateItemBody,
  MoveItemBody,
} from '#courses/classes/validators/ItemValidators.js';
import { calculateNewOrder } from '#courses/utils/calculateNewOrder.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
import { IItemRepository } from '#root/shared/database/interfaces/IItemRepository.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { Module } from '#courses/classes/transformers/Module.js';
import {
  EnrollmentRepository,
  ICourseVersion,
  ItemType,
  ProgressRepository,
} from '#root/shared/index.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { ProgressService } from '#root/modules/users/services/ProgressService.js';

@injectable()
export class ItemService extends BaseService {
  constructor(
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepo: ProgressRepository,
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  private async _getVersionModuleSectionAndItemsGroup(
    versionId: string,
    moduleId: string,
    sectionId: string,
    session?: ClientSession,
  ): Promise<{
    version: CourseVersion;
    module: Module;
    section: Section;
    itemsGroup: ItemsGroup;
  }> {
    const version = (await this.courseRepo.readVersion(
      versionId,
      session,
    )) as CourseVersion;
    if (!version) throw new NotFoundError(`Version ${versionId} not found.`);

    const module = version.modules.find(m => m.moduleId === moduleId);
    if (!module)
      throw new NotFoundError(
        `Module ${moduleId} not found in version ${versionId}.`,
      );

    const section = module.sections.find(s => s.sectionId === sectionId);
    if (!section)
      throw new NotFoundError(
        `Section ${sectionId} not found in module ${moduleId}.`,
      );

    const itemsGroup = await this.itemRepo.readItemsGroup(
      section.itemsGroupId.toString(),
      session,
    );
    if (!itemsGroup) {
      throw new NotFoundError(
        `Items group for section ${sectionId} not found.`,
      );
    }

    return { version, module, section, itemsGroup };
  }

  private async _updateHierarchyAndVersion(
    version: CourseVersion,
    module: { updatedAt: Date },
    section: { updatedAt: Date },
    session?: ClientSession, // Pass session if version update is part of the transaction
  ): Promise<CourseVersion> {
    const now = new Date();
    section.updatedAt = now;
    module.updatedAt = now;
    version.updatedAt = now;

    return (await this.courseRepo.updateVersion(
      version._id.toString(),
      version,
      session,
    )) as CourseVersion; // Assuming version has _id
  }

  //Lets update this api with queue later
  public async createItem(
    versionId: string,
    moduleId: string,
    sectionId: string,
    body: CreateItemBody,
  ) {
    return this._withTransaction(async session => {
      // Step 1: Fetch and validate parent entities
      const { version, module, section, itemsGroup } =
        await this._getVersionModuleSectionAndItemsGroup(
          versionId,
          moduleId,
          sectionId,
          session,
        );

      // Step 2: Create a new item instance
      const item = new ItemBase(body, itemsGroup.items);

      const courseId = version.courseId.toString();

      // Step 3: Run multiple async operations in parallel
      const [
        createdItemDetailsPersistenceResult,
        totalItemsCountIfNeeded,
        enrollments,
      ] = await Promise.all([
        this.itemRepo.createItem(item.itemDetails, session),
        version.totalItems ? Promise.resolve(null) : this.itemRepo.CalculateTotalItemsCount(
          courseId,
          version._id.toString(),
          session,
        ),
        this.enrollmentRepo.getByCourseVersion(courseId, versionId, session),
      ]);

      // Step 3a: Validate creation
      if (!createdItemDetailsPersistenceResult) {
        throw new InternalServerError(
          'Persistence of item-specific details failed in the repository.',
        );
      }
      createdItemDetailsPersistenceResult._id =
        createdItemDetailsPersistenceResult._id.toString();

      // Step 3b: Update totalItems
      version.totalItems = version.totalItems
        ? version.totalItems + 1
        : Math.max(totalItemsCountIfNeeded || 0, 1);

      // Step 4: Update enrollment progress in bulk
      await this.progressService.updateEnrollmentProgressPercentBulk(
        enrollments,
        courseId,
        versionId,
        version.totalItems,
        session,
      );

      // Step 5: Add item to itemsGroup
      const newItemDB = new ItemRef(item);
      newItemDB._id = newItemDB._id.toString();
      itemsGroup.items.push(newItemDB);

      // Step 5b: Persist updated itemsGroup
      const updatedItemsGroupResult = await this.itemRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
        session,
      );

      // Step 6: Update hierarchy timestamps
      const updatedVersion = await this._updateHierarchyAndVersion(
        version,
        module,
        section,
        session,
      );

      return {
        itemsGroup: updatedItemsGroupResult,
        version: updatedVersion,
        createdItem: newItemDB,
      };
    });
  }


  public async readAllItems(
    versionId: string,
    moduleId: string,
    sectionId: string,
  ): Promise<ItemRef[]> {
    const { itemsGroup } = await this._getVersionModuleSectionAndItemsGroup(
      versionId,
      moduleId,
      sectionId,
    );
    return itemsGroup.items;
  }

  public async readItem(versionId: string, itemId: string) {
    const item = await this.itemRepo.readItem(versionId, itemId);
    item._id = item._id.toString();
    return item;
  }

  public async updateItem(
    versionId: string,
    itemId: string,
    body: UpdateItemBody,
  ) {
    return this._withTransaction(async session => {
      // 🔄 Run version and item fetch in parallel
      const [version, item] = await Promise.all([
        this.courseRepo.readVersion(versionId, session),
        this.itemRepo.readItem(versionId, itemId, session),
      ]);

      if (!version) throw new NotFoundError(`Version ${versionId} not found.`);
      if (!item)
        throw new NotFoundError(
          `Item ${itemId} not found in version ${versionId}.`,
        );

      if (item.type !== body.type) {
        throw new InternalServerError(
          `Item type mismatch: expected ${item.type}, got ${body.type}.`,
        );
      }

      const result = await this.itemRepo.updateItem(itemId, body, session);

      version.updatedAt = new Date();
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      if (!updatedVersion) {
        throw new InternalServerError(
          'Failed to update version after item update',
        );
      }

      result._id = result._id.toString();
      return result;
    });
  }


  public async deleteItem(itemsGroupId: string, itemId: string) {
    return this._withTransaction(async session => {
      try {
        // Step 1: Delete item
        const deleted = await this.itemRepo.deleteItem(itemsGroupId, itemId, session);
        if (!deleted) throw new InternalServerError('Item deletion failed');

        // Step 2: Fetch version
        const version = await this.findVersion(itemsGroupId);

        const courseId = version.courseId.toString();
        const versionId = version._id.toString();

        // Step 3: Run in parallel: count total items, delete watch time, get enrollments
        const [totalItems, _, enrollments] = await Promise.all([
          this.itemRepo.CalculateTotalItemsCount(courseId, versionId, session),
          this.progressRepo.deleteWatchTimeByItemId(itemId, session),
          this.enrollmentRepo.getByCourseVersion(courseId, versionId, session),
        ]);

        version.totalItems = totalItems;

        // Step 4: Update progress for all users in parallel
        await Promise.all(
          enrollments.map(enrollment => {
            const userId = enrollment?.userId?.toString();
            return this.progressService.updateEnrollmentProgressPercent(
              userId,
              courseId,
              versionId,
              session,
              false,
              totalItems,
            );
          })
        );

        // Step 5: Update version
        const updatedVersion = await this.courseRepo.updateVersion(
          versionId,
          version,
          session,
        );
        if (!updatedVersion) {
          throw new InternalServerError(
            'Failed to update version after item deletion',
          );
        }

        deleted._id = deleted._id.toString();
        return { deletedItemId: itemId, itemsGroup: deleted };
      } catch (error) {
        throw new InternalServerError(
          `Failed to delete Item after / Error: ${error}`,
        );
      }
    });
  }


  public async moveItem(
    versionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
    body: MoveItemBody,
  ) {
    return this._withTransaction(async session => {
      const { afterItemId, beforeItemId } = body;
      if (!afterItemId && !beforeItemId) {
        throw new Error('Either afterItemId or beforeItemId is required');
      }

      const version = await this.courseRepo.readVersion(versionId, session);
      const module = version.modules.find(m => m.moduleId === moduleId)!;
      const section = module.sections.find(s => s.sectionId === sectionId)!;
      const itemsGroup = await this.itemRepo.readItemsGroup(
        section.itemsGroupId.toString(),
        session,
      );

      const sortedItems = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      );
      const newOrder = calculateNewOrder(
        sortedItems,
        '_id',
        afterItemId,
        beforeItemId,
      );
      const item = itemsGroup.items.find(i => i._id.toString() === itemId)!;
      item.order = newOrder;

      // Sort items by order after updating
      itemsGroup.items.sort((a, b) => a.order.localeCompare(b.order));

      section.updatedAt = new Date();
      module.updatedAt = new Date();
      version.updatedAt = new Date();

      const updatedItemsGroup = await this.itemRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
        session,
      );
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      return { itemsGroup: updatedItemsGroup, version: updatedVersion };
    });
  }

  public async findVersion(itemGroupId: string): Promise<ICourseVersion> {
    const version = await this.courseRepo.findVersionByItemGroupId(itemGroupId);
    if (!version) {
      throw new NotFoundError(
        `Version for item group ${itemGroupId} not found`,
      );
    }
    return version;
  }

  /**
   * Get version and course information from an item ID
   * Combines findItemsGroupIdByItemId and findVersionByItemGroupId
   */
  public async getCourseAndVersionByItemId(itemId: string): Promise<{
    versionId: string;
    courseId: string;
  }> {
    return this._withTransaction(async session => {
      // Step 1: Find itemsGroup containing the item
      const itemsGroup = await this.itemRepo.findItemsGroupByItemId(
        itemId,
        session,
      );
      if (!itemsGroup) {
        throw new NotFoundError(`ItemsGroup for item ${itemId} not found`);
      }
      const itemsGroupId = itemsGroup?._id.toString();
      // Step 2: Find version using existing function
      const version = await this.courseRepo.findVersionByItemGroupId(
        itemsGroupId,
        session,
      );

      if (!version) {
        throw new NotFoundError(`Version for item ${itemId} not found`);
      }

      return {
        courseId: version.courseId.toString(),
        versionId: version._id.toString(),
      };
    });
  }
}
