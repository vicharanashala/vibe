import { Progress } from '#users/classes/transformers/Progress.js';
import { ICurrentProgressPath } from '#shared/interfaces/models.js';
import {
  GetUserProgressParams,
  StartItemParams,
  StartItemBody,
  StartItemResponse,
  StopItemParams,
  StopItemBody,
  UpdateProgressParams,
  UpdateProgressBody,
  ResetCourseProgressParams,
  ResetCourseProgressBody,
  ProgressDataResponse,
  ProgressNotFoundErrorResponse,
  WatchTimeParams,
  CompletedProgressResponse,
  WatchTimeResponse,
  TotalWatchTimeResponse,
  ItemIdparams,
  GetLeaderboardQuery,
  LeaderboardNoAuthResponse,
  GetLeaderboardResponse,
} from '#users/classes/validators/ProgressValidators.js';
import { ProgressService } from '#users/services/ProgressService.js';
import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Get,
  HttpCode,
  Params,
  Post,
  Body,
  OnUndefined,
  Patch,
  BadRequestError,
  InternalServerError,
  ForbiddenError,
  Authorized,
  Session,
  Param,
  QueryParams,
  CurrentUser,
  Req,
  UseInterceptor,
  QueryParam,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { UserNotFoundErrorResponse } from '../classes/validators/UserValidators.js';
import {
  ProgressActions,
  getProgressAbility,
} from '../abilities/progressAbilities.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import { QuizService } from '#root/modules/quizzes/services/index.js';
import { BadRequestErrorResponse, IUser } from '#root/shared/index.js';
import { AuditTrailsHandler } from '#root/shared/middleware/auditTrails.js';
import { InternalServerErrorResponse } from '../../../shared/middleware/errorHandler.js';
import { COURSES_TYPES } from '#root/modules/courses/types.js';
import { ItemService } from '#root/modules/courses/services/ItemService.js';
import { SuccessResponse } from '#root/modules/projects/classes/validators/ProjectValidators.js';
import { CourseVersionQuery } from '#root/modules/courses/classes/index.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import {
  AuditAction,
  AuditCategory,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';

@OpenAPI({
  tags: ['Progress'],
})
@JsonController('/users', { transformResponse: true })
@injectable()
class ProgressController {
  constructor(
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,

    @inject(QUIZZES_TYPES.QuizService)
    private readonly quizService: QuizService,

    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,
  ) { }

