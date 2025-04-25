import {instanceToPlain, plainToInstance} from 'class-transformer';
import 'reflect-metadata';
import {
  Authorized,
  BadRequestError,
  Body,
  Get,
  JsonController,
  Params,
  Post,
  Put,
  Delete,
  HttpError,
  HttpCode,
} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {UpdateError} from 'shared/errors/errors';
import {DeleteError} from 'shared/errors/errors';
import {Inject, Service} from 'typedi';
import {Item, ItemsGroup} from '../classes/transformers/Item';
import {
  CreateItemBody,
  UpdateItemBody,
  MoveItemBody,
  CreateItemParams,
  ReadAllItemsParams,
  UpdateItemParams,
  MoveItemParams,
  DeleteItemParams,
} from '../classes/validators/ItemValidators';
import {calculateNewOrder} from '../utils/calculateNewOrder';

/**
 * Controller for managing items within course modules and sections.
 * Handles operations such as creation, retrieval, update, and reordering.
 *
 * @category Courses/Controllers
 * @categoryDescription
 * Provides endpoints for working with "items" inside sections of modules
 * within course versions. This includes content like videos, blogs, or quizzes.
 */

@JsonController('/courses')
@Service()
export class ItemController {
  constructor(
    @Inject('CourseRepo') private readonly courseRepo: CourseRepository,
  ) {
    if (!this.courseRepo) {
      throw new Error('CourseRepository is not properly injected');
    }
  }

  /**
   * Create a new item under a specific section of a module in a course version.
   *
   * @param params - Route parameters including versionId, moduleId, and sectionId.
   * @param body - The item data to be created.
   * @returns The updated itemsGroup and version.
   *
   * @throws HTTPError(500) on internal errors.
   *
   * @category Courses/Controllers
   */

  @Authorized(['admin'])
  @Post('/versions/:versionId/modules/:moduleId/sections/:sectionId/items')
  @HttpCode(201)
  async create(
    @Params() params: CreateItemParams,
    @Body() body: CreateItemBody,
  ) {
    try {
      const {versionId, moduleId, sectionId} = params;
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find(s => s.sectionId === sectionId);

      //Fetch ItemGroup
      const itemsGroup = plainToInstance(
        ItemsGroup,
        await this.courseRepo.readItemsGroup(section.itemsGroupId.toString()),
      );

      //Create Item
      const newItem = new Item(body, itemsGroup.items);

      //Add Item to ItemsGroup
      itemsGroup.items.push(newItem);

      //Update Section Update Date
      section.updatedAt = new Date();

      //Update Module Update Date
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      const updatedItemsGroup = await this.courseRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
      );

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      return {
        itemsGroup: instanceToPlain(updatedItemsGroup),
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
    }
  }

  /**
   * Retrieve all items from a section of a module in a course version.
   *
   * @param params - Route parameters including versionId, moduleId, and sectionId.
   * @returns The list of items within the section.
   *
   * @throws HTTPError(500) on internal errors.
   *
   * @category Courses/Controllers
   */

