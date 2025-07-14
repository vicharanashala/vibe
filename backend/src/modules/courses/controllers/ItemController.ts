import 'reflect-metadata';
import {
  Body,
  Delete,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Params,
  Post,
  Put,
  Authorized,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {COURSES_TYPES} from '#courses/types.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {
  ItemDataResponse,
  ItemNotFoundErrorResponse,
  CreateItemBody,
  UpdateItemBody,
  DeletedItemResponse,
  DeleteItemParams,
  MoveItemBody,
  GetItemParams,
  VersionModuleSectionItemParams,
} from '#courses/classes/validators/ItemValidators.js';
import {ItemService} from '#courses/services/ItemService.js';
import {injectable, inject} from 'inversify';
import {VersionModuleSectionParams} from '../classes/index.js';
import { ItemActions, getItemAbility } from '../abilities/itemAbilities.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';

@injectable()
@JsonController('/courses')
export class ItemController {
  constructor(
    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,
  ) {}
  @OpenAPI({
    summary: 'Create an item',
    description: `Creates a new item within a section.
  Accessible to:
  - Instructors, managers or teaching assistants of the course.`,
  })
  @Authorized()
  @Post('/versions/:versionId/modules/:moduleId/sections/:sectionId/items')
  @HttpCode(201)
  @ResponseSchema(ItemDataResponse, {
    description: 'Item created successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async create(
    @Params() params: VersionModuleSectionParams,
    @Body() body: CreateItemBody,
    @Ability(getItemAbility) {ability}
  ) {
    const {versionId, moduleId, sectionId} = params;
    
    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId });
    
    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Create, itemResource)) {
      throw new ForbiddenError('You do not have permission to create items in this section');
    }
    
    return await this.itemService.createItem(
      versionId,
      moduleId,
      sectionId,
      body,
    );
  }

  @OpenAPI({
    summary: 'Get all item references in a section',
    description: `Retrieves a list of item references from a specific section. Each reference includes only the item's \`_id\`, \`type\`, and \`order\`, without full item details.<br/>
  Accessible to:
  - All users who are part of the course.`,
  })
  @Authorized()
  @Get('/versions/:versionId/modules/:moduleId/sections/:sectionId/items')
  @ResponseSchema(ItemDataResponse, {
    description: 'Items retrieved successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async readAll(
    @Params() params: VersionModuleSectionParams,
    @Ability(getItemAbility) {ability}
  ) {
    const {versionId, moduleId, sectionId} = params;
    
    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId });
    
    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.ViewAll, itemResource)) {
      throw new ForbiddenError('You do not have permission to view items in this section');
    }
    
    return await this.itemService.readAllItems(versionId, moduleId, sectionId);
  }

  @OpenAPI({
    summary: 'Update an item',
    description: `Updates the configuration or content of a specific item within a section.<br/>
  Accessible to:
  - Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @Put(
    '/versions/:versionId/modules/:moduleId/sections/:sectionId/items/:itemId',
  )
  @ResponseSchema(ItemDataResponse, {
    description: 'Item updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async update(
    @Params() params: VersionModuleSectionItemParams,
    @Body() body: UpdateItemBody,
    @Ability(getItemAbility) {ability}
  ) {
    const {versionId, moduleId, sectionId, itemId} = params;
    
    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId });
    
    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError('You do not have permission to modify this item');
    }
    
    return await this.itemService.updateItem(
      versionId,
      moduleId,
      sectionId,
      itemId,
      body,
    );
  }

  @OpenAPI({
    summary: 'Delete an item',
    description: `Deletes a specific item from a section.<br/>
  Accessible to:
  - Instructors or managers of the course.`,
  })
  @Authorized()
  @Delete('/itemGroups/:itemsGroupId/items/:itemId')
  @ResponseSchema(DeletedItemResponse, {
    description: 'Item deleted successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async delete(
    @Params() params: DeleteItemParams,
    @Ability(getItemAbility) {ability}
  ) {
    const {itemsGroupId, itemId} = params;
    const version = await this.itemService.findVersion(itemsGroupId);
    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: version._id.toString() });
    
    if (!ability.can(ItemActions.Delete, itemResource)) {
      throw new ForbiddenError('You do not have permission to delete this item');
    }
    
    return await this.itemService.deleteItem(itemsGroupId, itemId);
  }

  @OpenAPI({
    summary: 'Reorder an item',
    description: `Changes the position of an item within a section of a course version.<br/>
Accessible to:
- Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @Put(
    '/versions/:versionId/modules/:moduleId/sections/:sectionId/items/:itemId/move',
  )
  @ResponseSchema(ItemDataResponse, {
    description: 'Item moved successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async move(
    @Params() params: VersionModuleSectionItemParams,
    @Body() body: MoveItemBody,
    @Ability(getItemAbility) {ability}
  ) {
    const {versionId, moduleId, sectionId, itemId} = params;
    
    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId });
    
    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError('You do not have permission to move this item');
    }
    
    return await this.itemService.moveItem(
      versionId,
      moduleId,
      sectionId,
      itemId,
      body,
    );
  }

  @OpenAPI({
    summary: 'Get an item by ID',
    description: `Retrieves a specific item from a course version.<br/>
Access control logic:
- For students: The item is returned only if it matches the student's current item ID in their course progress.
- For instructors, managers, and teaching assistants: The item is accessible without this restriction.`,
  })
  @Authorized()
  @Get('/:courseId/versions/:versionId/item/:itemId')
  @HttpCode(201)
  @ResponseSchema(ItemDataResponse, {
    description: 'Item retrieved successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async getItem(
    @Params() params: GetItemParams,
    @Ability(getItemAbility) {ability}
  ) {
    const {versionId, itemId, courseId} = params;
    
    // Create an item resource object for permission checking
    const itemResource = subject('Item', { courseId, versionId, itemId });
    
    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.View, itemResource)) {
      throw new ForbiddenError('You do not have permission to view this item');
    }
    
    return {
      item: await this.itemService.readItem(versionId, itemId),
    };
  }
}
