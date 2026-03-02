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
  CSVItemBody,
  CourseVersionModuleSectionParams,
  csvResponse,
  VideoOverallAnalytics,
  GetVideoAnalyticsParams,
  VideoUserAnalyticsQuery,
  VideoUserAnalytics,
  VideoUserAnalyticsResponse,
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
import { HideModuleBody } from '../classes/index.js';
import { createObjectCsvStringifier } from 'csv-writer';
import { Response } from 'express';
import { AuditTrailsHandler } from '#root/shared/middleware/auditTrails.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { ObjectId } from 'mongodb';
import { SETTING_TYPES } from '#root/modules/setting/types.js';
import { TimeSlotService } from '#root/modules/setting/services/TimeSlotService.js';

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
    @inject(SETTING_TYPES.TimeSlotService)
    private readonly timeSlotService: TimeSlotService,
  ) { }
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
    @Ability(getItemAbility) { ability, user },
    @Req() req: Request,
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

    const result = await this.itemService.createItem(
      versionId,
      moduleId,
      sectionId,
      body,
    );

    const createdItem = result.createdItem;

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_ADD,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        sectionId: ObjectId.createFromHexString(sectionId),
        relatedIds: {
          afterItemId: body.afterItemId ? ObjectId.createFromHexString(body.afterItemId) : null,
          beforeItemId: body.beforeItemId ? ObjectId.createFromHexString(body.beforeItemId) : null
        }
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
        }
      },
      outcome: {
        status: OutComeStatus.SUCCESS
      }
    })
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
  async readAll(
    @Params() params: VersionModuleSectionParams,
    @Ability(getItemAbility) { ability, user },
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

    const items = await this.itemService.readAllItems(
      versionId,
      moduleId,
      sectionId,
      user._id,
    );

    // Filter out blank quizzes for students
    try {
      const sampleItemResource = subject('Item', { versionId, _id: 'sample' });
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
    @Ability(getItemAbility) { ability, user },
    @Req() req: Request,
  ) {
    const {courseId, versionId, itemId } = params;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }
    const getItemBeforeUpdate = await this.itemService.readItem(user._id.toString(), versionId, itemId, courseId);

    const itemData = await this.itemService.updateItem(versionId, itemId, body)


    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_UPDATE,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        itemId: ObjectId.createFromHexString(itemId),
      },
      changes: {
        before: {
          title: getItemBeforeUpdate.name,
          description: getItemBeforeUpdate.description,
          type: getItemBeforeUpdate.type,
          videoDetails: getItemBeforeUpdate.type === ItemType.VIDEO ? getItemBeforeUpdate.details : null,
          quizDetails: getItemBeforeUpdate.type === ItemType.QUIZ ? getItemBeforeUpdate.details : null,
          blogDetails: getItemBeforeUpdate.type === ItemType.BLOG ? getItemBeforeUpdate.details : null,
          projectDetails: getItemBeforeUpdate.type === ItemType.PROJECT ? getItemBeforeUpdate.details : null,
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
        status: OutComeStatus.SUCCESS
      }
    })

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
    @Ability(getItemAbility) { ability, user },
    @Req() req: Request,
  ) {
    const { itemsGroupId, itemId , courseId} = params;
    const version = await this.itemService.findVersion(itemsGroupId);
    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: version._id.toString() });

    if (!ability.can(ItemActions.Delete, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to delete this item',
      );
    }
    const getItemBeforeDelete = await this.itemService.readItem(user._id.toString(), version._id.toString(), itemId, courseId);

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_DELETE,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseVersionId: ObjectId.createFromHexString(version._id.toString()),
        itemId: ObjectId.createFromHexString(itemId),
      },
      changes: {
        before: {
          title: getItemBeforeDelete.name,
          description: getItemBeforeDelete.description,
          type: getItemBeforeDelete.type,
          videoDetails: getItemBeforeDelete.type === ItemType.VIDEO ? getItemBeforeDelete.details : null,
          quizDetails: getItemBeforeDelete.type === ItemType.QUIZ ? getItemBeforeDelete.details : null,
          blogDetails: getItemBeforeDelete.type === ItemType.BLOG ? getItemBeforeDelete.details : null,
          projectDetails: getItemBeforeDelete.type === ItemType.PROJECT ? getItemBeforeDelete.details : null,
        }
      },
      outcome: {
        status: OutComeStatus.SUCCESS
      }
    })

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
    @Ability(getItemAbility) { ability, user },
    @Req() req: Request,
  ) {
    const { versionId, moduleId, sectionId, itemId } = params;

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId });

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

    const sortedItemsbeforeMove = getItemsBeforeMove.sort((a, b) => a.order.localeCompare(b.order));
    const positionOfItemBeforeMove = sortedItemsbeforeMove.findIndex(item => item._id.toString() === itemId);
    const beforeItemIdBeforeMove = sortedItemsbeforeMove[positionOfItemBeforeMove - 1]?._id;
    const afterItemIdBeforeMove = sortedItemsbeforeMove[positionOfItemBeforeMove + 1]?._id;
    const orderBeforeMove = sortedItemsbeforeMove[positionOfItemBeforeMove].order;

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
        actor: ObjectId.createFromHexString(user._id.toString()),
        context: {
          courseVersionId: ObjectId.createFromHexString(versionId),
          moduleId: ObjectId.createFromHexString(moduleId),
          sectionId: ObjectId.createFromHexString(sectionId),
          itemId: ObjectId.createFromHexString(itemId),
          relatedIds: {
            beforeItemId: body.beforeItemId ? ObjectId.createFromHexString(body.beforeItemId.toString()) : null,
            afterItemId: body.afterItemId ? ObjectId.createFromHexString(body.afterItemId.toString()) : null,
          }
        },
        outcome: {
          status: OutComeStatus.FAILED,
          errorMessage: 'Failed to move the item. Please try again.'
        }
      })

      throw new BadRequestError('Failed to move the item. Please try again.');
    }

    const getItemsAfterMove = await this.itemService.readAllItems(
      versionId,
      moduleId,
      sectionId,
      user._id,
    );

    const sortedItemsAfterMove = getItemsAfterMove.sort((a, b) => a.order.localeCompare(b.order));
    const positionOfItemAfterMove = sortedItemsAfterMove.findIndex(item => item._id.toString() === itemId);
    const afterItemIdAfterMove = sortedItemsAfterMove[positionOfItemAfterMove + 1]?._id;
    const beforeItemIdAfterMove = sortedItemsAfterMove[positionOfItemAfterMove - 1]?._id;
    const orderAfterMove = sortedItemsAfterMove[positionOfItemAfterMove].order;

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_REORDER,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        sectionId: ObjectId.createFromHexString(sectionId),
        itemId: ObjectId.createFromHexString(itemId),
        relatedIds: {
          beforeItemId: body.beforeItemId ? ObjectId.createFromHexString(body.beforeItemId.toString()) : null,
          afterItemId: body.afterItemId ? ObjectId.createFromHexString(body.afterItemId.toString()) : null,
        }
      },
      changes: {
        before: {
          order: orderBeforeMove,
          beforeItemId: beforeItemIdBeforeMove ? ObjectId.createFromHexString(beforeItemIdBeforeMove.toString()) : null,
          afterItemId: afterItemIdBeforeMove ? ObjectId.createFromHexString(afterItemIdBeforeMove.toString()) : null,
        },
        after: {
          order: orderAfterMove,
          beforeItemId: beforeItemIdAfterMove ? ObjectId.createFromHexString(beforeItemIdAfterMove.toString()) : null,
          afterItemId: afterItemIdAfterMove ? ObjectId.createFromHexString(afterItemIdAfterMove.toString()) : null,
        }
      }
    })
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
  async getVideoAnalytics(
    @Params() params: GetVideoAnalyticsParams,
  ) {
    const { courseId, versionId, itemId: videoId } = params;

    return await this.itemService.getVideoAnalytics(
      courseId,
      versionId,
      videoId,
    );
  }


  @OpenAPI({
    summary: "Get video analytics per student",
    description: `Retrieves per-student analytics for a video item, with search, pagination, and filters.<br/>
Access control logic:
- Only instructors, managers, and teaching assistants can access analytics.
- Students are restricted from viewing analytics.`,
  })
  // @Authorized()
  @Get("/:courseId/versions/:versionId/item/:itemId/analytics/users")
  @HttpCode(200)
  @ResponseSchema(VideoUserAnalytics, {
    description: "Per-student video analytics retrieved successfully",
    isArray: true,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: "Bad Request Error",
    statusCode: 400,
  })
  @ResponseSchema(ItemNotFoundErrorResponse, {
    description: "Video item not found",
    statusCode: 404,
  })
  async getVideoAnalyticsPerStudent(
    @Params() params: GetVideoAnalyticsParams,
    @QueryParams() query: VideoUserAnalyticsQuery
  ): Promise<VideoUserAnalyticsResponse> {
    const { courseId, versionId, itemId: videoId } = params;
    return await this.itemService.getVideoUserAnalytics(
      courseId,
      versionId,
      videoId,
      query
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
  @Get('/:courseId/versions/:versionId/modules/:moduleId/sections/:sectionId/item/:itemId')
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
    @CurrentUser() user: { _id: string },
  ) {
    const { versionId, itemId, courseId, moduleId, sectionId } = params;
    const { _id: userId } = user;

    // Check if user is instructor/manager/TA - they should bypass time slot validation
    const sampleItemResource = subject('Item', { versionId });
    const canManage = ability.can(ItemActions.Modify, sampleItemResource);

    if (!canManage) {
      // Only apply time slot validation for students
      try {
        const timeSlotAccess = await this.timeSlotService.canStudentAccessCourse(
          userId.toString(),
          courseId,
          versionId
        );

        if (!timeSlotAccess.canAccess) {
          throw new ForbiddenError(timeSlotAccess.message || 'Time slot access denied');
        }
      } catch (error) {
        // If it's already a ForbiddenError, re-throw it
        if (error.name === 'ForbiddenError') {
          throw error;
        }
        throw new ForbiddenError('Time slot access check failed');
      }
    }

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { courseId, versionId, itemId });

    // Check permission using ability.can() with the actual item resource
    // if (!ability.can(ItemActions.View, itemResource)) {
    //  throw new ForbiddenError('You do not have permission to view this item');
    // }

    return {
      item: await this.itemService.readItem(userId?.toString(), versionId, itemId, courseId, moduleId, sectionId),
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
    @QueryParams() query: GetFeedbackSubmissionsQuery,
    // @Ability(getItemAbility) { ability },
  ) {
    const { courseId, feedbackId } = params;
    const { search = '', page = 1, limit = 1 } = query;
    return await this.itemService.getFeedbackSubmissions(
      courseId,
      feedbackId,
      search,
      Number(page),
      Number(limit),
    );
  }

  @OpenAPI({
    summary: 'Export feedback submissions as CSV',
    description: `Export all feedback submissions for a particular course item.`,
  })
  @Authorized()
  @Get('/:courseId/item/:feedbackId/feedback/submissions/export')
  async exportFeedbackSubmissions(
    @Params() params: GetFeedbackSubmissionsParams,
    @Res() res: Response,
  ) {
    const { courseId, feedbackId } = params;
    const result = await this.itemService.exportFeedbackSubmissions(
      courseId,
      feedbackId,
    );

    if (result.length === 0) {
      return res.status(200).send('No submissions found');
    }

    const headers = Object.keys(result[0]).map(key => ({ id: key, title: key }));

    const csvStringifier = createObjectCsvStringifier({
      header: headers,
    });

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(result);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="feedback_submissions_${feedbackId}.csv"`,
    );
    res.setHeader('Cache-Control', 'no-cache');

    return res.send(csvContent);
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
    @Body() body: { isOptional: boolean },
    @Ability(getItemAbility) { ability, user },
    @Req() req: Request,
  ) {
    const { versionId, itemId } = params;
    // Check permission
    const itemResource = subject('Item', { versionId: versionId });
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    const getItemBeforeUpdate = await this.itemService.readItem(user._id.toString(), versionId, itemId);
    console.log("getItemBeforeUpdate----",getItemBeforeUpdate);
    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_MAKE_OPTIONAL,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        itemId: ObjectId.createFromHexString(itemId),
        itemType: getItemBeforeUpdate.type,
      },
      changes: {
        before: {
          isOptional: !(body.isOptional), // Assuming the status is being toggled
        },
        after: {
          isOptional: body.isOptional,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    })

    return await this.itemService.updateItemOptionalStatus(
      versionId,
      itemId,
      body.isOptional,
    );
  }

  @OpenAPI({
    summary: 'Toggle item visibility',
    description: `Toggles the visibility of a specific item within a course version.<br/>
  Accessible to:
  - Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @Put('/versions/:versionId/items/:itemId/toggle-visibility')
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
    @Ability(getItemAbility) { ability, user },
    @Req() req: Request,
  ) {
    const { versionId, itemId } = params;
    const { hide } = body;


    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: versionId, itemId: itemId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    const getItemBeforeUpdate = await this.itemService.readItem(user._id.toString(), versionId, itemId);

    await this.itemService.toggleItemVisibility(versionId, itemId, hide);

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_HIDE,
      actor: ObjectId.createFromHexString(user._id.toString()),
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
    })

    return { itemId: itemId, isHidden: hide };
  }

  @OpenAPI({
    summary: 'Process CSV to item',
    description: `Processes a CSV file to create items in a course version.<br/>
  Accessible to:
  - Instructors, managers, and teaching assistants of the course.`,
  })
  @Authorized()
  @Post("/:courseId/versions/:versionId/module/:moduleId/section/:sectionId/items/csv")
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
    @Body() body: CSVItemBody,
    @Ability(getItemAbility) { user, ability },
    @Req() req: Request,
  ) {
    const { courseId, versionId, moduleId, sectionId } = params;
    const userId = user.userId || user._id;
    const { youtubeurl, data } = body;

    const result = await this.itemService.processCSVAndCreateItems(
      youtubeurl,
      moduleId,
      sectionId,
      versionId,
      courseId,
      userId,
      data
    );

    const createdItems = result.createdItems || [];

    setAuditTrail(req, {
      category: AuditCategory.ITEM,
      action: AuditAction.ITEM_BULK_PROCESS,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        sectionId: ObjectId.createFromHexString(sectionId),
      },
      changes: {
        after: {
          numberOfItemsCreated: result.createdItems ? result.createdItems.length : 0,
          data: createdItems
        }
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return result;
  }
}