  @Authorized(['admin', 'instructor', 'student'])
  @Get('/versions/:versionId/modules/:moduleId/sections/:sectionId/items')
  async readAll(@Params() params: ReadAllItemsParams) {
    try {
      const {versionId, moduleId, sectionId} = params;
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find(s => s.sectionId === sectionId);

      //Fetch Items
      const itemsGroup = await this.courseRepo.readItemsGroup(
        section.itemsGroupId.toString(),
      );

      return {
        itemsGroup: itemsGroup,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
    }
  }

  /**
   * Update an existing item in a section of a module in a course version.
   *
   * @param params - Route parameters including versionId, moduleId, sectionId, and itemId.
   * @param body - Fields to update, including name, description, type, and itemDetails.
   * @returns The updated itemsGroup and version.
   *
   * @throws HTTPError(500) on internal errors.
   *
   * @category Courses/Controllers
   */

  @Authorized(['admin'])
  @Put(
    '/versions/:versionId/modules/:moduleId/sections/:sectionId/items/:itemId',
  )
  async update(
    @Params() params: UpdateItemParams,
    @Body() body: UpdateItemBody,
  ) {
    try {
      const {versionId, moduleId, sectionId, itemId} = params;
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find(s => s.sectionId === sectionId);

      //Fetch ItemsGroup
      const itemsGroup = await this.courseRepo.readItemsGroup(
        section.itemsGroupId.toString(),
      );

      //Find Item
      const item = itemsGroup.items.find(i => i.itemId === itemId);

      //Update Item
      Object.assign(item, body.name ? {name: body.name} : {});
      Object.assign(
        item,
        body.description ? {description: body.description} : {},
      );
      Object.assign(item, body.type ? {type: body.type} : {});

      //Update Item Details
      Object.assign(
        item,
        body.videoDetails
          ? {itemDetails: body.videoDetails}
          : body.blogDetails
            ? {itemDetails: body.blogDetails}
            : body.quizDetails
              ? {itemDetails: body.quizDetails}
              : {},
      );

      //Update Section Update Date
      section.updatedAt = new Date();

      //Update Module Update Date
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update ItemsGroup
      const updatedItemsGroup = await this.courseRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
      );

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      return {
        itemsGroup: instanceToPlain(updatedItemsGroup),
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
    }
  }

  /**
   * Delete an item from a section of a module in a course version.
   * @param params - Route parameters including versionId, moduleId, sectionId, and itemId.
   * @return The updated itemsGroup and version.
   * @throw HTTPError(500) on internal errors.
   * @category Courses/Controllers
   */

  @Authorized(['instructor', 'admin'])
  @Delete('/itemGroups/:itemsGroupId/items/:itemId')
  async delete(@Params() params: DeleteItemParams) {
    try {
      const {itemsGroupId, itemId} = params;

      if (!itemsGroupId || !itemId) {
        throw new DeleteError('Missing required parameters');
      }

      //Fetch ItemsGroup
      const itemsGroup = await this.courseRepo.readItemsGroup(itemsGroupId);
      if (!itemsGroup) {
        throw new DeleteError('ItemsGroup not found');
      }

      const itemToDelete = itemsGroup.items.find(
        i => i.itemId.toString() === itemId,
      );

      if (!itemToDelete) {
        throw new DeleteError('Item not found');
      }

      const deletionStatus = await this.courseRepo.deleteItem(
        itemsGroupId,
        itemId,
      );

      if (!deletionStatus) {
        throw new Error('Unable to delete item');
      }

      const updatedItemsGroup =
        await this.courseRepo.readItemsGroup(itemsGroupId);

      return {
        deletedItem: instanceToPlain(itemToDelete),
        updatedItemsGroup: instanceToPlain(updatedItemsGroup),
      };
    } catch (error) {
      if (error.message === 'Item not found') {
        throw new HttpError(404, error.message);
      }
      if (error.message === 'Missing required parameters') {
        throw new BadRequestError(error.message);
      }
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
    }
  }

  /**
   * Move an item to a new position within a section by recalculating its order.
   *
   * @param params - Route parameters including versionId, moduleId, sectionId, and itemId.
   * @param body - Movement instructions including `afterItemId` or `beforeItemId`.
   * @returns The updated itemsGroup and version.
   *
   * @throws BadRequestError if both afterItemId and beforeItemId are missing.
   * @throws HTTPError(500) on internal errors.
   *
   * @category Courses/Controllers
   */
  @Authorized(['admin'])
  @Put(
    '/versions/:versionId/modules/:moduleId/sections/:sectionId/items/:itemId/move',
  )
  async move(@Params() params: MoveItemParams, @Body() body: MoveItemBody) {
    try {
      const {versionId, moduleId, sectionId, itemId} = params;
      const {afterItemId, beforeItemId} = body;

      if (!afterItemId && !beforeItemId) {
        throw new UpdateError('Either afterItemId or beforeItemId is required');
      }

      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find(s => s.sectionId === sectionId);

      //Fetch ItemsGroup
      const itemsGroup = await this.courseRepo.readItemsGroup(
        section.itemsGroupId.toString(),
      );

      //Find Item
      const item = itemsGroup.items.find(i => i.itemId === itemId);

      //Sort Items based on order
      const sortedItems = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      );

      //Calculate New Order
      const newOrder = calculateNewOrder(
        sortedItems,
        'itemId',
        afterItemId,
        beforeItemId,
      );

      //Update Item Order
      item.order = newOrder;

      //Change the updatedAt dates
      section.updatedAt = new Date();
      module.updatedAt = new Date();
      version.updatedAt = new Date();

      //Update ItemsGroup
      const updatedItemsGroup = await this.courseRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
      );

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      return {
        itemsGroup: instanceToPlain(updatedItemsGroup),
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof UpdateError) {
        throw new BadRequestError(error.message);
      }
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
    }
  }
}
