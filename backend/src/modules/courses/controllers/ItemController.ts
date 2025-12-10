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
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { COURSES_TYPES } from '#courses/types.js';
import { BadRequestErrorResponse } from '#shared/middleware/errorHandler.js';
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
  VersionItemParams,
  GetFeedbackSubmissionsParams,
  GetFeedbackSubmissionsQuery,
} from '#courses/classes/validators/ItemValidators.js';
import { ItemService } from '#courses/services/ItemService.js';
import { injectable, inject } from 'inversify';
import { VersionModuleSectionParams } from '../classes/index.js';
import { ItemActions, getItemAbility } from '../abilities/itemAbilities.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';
import { QuizService } from '#root/modules/quizzes/services/QuizService.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import { ItemType } from '#shared/interfaces/models.js';
import { ObjectId } from 'mongodb';

@OpenAPI({
  tags: ['Course Items'],
})
@injectable()
@JsonController('/courses')
export class ItemController {
  constructor(
    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,
    @inject(QUIZZES_TYPES.QuizService)
    private readonly quizService: QuizService,
  ) { }
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
    @Ability(getItemAbility) { ability },
  ) {
    const { versionId, moduleId, sectionId } = params;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Create, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to create items in this section',
      );
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
    @Ability(getItemAbility) { ability },
  ) {
    const { versionId, moduleId, sectionId } = params;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.ViewAll, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to view items in this section',
      );
    }

    const items = await this.itemService.readAllItems(versionId, moduleId, sectionId);

    // Filter out blank quizzes for students
    try {
      const sampleItemResource = subject('Item', { versionId, _id: 'sample' });
      const canManage = ability.can(ItemActions.Modify, sampleItemResource);

      console.log('ItemController filtering - canManage:', canManage, 'items count:', items.length);

      if (canManage) {
        // Instructors/managers/TAs can see all items including blank quizzes
        console.log('User can manage - showing all items');
        return items;
      }

      // For students: filter out blank quizzes with conservative approach
      const filteredItems = [];

      for (const itemRef of items) {
        if (itemRef.type !== ItemType.QUIZ) {
          filteredItems.push(itemRef);
          continue;
        }

        try {
          const quizDetails = await this.quizService.getQuizDetails(itemRef._id.toString());
          const questionBankRefs = quizDetails?.details?.questionBankRefs;


          if (!(Array.isArray(questionBankRefs) && questionBankRefs.length === 0)) {
            filteredItems.push(itemRef);
          }
        } catch (error) {
          filteredItems.push(itemRef);
        }
      }

      return filteredItems;

    } catch (error) {
      console.error('Error filtering blank quizzes in readAll:', error);
      return items;
    }
  }

  @OpenAPI({
    summary: 'Update an item',
    description: `Updates the configuration or content of a specific item within a section.<br/>
  Accessible to:
  - Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @Put('/versions/:versionId/items/:itemId')
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
    @Params() params: VersionItemParams,
    @Body() body: UpdateItemBody,
    @Ability(getItemAbility) { ability },
  ) {
    const { versionId, itemId } = params;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    return await this.itemService.updateItem(versionId, itemId, body);
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
    @Ability(getItemAbility) { ability },
  ) {
    const { itemsGroupId, itemId } = params;
    const version = await this.itemService.findVersion(itemsGroupId);
    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: version._id.toString() });

    if (!ability.can(ItemActions.Delete, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to delete this item',
      );
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
    @Ability(getItemAbility) { ability },
  ) {
    const { versionId, moduleId, sectionId, itemId } = params;

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
    @Ability(getItemAbility) { ability },
  ) {
    const { versionId, itemId, courseId } = params;

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

  async submitProject(): Promise<void> { }



  @OpenAPI({
    summary: 'Get feedback submissions',
    description: `Get the feedback submissions of a particular course item`,
  })
  @Authorized()
  @Get('/:courseId/item/:feedbackId/feedback/submissions')
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
  async getFeedackSubmissions(
    @Params() params: GetFeedbackSubmissionsParams,
    @QueryParams() query: GetFeedbackSubmissionsQuery
    // @Ability(getItemAbility) { ability },
  ) {
    const { courseId, feedbackId } = params;
    const { search = '', page = 1, limit = 1 } = query
    return await this.itemService.getFeedbackSubmissions(courseId, feedbackId, search, Number(page), Number(limit))
  }

  // Add to ItemController.ts

  @OpenAPI({
    summary: 'Update item optional status',
    description: `Updates the optional status of a specific item.
Accessible to:
- Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @HttpCode(200)
  @Put('/versions/:versionId/items/:itemId/optional')
  @ResponseSchema(ItemDataResponse, {
    description: 'Item optional status updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async updateOptionalStatus(
    @Params() params: VersionItemParams,
    @Body() body: { isOptional: boolean },
    @Ability(getItemAbility) { ability },
  ) {
    const { versionId, itemId } = params;
    // Check permission
    const itemResource = subject('Item', { versionId:versionId });
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    return await this.itemService.updateItemOptionalStatus(versionId, itemId, body.isOptional);
  }

}

