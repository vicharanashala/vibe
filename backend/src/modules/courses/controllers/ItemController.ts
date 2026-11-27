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
  Res,
  CurrentUser,
  UseInterceptor,
  Req,
  BadRequestError,
  QueryParam,
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
  VersionItemParams,
  ItemProctoringParams,
  ItemProctoringBody,
  GetFeedbackSubmissionsParams,
  GetFeedbackSubmissionsQuery,
  GetFeedbackSummaryQuery,
  FeedbackExportQuery,
  CourseVersionFeedbackParams,
  UpdateFeedbackSettingsBody,
  CSVItemBody,
  CourseVersionModuleSectionParams,
  csvResponse,
  VideoOverallAnalytics,
  GetVideoAnalyticsParams,
  VideoUserAnalyticsQuery,
  VideoUserAnalytics,
  VideoUserAnalyticsResponse,
} from '#courses/classes/validators/ItemValidators.js';
import {ItemService} from '#courses/services/ItemService.js';
import {injectable, inject} from 'inversify';
import {VersionModuleSectionParams} from '../classes/index.js';
import {ItemActions, getItemAbility} from '../abilities/itemAbilities.js';
import {getContainer} from '#root/bootstrap/loadModules.js';
import {SETTING_TYPES} from '#root/modules/setting/types.js';
import type {SettingRepository} from '#root/shared/database/providers/mongo/repositories/SettingRepository.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {subject} from '@casl/ability';
import {
  EnrollmentActions,
  getEnrollmentAbility,
} from '#root/modules/users/abilities/enrollmentAbilities.js';
import {
  CohortScopeService,
  cohortScopeIds,
} from '#root/shared/functions/cohortScope.js';
import type {AuthenticatedUser} from '#root/shared/interfaces/models.js';
import {
  FeedbackExportService,
  exportFileName,
  toCsv,
} from '#courses/services/FeedbackExportService.js';
import {writeXlsx} from '#courses/utils/xlsxWriter.js';

