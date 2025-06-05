import 'reflect-metadata';
import {
  JsonController,
  Authorized,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Params,
  HttpCode,
  CurrentUser,
  ForbiddenError,
} from 'routing-controllers';
import {inject, injectable} from 'inversify';
import {
  CreateItemBody,
  UpdateItemBody,
  MoveItemBody,
  CreateItemParams,
  ReadAllItemsParams,
  UpdateItemParams,
  MoveItemParams,
  DeleteItemParams,
  DeletedItemResponse,
  GetItemParams,
} from '../classes/validators/ItemValidators.js';
import {ItemService} from '../services/index.js';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {BadRequestErrorResponse} from '../../../shared/middleware/errorHandler.js';
import {
  ItemDataResponse,
  ItemNotFoundErrorResponse,
} from '../classes/validators/ItemValidators.js';
import {IUser} from '#root/shared/interfaces/models.js';
import {ProgressService} from '#root/modules/users/services/ProgressService.js';
import TYPES from '../types.js';
import USER_TYPES from '#root/modules/users/types.js';
@injectable()
@JsonController('/courses')
export class ItemController {
  constructor(
    @inject(TYPES.ItemService) private readonly itemService: ItemService,
    @inject(USER_TYPES.ProgressService)
    private readonly progressService: ProgressService,
  ) {}

  @Authorized(['admin'])
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
    @Params() params: CreateItemParams,
    @Body() body: CreateItemBody,
  ) {
    const {versionId, moduleId, sectionId} = params;
    return await this.itemService.createItem(
      versionId,
      moduleId,
      sectionId,
      body,
    );
  }

  @Authorized(['admin', 'instructor', 'student'])
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
  async readAll(@Params() params: ReadAllItemsParams) {
    const {versionId, moduleId, sectionId} = params;
    return await this.itemService.readAllItems(versionId, moduleId, sectionId);
  }

  @Authorized(['admin'])
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
    @Params() params: UpdateItemParams,
    @Body() body: UpdateItemBody,
  ) {
    const {versionId, moduleId, sectionId, itemId} = params;
    return await this.itemService.updateItem(
      versionId,
      moduleId,
      sectionId,
      itemId,
      body,
    );
  }

  @Authorized(['instructor', 'admin'])
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
  async delete(@Params() params: DeleteItemParams) {
    const {itemsGroupId, itemId} = params;
    return await this.itemService.deleteItem(itemsGroupId, itemId);
  }

  @Authorized(['admin'])
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
  async move(@Params() params: MoveItemParams, @Body() body: MoveItemBody) {
    const {versionId, moduleId, sectionId, itemId} = params;
    return await this.itemService.moveItem(
      versionId,
      moduleId,
      sectionId,
      itemId,
      body,
    );
  }

  @Authorized(['admin', 'instructor', 'student'])
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
  async getItem(@CurrentUser() user: IUser, @Params() params: GetItemParams) {
    const {courseId, courseVersionId, itemId} = params;
    const progress = await this.progressService.getUserProgress(
      user._id,
      courseId,
      courseVersionId,
    );
    if (progress.currentItem !== itemId) {
      throw new ForbiddenError('Item does not match current progress');
    }
    return await this.itemService.readItem(courseVersionId, itemId);
  }
}