  @OpenAPI({
    summary: 'Get user progress in a course version',
    description:
      'Retrieves the progress of a user in a specific course version.',
  })
  @Authorized()
  @Get('/progress/courses/:courseId/versions/:versionId/')
  @HttpCode(200)
  @ResponseSchema(ProgressDataResponse, {
    description: 'User progress retrieved successfully',
  })
  @ResponseSchema(ProgressNotFoundErrorResponse, {
    description: 'Progress not found',
    statusCode: 404,
  })
  async getUserProgress(
    @Params() params: GetUserProgressParams,
    @Ability(getProgressAbility) { ability, user },
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<Progress> {
    const { courseId, versionId } = params;
    const userId = user._id.toString();

    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });

    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError(
        'You do not have permission to view this progress',
      );
    }
    const progress = await this.progressService.getUserProgress(
      userId,
      courseId,
      versionId,
      cohortId,
    );

    return progress;
  }

  @OpenAPI({
    summary: 'Get current progress path for a user',
    description:
      'Retrieves the current learning position (module, section, item) for a specific user in a course version',
  })
  @Authorized()
  @Get('/progress/courses/:courseId/versions/:versionId/current-path')
  @HttpCode(200)
  async getCurrentProgressPath(
    @Params() params: GetUserProgressParams,
    @Ability(getProgressAbility) { user },
    @Req() request: any,
  ): Promise<ICurrentProgressPath> {
    const { courseId, versionId } = params;

    // Validate and extract userId with proper error handling
    const queryUserId = request.query?.userId as string;
    const cohortId = request.query?.cohortId as string | undefined;
    const userId =
      queryUserId && queryUserId.trim() ? queryUserId : user._id.toString();

    if (!userId) {
      return {
        module: null,
        section: null,
        item: null,
        message: 'Invalid user ID',
      };
    }
    const result = await this.progressService.getCurrentProgressPath(
      userId,
      courseId,
      versionId,
      cohortId
    );

    return result;
  }

  @OpenAPI({
    summary: 'Get %age progress in a course version',
    description:
      'Retrieves the progress of a user in a specific course version.',
  })
  @Authorized()
  @Get('/progress/courses/:courseId/versions/:versionId/percentage')
  @HttpCode(200)
  @ResponseSchema(CompletedProgressResponse, {
    description: 'User progress retrieved successfully',
  })
  @ResponseSchema(ProgressNotFoundErrorResponse, {
    description: 'Progress not found',
    statusCode: 404,
  })
  async getUserProgressPercentage(
    @Params() params: GetUserProgressParams,
    @Ability(getProgressAbility) { ability, user },
  ): Promise<CompletedProgressResponse> {
    const { courseId, versionId } = params;
    const userId = user._id.toString();

    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });

    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError('You do not have permission');
    }

    return await this.progressService.getUserProgressPercentage(
      userId,
      courseId,
      versionId,
    );
  }

  @OpenAPI({
    summary: 'Start an item for user progress',
    description: 'Marks the start of an item for a user in a course version.',
  })
  @Authorized()
  @Post('/progress/courses/:courseId/versions/:versionId/start')
  @HttpCode(200)
  @ResponseSchema(StartItemResponse, {
    description: 'Item started successfully',
  })
  @ResponseSchema(ProgressNotFoundErrorResponse, {
    description: 'Progress not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description:
      'courseVersionId, moduleId, sectionId, or itemId do not match user progress',
    statusCode: 400,
  })
  async startItem(
    @Params() params: StartItemParams,
    @Body() body: StartItemBody,
    @Ability(getProgressAbility) { ability, user },
  ): Promise<StartItemResponse> {
    const { courseId, versionId } = params;
    const { itemId, moduleId, sectionId, cohortId } = body;
    const userId = user._id.toString();

    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });

    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.Modify, progressResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this progress',
      );
    }
    const watchItemId: string = await this.progressService.startItem(
      userId,
      courseId,
      versionId,
      moduleId,
      sectionId,
      itemId,
      cohortId
    );

    return new StartItemResponse({
      watchItemId,
    });
  }

  @OpenAPI({
    summary: 'Stop an item for user progress',
    description: `Marks the stop of an item for a user in a course version.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/progress/courses/:courseId/versions/:versionId/stop')
  @OnUndefined(200)
  @ResponseSchema(ProgressNotFoundErrorResponse, {
    description: 'Progress not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description:
      'courseVersionId, moduleId, sectionId, or itemId do not match user progress',
    statusCode: 400,
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to stop tracking item',
    statusCode: 500,
  })
  async stopItem(
    @Params() params: StopItemParams,
    @Body() body: StopItemBody,
    @Ability(getProgressAbility) { ability, user },
  ): Promise<void> {
    const { courseId, versionId } = params;
    const {
      itemId,
      sectionId,
      moduleId,
      watchItemId,
      attemptId,
      isSkipped,
      seekForwardEnabled,
      nextItemId,
      cohortId,
    } = body;

    const userId = String(user._id);

    const progressResource = subject('Progress', {
      userId,
      courseId,
      versionId,
    });

    if (!ability.can(ProgressActions.Modify, progressResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this progress',
      );
    }
    await this.progressService.stopItem(
      userId,
      courseId,
      versionId,
      itemId,
      sectionId,
      moduleId,
      watchItemId,
      attemptId,
      isSkipped,
      seekForwardEnabled,
      nextItemId,
      cohortId
    );
  }

  @OpenAPI({
    summary: 'Reset user progress',
    description: `Resets the user's progress in a course version. 
If only moduleId is provided, resets to the beginning of the module. 
If moduleId and sectionId are provided, resets to the beginning of the section. 
If moduleId, sectionId, and itemId are provided, resets to the beginning of the item. 
If none are provided, resets to the beginning of the course.<br/>
It returns an empty body with a 200 status code.
`,
  })
  @Authorized()
  @Patch('/:userId/progress/courses/:courseId/versions/:versionId/reset')
  @UseInterceptor(AuditTrailsHandler)
  @OnUndefined(200)
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Progress could not be reset',
    statusCode: 500,
  })
  async resetProgress(
    @Params() params: ResetCourseProgressParams,
    @Body() body: ResetCourseProgressBody,
    @Ability(getProgressAbility) { ability, user },
    @Req() req: Request,
  ): Promise<void> {
    console.log('RESET API HIT');
    console.log('Params:', params);
    console.log('Body:', body);
    const { userId, courseId, versionId } = params;
    const { moduleId, sectionId, itemId, cohortId } = body;
    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });

    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.Modify, progressResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this progress',
      );
    }

    // Check if only moduleId is provided
    // If so, reset progress to the beginning of the module
    if (moduleId && !sectionId && !itemId) {
      console.log('Reset the course progress to the beginning of the module');
      const getmoduleProgress =
        await this.progressService.getUserProgressPercentage( //
          userId,
          courseId,
          versionId,
          cohortId
        );
      await this.progressService.resetCourseProgressToModule( //
        userId,
        courseId,
        versionId,
        moduleId,
        cohortId
      );

      const afterUpdateModuleProgress =
        await this.progressService.getUserProgressPercentage(
          userId,
          courseId,
          versionId,
          cohortId
        );
      console.log('Module Progress after reset:', afterUpdateModuleProgress);
      setAuditTrail(req, {
        category: AuditCategory.PROGRESS,
        action: AuditAction.PROGRESS_RESET,
        actor:{
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },
        context: {
          courseId: ObjectId.createFromHexString(courseId),
          courseVersionId: ObjectId.createFromHexString(versionId),
          moduleId: ObjectId.createFromHexString(moduleId),
          userId: ObjectId.createFromHexString(userId),
        },
        changes: {
          before: {
            completed: getmoduleProgress.completed,
            completedItems: getmoduleProgress.completedItems,
            compltedPercentage: getmoduleProgress.percentCompleted,
            totalItems: getmoduleProgress.totalItems,
          },
          after: {
            completed: afterUpdateModuleProgress.completed,
            completedItems: afterUpdateModuleProgress.completedItems,
            compltedPercentage: afterUpdateModuleProgress.percentCompleted,
            totalItems: afterUpdateModuleProgress.totalItems,
          },
        },
        outcome: {
          status: OutComeStatus.SUCCESS,
        },
      });
    }

    // Check if moduleId and sectionId are provided
    // If so, reset progress to the beginning of the section
    else if (moduleId && sectionId && !itemId) {
      console.log('Reset the course progress to the beginning of the section');
      const getProgress = await this.progressService.getUserProgressPercentage(
        userId,
        courseId,
        versionId,
        cohortId
      );
      console.log('Section Progress before reset:', getProgress);

      await this.progressService.resetCourseProgressToSection( //
        userId,
        courseId,
        versionId,
        moduleId,
        sectionId,
        cohortId
      );

      const afterUpdateProgress =
        await this.progressService.getUserProgressPercentage(
          userId,
          courseId,
          versionId,
          cohortId
        );
      console.log('Section Progress after reset:', afterUpdateProgress);
      setAuditTrail(req, {
        category: AuditCategory.PROGRESS,
        action: AuditAction.PROGRESS_RESET,
        actor: {
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },

        context: {
          courseId: ObjectId.createFromHexString(courseId),
          courseVersionId: ObjectId.createFromHexString(versionId),
          moduleId: ObjectId.createFromHexString(moduleId),
          sectionId: ObjectId.createFromHexString(sectionId),
          userId: ObjectId.createFromHexString(userId),
        },
        changes: {
          before: {
            completed: getProgress.completed,
            completedItems: getProgress.completedItems,
            compltedPercentage: getProgress.percentCompleted,
            totalItems: getProgress.totalItems,
          },
          after: {
            completed: afterUpdateProgress.completed,
            completedItems: afterUpdateProgress.completedItems,
            compltedPercentage: afterUpdateProgress.percentCompleted,
            totalItems: afterUpdateProgress.totalItems,
          },
        },
        outcome: {
          status: OutComeStatus.SUCCESS,
        },
      });
    }

    // Check if moduleId, sectionId, and itemId are provided
    // If so, reset progress to the beginning of the item
    else if (moduleId && sectionId && itemId) {
      console.log('Reset the course progress to the beginning of the item');
      const getProgress = await this.progressService.getUserProgressPercentage(
        userId,
        courseId,
        versionId,
        cohortId
      );
      console.log('Item Progress before reset:', getProgress);
      await this.progressService.resetCourseProgressToItem( //
        userId,
        courseId,
        versionId,
        moduleId,
        sectionId,
        itemId,
        cohortId
      );
      const afterUpdateProgress =
        await this.progressService.getUserProgressPercentage(
          userId,
          courseId,
          versionId,
          cohortId
        );

      console.log('Item Progress after reset:', afterUpdateProgress);
      setAuditTrail(req, {
        category: AuditCategory.PROGRESS,
        action: AuditAction.PROGRESS_RESET,
        actor: {
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },
        context: {
          courseId: ObjectId.createFromHexString(courseId),
          courseVersionId: ObjectId.createFromHexString(versionId),
          moduleId: ObjectId.createFromHexString(moduleId),
          sectionId: ObjectId.createFromHexString(sectionId),
          itemId: ObjectId.createFromHexString(itemId),
          userId: ObjectId.createFromHexString(userId),
        },
        changes: {
          before: {
            completed: getProgress.completed,
            completedItems: getProgress.completedItems,
            compltedPercentage: getProgress.percentCompleted,
            totalItems: getProgress.totalItems,
          },
          after: {
            completed: afterUpdateProgress.completed,
            completedItems: afterUpdateProgress.completedItems,
            compltedPercentage: afterUpdateProgress.percentCompleted,
            totalItems: afterUpdateProgress?.totalItems ?? 0,
          },
        },
        outcome: {
          status: OutComeStatus.SUCCESS,
        },
      });
    }

    // If no moduleId, sectionId, or itemId are provided, reset progress to the beginning of the course
    else {
      console.log('Rest the course progress to the beginning of the course');
      const getProgress = await this.progressService.getUserProgressPercentage(
        userId,
        courseId,
        versionId,
        cohortId
      );
      console.log('Course Progress before reset:', getProgress);
      await this.progressService.resetCourseProgress(
        userId,
        courseId,
        versionId,
        cohortId
      );
      setAuditTrail(req, {
        category: AuditCategory.PROGRESS,
        action: AuditAction.PROGRESS_RESET,
        actor: {
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },
        context: {
          courseId: ObjectId.createFromHexString(courseId),
          courseVersionId: ObjectId.createFromHexString(versionId),
          userId: ObjectId.createFromHexString(userId),
        },
        changes: {
          before: {
            completed: getProgress.completed,
            completedItems: getProgress.completedItems,
            compltedPercentage: getProgress.percentCompleted,
            totalItems: getProgress.totalItems,
          },
          after: {
            completed: 0,
            completedItems: 0,
            compltedPercentage: 0,
            totalItems: getProgress.totalItems,
          },
        },
        outcome: {
          status: OutComeStatus.SUCCESS,
        },
      });
    }
  }

  @OpenAPI({
    summary: 'Get User Watch Time',
    description: `Gets the User Watch Time for the given Item Id`,
  })
  @Authorized()
  @Get(
    '/:userId/watchTime/course/:courseId/version/:versionId/item/:itemId/type/:type',
  )
  @HttpCode(200)
  @ResponseSchema(WatchTimeResponse, {
    description: 'Watch time fetched successfully',
    statusCode: 200,
  })
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Could not Fetch the Watch Time',
    statusCode: 500,
  })
  async getWatchTime(
    @Params() params: WatchTimeParams,
    @Ability(getProgressAbility) { ability },
  ): Promise<WatchTimeResponse> {
    const { userId, courseId, versionId, itemId, type } = params;

    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });
    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError(
        'You do not have permission to view this progress',
      );
    }

    const watchTime = await this.progressService.getWatchTime(
      userId,
      itemId,
      courseId,
      versionId,
    );

    if (type === 'QUIZ') {
      const quizMetrics = await this.quizService.getUserMetricsForQuiz(
        userId,
        itemId,
      );
      if (quizMetrics) {
        return { watchTime, quizMetrics };
      }
    }

    return { watchTime };
  }

  @OpenAPI({
    summary: 'Get Total Watch Time of User',
    description: `Gets the Total Watch Time of the User`,
  })
  @Authorized()
  @Get('/watchtime/total')
  @HttpCode(200)
  @ResponseSchema(TotalWatchTimeResponse, {
    description: 'Total watch time fetched successfully',
    statusCode: 200,
  })
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Could not Fetch the Total Watch Time',
    statusCode: 500,
  })
  async getTotalWatchtimeOfUser(
    @Ability(getProgressAbility) { user },
  ): Promise<number> {
    const userId = user._id.toString();

    const totalWatchTime =
      await this.progressService.getTotalWatchtimeOfUser(userId);
    return totalWatchTime;
  }

  // In ItemController.ts
  @OpenAPI({
    summary: 'Skip an optional item',
    description:
      'this allows to change isOptional for items, does not return anything on success',
  })
  @Authorized()
  @Post('/items/:itemId/skip')
  @OnUndefined(200)
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Could not skip the item',
    statusCode: 500,
  })
  async skipOptionalItem(
    @Params() params: ItemIdparams,
    @Ability(getProgressAbility) { user, ability },
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<void> {
    const { itemId } = params;

    if (!user || (!user.userId && !user._id)) {
      throw new Error('User not authenticated or user ID not found');
    }

    const userId = user.userId || user._id;
    const { courseId, versionId } =
      await this.itemService.getCourseAndVersionByItemId(itemId);

    await this.progressService.skipItem(userId, courseId, versionId, itemId, cohortId);
  }
  @Get('/progress/courses/:courseId/versions/:versionId/leaderboard')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get course leaderboard',
    description:
      'Returns ranked list of students based on completion percentage and time',
  })
  @ResponseSchema(ProgressDataResponse, {
    description: 'Leaderboard retrieved successfully',
    isArray: true,
  })
  @Authorized()
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to fetch leaderboard',
    statusCode: 500,
  })
  async getLeaderboard(
    @Params() params: GetUserProgressParams,
    @QueryParams() query: GetLeaderboardQuery,
    @CurrentUser() user: IUser,
  ): Promise<{
    data: Array<{
      userId: string;
      userName: string;
      completionPercentage: number;
      completedAt: Date | null;
      rank: number;
    }>;
    totalDocuments: number;
    totalPages: number;
    currentPage: number;
  }> {
    const { courseId, versionId } = params;
    const { page = 1, limit = 10 } = query;
    const userId = user._id?.toString();
    return await this.progressService.getLeaderboard(
      userId,
      courseId,
      versionId,
      page,
      limit,
    );
  }

  @Post('/progress/recalculate')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @OpenAPI({
    summary: 'Recalculate student progress',
    description:
      'Recalculates and updates the progress of a student for a given course and course version.',
  })
  @Authorized()
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to recalculate student progress',
    statusCode: 500,
  })
  async recalculateStudentProgress(
    @Body() body: CourseVersionQuery & { userId?: string, cohortId?: string },
    @CurrentUser() currentUser: IUser,
    @Ability(getProgressAbility) { ability, user: actorUser },
    @Req() req: Request,
  ): Promise<string> {
    const { courseId, courseVersionId, userId: requestedUserId , cohortId } = body;

    // Determine target user
    const targetUserId = requestedUserId ?? currentUser._id?.toString();

    if (!targetUserId) {
      throw new BadRequestError('Unable to determine target user');
    }

    // Build CASL subject
    const progressResource = subject('Progress', {
      userId: targetUserId,
      courseId,
      versionId: courseVersionId,
    });

    // Permission check
    if (!ability.can(ProgressActions.Modify, progressResource)) {
      throw new ForbiddenError(
        'You do not have permission to recalculate progress for this user',
      );
    }

    // Get progress BEFORE recalculation
    const previousProgress =
      await this.progressService.getUserProgressPercentage(
        targetUserId,
        courseId,
        courseVersionId,
        cohortId
      );

    // Recalculate
    const result = await this.progressService.recalculateStudentProgress(
      targetUserId,
      courseId,
      courseVersionId,
      cohortId
    );

    // Get progress AFTER recalculation
    const updatedProgress =
      await this.progressService.getUserProgressPercentage(
        targetUserId,
        courseId,
        courseVersionId,
        cohortId
      );

    // Audit log
    setAuditTrail(req, {
      category: AuditCategory.PROGRESS,
      action: AuditAction.PROGRESS_RECALCULATE,
      actor: {
        id: ObjectId.createFromHexString(actorUser._id.toString()),
        name: `${actorUser.firstName} ${actorUser.lastName}`,
        email: actorUser.email,
        role: actorUser.roles,
      },
      context: {
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(courseVersionId),
        userId: ObjectId.createFromHexString(targetUserId),
      },
      changes: {
        before: {
          completedPercentage: previousProgress?.percentCompleted ?? 0,
        },
        after: {
          completedPercentage: updatedProgress?.percentCompleted ?? 0,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return result;
  }
  @OpenAPI({
    summary: 'Get module wise progress',
    description:
      'Returns total items and completed items for each module in a course version for the current user.',
  })
  @Authorized()
  @Get('/progress/courses/:courseId/versions/:versionId/modules')
  @HttpCode(200)
  @ResponseSchema(ProgressDataResponse, {
    description: 'Module wise progress retrieved successfully',
    isArray: true,
  })
  @ResponseSchema(ProgressNotFoundErrorResponse, {
    description: 'Progress not found',
    statusCode: 404,
  })
  async getModuleWiseProgress(
    @Params() params: GetUserProgressParams,
    @Ability(getProgressAbility) { ability, user },
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<
    Array<{
      moduleId: string;
      moduleName: string;
      totalItems: number;
      completedItems: number;
    }>
  > {
    const { courseId, versionId } = params;
    const userId = user._id.toString();

    // Permission check
    const progressResource = subject('Progress', {
      userId,
      courseId,
      versionId,
    });

    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError(
        'You do not have permission to view this progress',
      );
    }

    return await this.progressService.getModuleWiseProgress(
      userId,
      courseId,
      versionId,
      cohortId
    );
  }

  ///////////////////////////////////////////////////// TO CORRECT THE WATCHTIME DOC COUNT OF STUDENTS ////////////////////////////////////////////
  @Post('/progress/watch-time/bulk')
  @HttpCode(201)
  @OpenAPI({
    summary: 'Create bulk watch-time records',
    description:
      'Creates multiple watch-time entries in a single request for better performance',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to create watch-time records',
    statusCode: 500,
  })
  async createBulkWatchiTimeDocs(@Body() body: any): Promise<any> {
    const { courseId, versionId, userId } = body;
    return this.progressService.createBulkWatchiTimeDocs(
      courseId,
      versionId,
      userId ?? null,
    );
  }

  /////////////////////////////// TEMP ENDPOINT WITHOUT AUTH //////////////////////////////////
  @Get('/progress/courses/:courseId/versions/:versionId/leaderboard/no-auth')
  @OpenAPI({
    summary: 'Get course leaderboard without authorization',
    description:
      'Returns ranked list of students based on completion percentage and time',
  })
  @ResponseSchema(GetLeaderboardResponse, {
    description: 'Leaderboard retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to fetch leaderboard',
    statusCode: 500,
  })
  async getNoAuthLeaderboard(
    @Params() params: GetUserProgressParams,
  ): Promise<GetLeaderboardResponse> {
    const { courseId, versionId } = params;
    // const {page = 1, limit = 10} = query;

    return await this.progressService.getLeaderboardNoAuth(
      courseId,
      versionId,
      // page,
      // limit,
    );
  }
}
export { ProgressController };
