import 'reflect-metadata';
import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Params,
  Post,
  Put,
  Req,
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
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {AUTH_TYPES} from '#root/modules/auth/types.js';
import {ProgressService} from '#root/modules/users/services/ProgressService.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {injectable, inject} from 'inversify';
import {VersionModuleSectionParams} from '../classes/index.js';

@injectable()
@JsonController('/courses')
export class ItemController {
  constructor(
    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,
    @inject(AUTH_TYPES.AuthService)
    private readonly authService: FirebaseAuthService,
  ) {}
  @OpenAPI({
    summary: 'Create an item',
    description: `Creates a new item within a section.
  Accessible to:
  - Instructors, managers or teaching assistants of the course.`,
  })
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
    @Params() params: VersionModuleSectionParams,
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

  @OpenAPI({
    summary: 'Get all item references in a section',
    description: `Retrieves a list of item references from a specific section. Each reference includes only the item's \`_id\`, \`type\`, and \`order\`, without full item details.<br/>
  Accessible to:
  - All users who are part of the course.`,
  })
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
  async readAll(@Params() params: VersionModuleSectionParams) {
    const {versionId, moduleId, sectionId} = params;
    return await this.itemService.readAllItems(versionId, moduleId, sectionId);
  }

  @OpenAPI({
    summary: 'Update an item',
    description: `Updates the configuration or content of a specific item within a section.<br/>
  Accessible to:
  - Instructors, managers, and teaching assistants of the course.`,
  })
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
    @Params() params: VersionModuleSectionItemParams,
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

  @OpenAPI({
    summary: 'Delete an item',
    description: `Deletes a specific item from a section.<br/>
  Accessible to:
  - Instructors or managers of the course.`,
  })
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

  @OpenAPI({
    summary: 'Reorder an item',
    description: `Changes the position of an item within a section of a course version.<br/>
Accessible to:
- Instructors, managers, and teaching assistants of the course.`,
  })
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
  async move(
    @Params() params: VersionModuleSectionItemParams,
    @Body() body: MoveItemBody,
  ) {
    const {versionId, moduleId, sectionId, itemId} = params;
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
  @Authorized(['admin', 'instructor', 'student'])
  @Get('/:courseId/versions/:courseVersionId/item/:itemId')
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
  async getItem(@Params() params: GetItemParams, @Req() req: any) {
    const {courseId, courseVersionId, itemId} = params;
    const userId = await this.authService.getUserIdFromReq(req);
    const progress = await this.progressService.getUserProgress(
      userId,
      courseId,
      courseVersionId,
    );
    console.log(progress.currentItem);
    if (progress.currentItem.toString() !== itemId) {
      throw new ForbiddenError('Item does not match current progress');
    }
    return {
      item: await this.itemService.readItem(courseVersionId, itemId),
    };
  }
}