const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Sends a download with a file name that survives non-ASCII course names. */
function sendFile(
  res: Response,
  body: string | Buffer,
  type: string,
  name: string,
) {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  res.setHeader('Content-Type', type);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
  );
  res.setHeader('Cache-Control', 'no-cache');
  return res.send(body);
}
import {
  ItemStudyModeResponse,
  StudyModeBody,
} from '../classes/validators/StudyModeValidators.js';
import {
  ContentLockBody,
  ItemContentLockResponse,
} from '../classes/validators/ContentLockValidators.js';
import {QuizService} from '#root/modules/quizzes/services/QuizService.js';
import {QUIZZES_TYPES} from '#root/modules/quizzes/types.js';
import {ItemType, IUser, IDetectorSettings} from '#shared/interfaces/models.js';
import {HideModuleBody} from '../classes/index.js';
import {Response} from 'express';
import {AuditTrailsHandler} from '#root/shared/middleware/auditTrails.js';
import {
  AuditAction,
  AuditCategory,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import {setAuditTrail} from '#root/utils/setAuditTrail.js';
import {ObjectId} from 'mongodb';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {USERS_TYPES} from '#root/modules/users/types.js';

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
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(CohortScopeService)
    private readonly cohortScopeService: CohortScopeService,
    @inject(COURSES_TYPES.FeedbackExportService)
    private readonly feedbackExportService: FeedbackExportService,
  ) {}
  @OpenAPI({
    summary: 'Create an item',
    description: `Creates a new item within a section.
  Accessible to:
  - Instructors, managers or teaching assistants of the course.`,
  })
  @Authorized()
  @Post('/versions/:versionId/modules/:moduleId/sections/:sectionId/items')
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getItemAbility) {ability, user},
    @Req() req: Request,
  ) {
    const {versionId, moduleId, sectionId} = params;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', {versionId});

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Create, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to create items in this section',
      );
    }

    const result = await this.itemService.createItem(
      versionId,
      moduleId,
      sectionId,
      body,
    );
    await this.enrollmentService.flagNewItemsForCompletedStudents(versionId);

    const createdItem = result.createdItem;

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_ADD,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        sectionId: ObjectId.createFromHexString(sectionId),
        relatedIds: {
          afterItemId: body.afterItemId
            ? ObjectId.createFromHexString(body.afterItemId)
            : null,
          beforeItemId: body.beforeItemId
            ? ObjectId.createFromHexString(body.beforeItemId)
            : null,
        },
      },
      changes: {
        after: {
          itemId: createdItem._id,
          title: body.name,
          description: body.description,
          type: body.type,
          videoDetails: body.videoDetails,
          quizDetails: body.quizDetails,
          blogDetails: body.blogDetails,
          feedbackDetails: body.feedbackFormDetails,
          isOptional: body.isOptional,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });
    return result;
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
  async readAll( // change according to cohort
    @Params() params: VersionModuleSectionParams,
    @Ability(getItemAbility) { ability, user },
    @QueryParam('cohortId') cohortId?: string,
  ) {
    const {versionId, moduleId, sectionId} = params;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', {versionId});

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.ViewAll, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to view items in this section',
      );
    }

    const items = await this.itemService.readAllItems(
      versionId,
      moduleId,
      sectionId,
      user._id,
      cohortId
    );

    // Filter out blank quizzes for students
    try {
      const sampleItemResource = subject('Item', {versionId, _id: 'sample'});
      const canManage = ability.can(ItemActions.Modify, sampleItemResource);

      if (canManage) {
        // Instructors/managers/TAs can see all items including blank quizzes
        return items;
      }

      // For students: filter out blank quizzes with conservative approach
      // const filteredItems = [];

      // for (const itemRef of items) {
      //   if (itemRef.type !== ItemType.QUIZ) {
      //     filteredItems.push(itemRef);
      //     continue;
      //   }

      //   try {
      //     const quizDetails = await this.quizService.getQuizDetails(
      //       itemRef?._id?.toString(),
      //     );
      //     const questionBankRefs = quizDetails?.details?.questionBankRefs;

      //     if (
      //       !(Array.isArray(questionBankRefs) && questionBankRefs.length === 0)
      //     ) {
      //       filteredItems.push(itemRef);
      //     }
      //   } catch (error) {
      //     filteredItems.push(itemRef);
      //   }
      // }

      // return filteredItems;

      return items;
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
  @Put('/:courseId/versions/:versionId/items/:itemId')
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getItemAbility) {ability, user},
    @Req() req: Request,
  ) {
    const {courseId, versionId, itemId} = params;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', {versionId});

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }
    const getItemBeforeUpdate = await this.itemService.readItem(
      user._id.toString(),
      versionId,
      itemId,
      courseId,
    );

    const itemData = await this.itemService.updateItem(versionId, itemId, body);

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_UPDATE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        itemId: ObjectId.createFromHexString(itemId),
      },
      changes: {
        before: {
          title: getItemBeforeUpdate.name,
          description: getItemBeforeUpdate.description,
          type: getItemBeforeUpdate.type,
          videoDetails:
            getItemBeforeUpdate.type === ItemType.VIDEO
              ? getItemBeforeUpdate.details
              : null,
          quizDetails:
            getItemBeforeUpdate.type === ItemType.QUIZ
              ? getItemBeforeUpdate.details
              : null,
          blogDetails:
            getItemBeforeUpdate.type === ItemType.BLOG
              ? getItemBeforeUpdate.details
              : null,
          projectDetails:
            getItemBeforeUpdate.type === ItemType.PROJECT
              ? getItemBeforeUpdate.details
              : null,
        },
        after: {
          title: body.name,
          description: body.description,
          type: body.type,
          videoDetails: body.type === ItemType.VIDEO ? body.details : null,
          quizDetails: body.type === ItemType.QUIZ ? body.details : null,
          blogDetails: body.type === ItemType.BLOG ? body.details : null,
          projectDetails: body.type === ItemType.PROJECT ? body.details : null,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return itemData;
  }

  @OpenAPI({
    summary: 'Delete an item',
    description: `Deletes a specific item from a section.<br/>
  Accessible to:
  - Instructors or managers of the course.`,
  })
  @Authorized()
  @Delete('/:courseId/itemGroups/:itemsGroupId/items/:itemId')
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getItemAbility) {ability, user},
    @Req() req: Request,
  ) {
    const {itemsGroupId, itemId, courseId} = params;
    const version = await this.itemService.findVersion(itemsGroupId);
    // Create an item resource object for permission checking
    const itemResource = subject('Item', {versionId: version._id.toString()});

    if (!ability.can(ItemActions.Delete, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to delete this item',
      );
    }
    const getItemBeforeDelete = await this.itemService.readItem(
      user._id.toString(),
      version._id.toString(),
      itemId,
      courseId,
    );

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_DELETE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(version._id.toString()),
        itemId: ObjectId.createFromHexString(itemId),
      },
      changes: {
        before: {
          title: getItemBeforeDelete.name,
          description: getItemBeforeDelete.description,
          type: getItemBeforeDelete.type,
          videoDetails:
            getItemBeforeDelete.type === ItemType.VIDEO
              ? getItemBeforeDelete.details
              : null,
          quizDetails:
            getItemBeforeDelete.type === ItemType.QUIZ
              ? getItemBeforeDelete.details
              : null,
          blogDetails:
            getItemBeforeDelete.type === ItemType.BLOG
              ? getItemBeforeDelete.details
              : null,
          projectDetails:
            getItemBeforeDelete.type === ItemType.PROJECT
              ? getItemBeforeDelete.details
              : null,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

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
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getItemAbility) {ability, user},
    @Req() req: Request,
  ) {
    const {versionId, moduleId, sectionId, itemId} = params;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', {versionId});

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError('You do not have permission to move this item');
    }

    const getItemsBeforeMove = await this.itemService.readAllItems(
      versionId,
      moduleId,
      sectionId,
      user._id,
    );

    const sortedItemsbeforeMove = getItemsBeforeMove.sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    const positionOfItemBeforeMove = sortedItemsbeforeMove.findIndex(
      item => item._id.toString() === itemId,
    );
    const beforeItemIdBeforeMove =
      sortedItemsbeforeMove[positionOfItemBeforeMove - 1]?._id;
    const afterItemIdBeforeMove =
      sortedItemsbeforeMove[positionOfItemBeforeMove + 1]?._id;
    const orderBeforeMove =
      sortedItemsbeforeMove[positionOfItemBeforeMove].order;

    const updatedItems = await this.itemService.moveItem(
      versionId,
      moduleId,
      sectionId,
      itemId,
      body,
    );

    if (!updatedItems) {
      setAuditTrail(req, {
        category: AuditCategory.ITEM,
        action: AuditAction.ITEM_REORDER,
        actor: {
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },
        context: {
          courseVersionId: ObjectId.createFromHexString(versionId),
          moduleId: ObjectId.createFromHexString(moduleId),
          sectionId: ObjectId.createFromHexString(sectionId),
          itemId: ObjectId.createFromHexString(itemId),
          relatedIds: {
            beforeItemId: body.beforeItemId
              ? ObjectId.createFromHexString(body.beforeItemId.toString())
              : null,
            afterItemId: body.afterItemId
              ? ObjectId.createFromHexString(body.afterItemId.toString())
              : null,
          },
        },
        outcome: {
          status: OutComeStatus.FAILED,
          errorMessage: 'Failed to move the item. Please try again.',
        },
      });

      throw new BadRequestError('Failed to move the item. Please try again.');
    }

    const getItemsAfterMove = await this.itemService.readAllItems(
      versionId,
      moduleId,
      sectionId,
      user._id,
    );

    const sortedItemsAfterMove = getItemsAfterMove.sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    const positionOfItemAfterMove = sortedItemsAfterMove.findIndex(
      item => item._id.toString() === itemId,
    );
    const afterItemIdAfterMove =
      sortedItemsAfterMove[positionOfItemAfterMove + 1]?._id;
    const beforeItemIdAfterMove =
      sortedItemsAfterMove[positionOfItemAfterMove - 1]?._id;
    const orderAfterMove = sortedItemsAfterMove[positionOfItemAfterMove].order;

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_REORDER,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        sectionId: ObjectId.createFromHexString(sectionId),
        itemId: ObjectId.createFromHexString(itemId),
        relatedIds: {
          beforeItemId: body.beforeItemId
            ? ObjectId.createFromHexString(body.beforeItemId.toString())
            : null,
          afterItemId: body.afterItemId
            ? ObjectId.createFromHexString(body.afterItemId.toString())
            : null,
        },
      },
      changes: {
        before: {
          order: orderBeforeMove,
          beforeItemId: beforeItemIdBeforeMove
            ? ObjectId.createFromHexString(beforeItemIdBeforeMove.toString())
            : null,
          afterItemId: afterItemIdBeforeMove
            ? ObjectId.createFromHexString(afterItemIdBeforeMove.toString())
            : null,
        },
        after: {
          order: orderAfterMove,
          beforeItemId: beforeItemIdAfterMove
            ? ObjectId.createFromHexString(beforeItemIdAfterMove.toString())
            : null,
          afterItemId: afterItemIdAfterMove
            ? ObjectId.createFromHexString(afterItemIdAfterMove.toString())
            : null,
        },
      },
    });
    return updatedItems;
  }

  @OpenAPI({
    summary: 'Get video analytics',
    description: `Retrieves analytics for a video item.<br/>
Access control logic:
- Only instructors, managers, and teaching assistants can access analytics.
- Students are restricted from viewing analytics.`,
  })
  @Authorized()
  @Get('/:courseId/versions/:versionId/item/:itemId/analytics')
  @HttpCode(200)
  @ResponseSchema(VideoOverallAnalytics, {
    description: 'Video analytics retrieved successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Video item not found',
    statusCode: 404,
  })
  async getVideoAnalytics(@Params() params: GetVideoAnalyticsParams) {
    const {courseId, versionId, itemId: videoId} = params;

    return await this.itemService.getVideoAnalytics(
      courseId,
      versionId,
      videoId,
    );
  }

  @OpenAPI({
    summary: 'Get video analytics per student',
    description: `Retrieves per-student analytics for a video item, with search, pagination, and filters.<br/>
Access control logic:
- Only instructors, managers, and teaching assistants can access analytics.
- Students are restricted from viewing analytics.`,
  })
  @Authorized()
  @Get('/:courseId/versions/:versionId/item/:itemId/analytics/users')
  @HttpCode(200)
  @ResponseSchema(VideoUserAnalytics, {
    description: 'Per-student video analytics retrieved successfully',
    isArray: true,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Video item not found',
    statusCode: 404,
  })
  async getVideoAnalyticsPerStudent(
    @Params() params: GetVideoAnalyticsParams,
    @QueryParams() query: VideoUserAnalyticsQuery,
    @CurrentUser() user: IUser,
  ): Promise<VideoUserAnalyticsResponse> {
    const {courseId, versionId, itemId: videoId} = params;

    const userId = user._id.toString();
    if (user.roles !== 'admin') {
      const enrollments = await this.enrollmentService.getAllEnrollments(userId);
      const hasAccess = enrollments.some(e =>
        e.courseId === courseId &&
        e.courseVersionId === versionId &&
        ['INSTRUCTOR', 'MANAGER', 'TA'].includes(e.role),
      );
      if (!hasAccess) {
        throw new ForbiddenError(
          'You do not have permission to view video analytics for this course version',
        );
      }
    }

    return await this.itemService.getVideoUserAnalytics(
      courseId,
      versionId,
      videoId,
      query,
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
  @Get(
    '/:courseId/versions/:versionId/modules/:moduleId/sections/:sectionId/item/:itemId',
  )
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
    @CurrentUser() user: { _id: string },
    @QueryParam('cohortId') cohortId?: string,
    // 'study' asks for a study-mode read (no linear lock, no progress
    // change); anything else is an ordinary read.
    @QueryParam('mode') mode?: string,
  ) {
    const {versionId, itemId, courseId, moduleId, sectionId} = params;
    const {_id: userId} = user;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', {courseId, versionId, itemId});

    // Check permission using ability.can() with the actual item resource
    // if (!ability.can(ItemActions.View, itemResource)) {
    //  throw new ForbiddenError('You do not have permission to view this item');
    // }

    return {
      item: await this.itemService.readItem(
        userId?.toString(),
        versionId,
        itemId,
        courseId,
        moduleId,
        sectionId,
        cohortId,
        mode === 'study' ? 'study' : undefined,
      ),
    };
  }

  async submitProject(): Promise<void> {}

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
    @QueryParams() query: GetFeedbackSubmissionsQuery,
    @Ability(getEnrollmentAbility) {ability, authenticatedUser},
  ) {
    const {courseId, feedbackId} = params;
    const {search = '', page = 1, limit = 1, userId, cohortId, history} = query;
    const {cohortIds} = await this.feedbackAccess(
      ability,
      authenticatedUser,
      courseId,
      feedbackId,
      cohortId,
    );
    return await this.itemService.getFeedbackSubmissions(
      courseId,
      feedbackId,
      search,
      Number(page),
      Number(limit),
      {userId, cohortIds, history},
    );
  }

  /**
   * Course staff only (instructor, manager, TA, admin), and only within the
   * cohorts they can see. Returns the item's version and that cohort scope.
   */
  private async feedbackAccess(
    ability: any,
    authenticatedUser: AuthenticatedUser,
    courseId: string,
    itemId: string,
    requestedCohortId?: string,
  ): Promise<{versionId: string; cohortIds?: string[]}> {
    const versionId = await this.itemService.findItemVersionId(itemId);
    const staff =
      ability.can(
        EnrollmentActions.ViewAll,
        subject('Enrollment', {courseId}),
      ) ||
      ability.can(
        EnrollmentActions.ViewAll,
        subject('Enrollment', {courseId, versionId}),
      );
    if (!staff) {
      throw new ForbiddenError('Only course staff can see feedback responses');
    }
    const scope = this.cohortScopeService.resolve(
      authenticatedUser,
      courseId,
      versionId,
      requestedCohortId,
    );
    const ids = cohortScopeIds(scope);
    return {
      versionId,
      cohortIds: ids ? ids.map(id => id.toString()) : undefined,
    };
  }

  @OpenAPI({
    summary: 'Summarise feedback responses',
    description:
      "Per-question counts, averages and latest text answers over each student's current answer to a feedback form. Course staff only.",
  })
  @Authorized()
  @Get('/:courseId/item/:feedbackId/feedback/summary')
  @HttpCode(200)
  async getFeedbackSummary(
    @Params() params: GetFeedbackSubmissionsParams,
    @QueryParams() query: GetFeedbackSummaryQuery,
    @Ability(getEnrollmentAbility) {ability, authenticatedUser},
  ) {
    const {courseId, feedbackId} = params;
    const {cohortIds} = await this.feedbackAccess(
      ability,
      authenticatedUser,
      courseId,
      feedbackId,
      query.cohortId,
    );
    return this.itemService.getFeedbackSummary(courseId, feedbackId, cohortIds);
  }

  @OpenAPI({
    summary: 'Export feedback submissions as CSV',
    description:
      "One feedback form's current answers as CSV, with the student's account name and email, cohort, place in the course, the lesson it is about, IST and ISO times and a column per question. Course staff only.",
  })
  @Authorized()
  @Get('/:courseId/item/:feedbackId/feedback/submissions/export')
  async exportFeedbackSubmissions(
    @Params() params: GetFeedbackSubmissionsParams,
    @Ability(getEnrollmentAbility) {ability, authenticatedUser},
    @Res() res: Response,
  ) {
    return this.sendFormExport(
      params,
      {format: 'csv'},
      ability,
      authenticatedUser,
      res,
    );
  }

  @OpenAPI({
    summary: 'Export one feedback form',
    description:
      "One feedback form's answers as .xlsx or CSV (latest answers by default, or every version). Course staff only, within their cohorts.",
  })
  @Authorized()
  @Get('/:courseId/item/:feedbackId/feedback/export')
  async exportFeedbackForm(
    @Params() params: GetFeedbackSubmissionsParams,
    @QueryParams() query: FeedbackExportQuery,
    @Ability(getEnrollmentAbility) {ability, authenticatedUser},
    @Res() res: Response,
  ) {
    return this.sendFormExport(params, query, ability, authenticatedUser, res);
  }

  private async sendFormExport(
    params: GetFeedbackSubmissionsParams,
    query: FeedbackExportQuery,
    ability: any,
    authenticatedUser: AuthenticatedUser,
    res: Response,
  ) {
    const {courseId, feedbackId} = params;
    const {versionId, cohortIds} = await this.feedbackAccess(
      ability,
      authenticatedUser,
      courseId,
      feedbackId,
      query.cohortId,
    );
    const {courseName, sheet} =
      await this.feedbackExportService.buildFormExport(
        courseId,
        versionId,
        feedbackId,
        {cohortIds, history: query.history},
      );
    const format = query.format ?? 'xlsx';
    const name = exportFileName(
      `${courseName} ${sheet.name}`,
      'responses',
      format,
    );
    return format === 'csv'
      ? sendFile(res, toCsv(sheet), 'text/csv; charset=utf-8', name)
      : sendFile(res, await writeXlsx([sheet]), XLSX_TYPE, name);
  }

  @OpenAPI({
    summary: 'List the feedback forms in a course version',
    description:
      "Every feedback form in course order with its module, section, the lesson it is about and how many students' current answers it has. Course staff only, within their cohorts.",
  })
  @Authorized()
  @Get('/:courseId/versions/:versionId/feedback/forms')
  @HttpCode(200)
  async listFeedbackForms(
    @Params() params: CourseVersionFeedbackParams,
    @QueryParams() query: GetFeedbackSummaryQuery,
    @Ability(getEnrollmentAbility) {ability, authenticatedUser},
  ) {
    const {courseId, versionId} = params;
    const cohortIds = this.courseFeedbackScope(
      ability,
      authenticatedUser,
      courseId,
      versionId,
      query.cohortId,
    );
    return {
      forms: await this.feedbackExportService.listForms(versionId, cohortIds),
    };
  }

  @OpenAPI({
    summary: "Read a course version's feedback settings",
    description:
      'Whether students can send feedback forms in study mode (how phones answer, since strict mode is PC-only). Course staff only.',
  })
  @Authorized()
  @Get('/:courseId/versions/:versionId/feedback/settings')
  @HttpCode(200)
  async getFeedbackSettings(
    @Params() params: CourseVersionFeedbackParams,
    @Ability(getEnrollmentAbility) {ability, authenticatedUser},
  ): Promise<{studyModeFeedback: boolean}> {
    const {courseId, versionId} = params;
    this.courseFeedbackScope(ability, authenticatedUser, courseId, versionId);
    return {
      studyModeFeedback: await this.settingRepo().isStudyModeFeedbackAllowed(
        courseId,
        versionId,
      ),
    };
  }

  @OpenAPI({
    summary: "Change a course version's feedback settings",
    description:
      'Turns study-mode feedback on or off. Off means students on phones cannot send feedback. Requires permission to edit the course content.',
  })
  @Authorized()
  @Put('/:courseId/versions/:versionId/feedback/settings')
  @HttpCode(200)
  async updateFeedbackSettings(
    @Params() params: CourseVersionFeedbackParams,
    @Body() body: UpdateFeedbackSettingsBody,
    @Ability(getItemAbility) {ability},
  ): Promise<{studyModeFeedback: boolean}> {
    const {courseId, versionId} = params;
    if (!ability.can(ItemActions.Modify, subject('Item', {versionId}))) {
      throw new ForbiddenError(
        "You do not have permission to change this course's feedback settings",
      );
    }
    await this.settingRepo().updateStudyModeFeedback(
      courseId,
      versionId,
      body.studyModeFeedback,
    );
    return {studyModeFeedback: body.studyModeFeedback};
  }

  /** Resolved lazily so the controller doesn't depend on the settings module at construction. */
  private settingRepo(): Pick<
    SettingRepository,
    'isStudyModeFeedbackAllowed' | 'updateStudyModeFeedback'
  > {
    return getContainer().get<SettingRepository>(SETTING_TYPES.SettingRepo);
  }

  /** Course staff only; returns the caller's cohort scope for the version. */
  private courseFeedbackScope(
    ability: any,
    authenticatedUser: AuthenticatedUser,
    courseId: string,
    versionId: string,
    requestedCohortId?: string,
  ): string[] | undefined {
    const staff =
      ability.can(
        EnrollmentActions.ViewAll,
        subject('Enrollment', {courseId}),
      ) ||
      ability.can(
        EnrollmentActions.ViewAll,
        subject('Enrollment', {courseId, versionId}),
      );
    if (!staff) {
      throw new ForbiddenError('Only course staff can see feedback responses');
    }
    const scope = this.cohortScopeService.resolve(
      authenticatedUser,
      courseId,
      versionId,
      requestedCohortId,
    );
    const ids = cohortScopeIds(scope);
    return ids ? ids.map(id => id.toString()) : undefined;
  }

  @OpenAPI({
    summary: 'Export all feedback in a course version',
    description:
      'Every feedback form in the course version, for any course. .xlsx: an Overview sheet, a sheet per form and a Watch + feedback sheet. CSV: every answer in one table (type=all) or one row per student per video (type=watch). Course staff only, within their cohorts.',
  })
  @Authorized()
  @Get('/:courseId/versions/:versionId/feedback/export')
  async exportCourseFeedback(
    @Params() params: CourseVersionFeedbackParams,
    @QueryParams() query: FeedbackExportQuery,
    @Ability(getEnrollmentAbility) {ability, authenticatedUser},
    @Res() res: Response,
  ) {
    const {courseId, versionId} = params;
    const staff =
      ability.can(
        EnrollmentActions.ViewAll,
        subject('Enrollment', {courseId}),
      ) ||
      ability.can(
        EnrollmentActions.ViewAll,
        subject('Enrollment', {courseId, versionId}),
      );
    if (!staff) {
      throw new ForbiddenError('Only course staff can export feedback');
    }
    const scope = this.cohortScopeService.resolve(
      authenticatedUser,
      courseId,
      versionId,
      query.cohortId,
    );
    const ids = cohortScopeIds(scope);
    const data = await this.feedbackExportService.buildCourseExport(
      courseId,
      versionId,
      {
        cohortIds: ids ? ids.map(id => id.toString()) : undefined,
        history: query.history,
      },
    );
    const format = query.format ?? 'xlsx';
    if (format === 'csv') {
      const watch = query.type === 'watch';
      const sheet = watch
        ? (data.watch ?? {name: 'Watch + feedback', header: [], rows: []})
        : data.allAnswers;
      return sendFile(
        res,
        toCsv(sheet),
        'text/csv; charset=utf-8',
        exportFileName(
          data.courseName,
          watch ? 'watch-feedback' : 'feedback',
          'csv',
        ),
      );
    }
    return sendFile(
      res,
      await writeXlsx(data.sheets),
      XLSX_TYPE,
      exportFileName(data.courseName, 'feedback', 'xlsx'),
    );
  }

  @OpenAPI({
    summary: 'Update item optional status',
    description: `Updates the optional status of a specific item.
Accessible to:
- Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @HttpCode(200)
  @Put('/versions/:versionId/items/:itemId/optional')
  @UseInterceptor(AuditTrailsHandler)
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
    @Body() body: {isOptional: boolean},
    @Ability(getItemAbility) {ability, user},
    @Req() req: Request,
  ) {
    const {versionId, itemId} = params;
    // Check permission
    const itemResource = subject('Item', {versionId: versionId});
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    const getItemBeforeUpdate = await this.itemService.readItem(user._id.toString(), versionId, itemId);
    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_MAKE_OPTIONAL,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        itemId: ObjectId.createFromHexString(itemId),
        itemType: getItemBeforeUpdate.type,
      },
      changes: {
        before: {
          isOptional: !body.isOptional, // Assuming the status is being toggled
        },
        after: {
          isOptional: body.isOptional,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return await this.itemService.updateItemOptionalStatus(
      versionId,
      itemId,
      body.isOptional,
    );
  }

  @OpenAPI({
    summary: 'Override this item\'s proctoring status',
    description: `Sets or clears this item's proctoring override, taking precedence over the module and course-wide (universal) proctoring settings.
Accessible to:
- Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @HttpCode(200)
  @Put('/versions/:versionId/items/:itemId/proctoring')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(ItemDataResponse, {
    description: 'Item proctoring status updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async updateProctoringStatus(
    @Params() params: ItemProctoringParams,
    @Body() body: ItemProctoringBody,
    @Ability(getItemAbility) {ability, user, authenticatedUser},
    @Req() req: Request,
  ) {
    const {versionId, itemId} = params;
    // Check permission
    const itemResource = subject('Item', {versionId: versionId});
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    // readItem requires a courseId to find the caller's enrollment for this
    // version -- already resolved once by @Ability above, so reuse it rather
    // than calling it with courseId absent (which makes the enrollment
    // lookup search for a bogus random id and fail with "not enrolled").
    const courseId = authenticatedUser.enrollments.find(
      e => e.versionId === versionId,
    )?.courseId;
    const getItemBeforeUpdate = await this.itemService.readItem(user._id.toString(), versionId, itemId, courseId);
    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_UPDATE_PROCTORING,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        itemId: ObjectId.createFromHexString(itemId),
        itemType: getItemBeforeUpdate.type,
      },
      changes: {
        before: {
          // This item's own raw stored override before the change (instructor
          // callers get the raw item from readItem, not the resolved value --
          // resolution only happens on the student-facing path).
          detectors: (getItemBeforeUpdate as {proctoringDetectors?: IDetectorSettings[] | null}).proctoringDetectors,
        },
        after: {
          detectors: body.detectors,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return await this.itemService.updateItemProctoringStatus(
      versionId,
      itemId,
      body.detectors,
    );
  }

  @OpenAPI({
    summary: "Set this item's study-mode setting",
    description: `Allows or disallows study mode for this item, overriding its section and module, or clears the setting (null) so it inherits again.<br/>
Accessible to:
- Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @HttpCode(200)
  @Put('/versions/:versionId/items/:itemId/study-mode')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(ItemStudyModeResponse, {
    description: 'Item study-mode setting updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async updateStudyMode(
    @Params() params: ItemProctoringParams,
    @Body() body: StudyModeBody,
    @Ability(getItemAbility) {ability, user},
    @Req() req: Request,
  ) {
    const {versionId, itemId} = params;
    const itemResource = subject('Item', {versionId: versionId});
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    const result = await this.itemService.updateItemStudyMode(
      versionId,
      itemId,
      body.studyModeEnabled,
    );

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_UPDATE_STUDY_MODE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        itemId: ObjectId.createFromHexString(itemId),
      },
      changes: {
        after: {studyModeEnabled: body.studyModeEnabled},
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return result;
  }

  @OpenAPI({
    summary: "Set this item's lock setting",
    description: `Locks this item for students or keeps it open, overriding its section and module, or clears the setting (null) so it inherits again.<br/>
Accessible to:
- Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @HttpCode(200)
  @Put('/versions/:versionId/items/:itemId/lock')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(ItemContentLockResponse, {
    description: 'Item lock setting updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async updateLock(
    @Params() params: ItemProctoringParams,
    @Body() body: ContentLockBody,
    @Ability(getItemAbility) {ability, user},
    @Req() req: Request,
  ) {
    const {versionId, itemId} = params;
    const itemResource = subject('Item', {versionId: versionId});
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    const result = await this.itemService.updateItemLock(
      versionId,
      itemId,
      body.isLocked,
    );

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_UPDATE_LOCK,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        itemId: ObjectId.createFromHexString(itemId),
      },
      changes: {
        after: {isLocked: body.isLocked},
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return result;
  }

  @OpenAPI({
    summary: 'Toggle item visibility',
    description: `Toggles the visibility of a specific item within a course version.<br/>
  Accessible to:
  - Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @Put('/:courseId/versions/:versionId/items/:itemId/toggle-visibility')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(ItemDataResponse, {
    description: 'Item visibility toggled successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async toggleItemVisibility(
    @Params() params: VersionItemParams,
    @Body() body: HideModuleBody,
    @Ability(getItemAbility) {ability, user},
    @Req() req: Request,
  ) {
    const {courseId, versionId, itemId} = params;
    const {hide} = body;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', {
      versionId: versionId,
      itemId: itemId,
    });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    const getItemBeforeUpdate = await this.itemService.readItem(
      user._id.toString(),
      versionId,
      itemId,
      courseId
    );

    await this.itemService.toggleItemVisibility(versionId, itemId, hide);

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_HIDE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        itemId: ObjectId.createFromHexString(itemId),
        itemType: getItemBeforeUpdate.type,
      },
      changes: {
        before: {
          isHidden: !hide, // Assuming the status is being toggled
        },
        after: {
          isHidden: hide,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return {itemId: itemId, isHidden: hide};
  }

  @OpenAPI({
    summary: 'Process CSV to item',
    description: `Processes a CSV file to create items in a course version.<br/>
  Accessible to:
  - Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @Post(
    '/:courseId/versions/:versionId/module/:moduleId/section/:sectionId/items/csv',
  )
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(csvResponse, {
    description: 'CSV processed successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: 'Item not found',
    statusCode: 404,
  })
  async processCSVtoItem(
    @Params() params: CourseVersionModuleSectionParams,
    @Body({options: {limit: '10mb'}}) body: CSVItemBody,
    @Ability(getItemAbility) {user, ability},
    @Req() req: Request,
  ) {
    const {courseId, versionId, moduleId, sectionId} = params;
    const userId = user.userId || user._id;
    const {youtubeurl, data} = body;

    const result = await this.itemService.processCSVAndCreateItems(
      youtubeurl,
      moduleId,
      sectionId,
      versionId,
      courseId,
      userId,
      data,
    );

    const createdItems = result.createdItems || [];

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_BULK_PROCESS,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        sectionId: ObjectId.createFromHexString(sectionId),
      },
      changes: {
        after: {
          numberOfItemsCreated: result.createdItems
            ? result.createdItems.length
            : 0,
          data: createdItems,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return result;
  }
}
