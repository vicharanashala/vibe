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
  Req,
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
  GetItemResponse,
  ItemDataResponse,
  ItemNotFoundErrorResponse,
} from '#courses/classes/index.js';
import {ItemService} from '#courses/services/ItemService.js';
import {ProgressService, USERS_TYPES} from '#users/index.js';
import {COURSES_TYPES} from '#courses/types.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {ResponseSchema} from 'routing-controllers-openapi';

@injectable()
@JsonController('/courses')
export class ItemController {
  constructor(
    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,
    @inject(USERS_TYPES.ProgressService)
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
  @Get('/:courseId/versions/:courseVersionId/item/:itemId')
  @HttpCode(201)
  @ResponseSchema(GetItemResponse, {
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
  async getItem(@Params() params: GetItemParams, @Req() req: any) {
    // console.log(req.headers.authorization)
    const {courseId, courseVersionId, itemId} = params;
    // console.log('Current user:', user);
    // console.log('User ID:', user._id);
    // console.log('User Firebase UID:', user.firebaseUID);
    // const progress = await this.progressService.getUserProgress(
    //   user._id,
    //   courseId,
    //   courseVersionId,
    // );
    // if (progress.currentItem !== itemId) {
    //   throw new ForbiddenError('Item does not match current progress');
    // }
    return {
      item: await this.itemService.readItem(courseVersionId, itemId),
    };
  }
}
