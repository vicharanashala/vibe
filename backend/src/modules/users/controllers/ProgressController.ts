import { Progress } from '#users/classes/transformers/Progress.js';
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
  WatchTimeBody,
  CompletedProgressResponse,
  WatchTimeResponse,
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
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { UserNotFoundErrorResponse } from '../classes/validators/UserValidators.js';
import { ProgressActions, getProgressAbility } from '../abilities/progressAbilities.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import { QuizService } from '#root/modules/quizzes/services/index.js';

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
  ) { }

  @OpenAPI({
    summary: 'Get user progress in a course version',
    description: 'Retrieves the progress of a user in a specific course version.',
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
    @Ability(getProgressAbility) {ability, user},
  ): Promise<Progress> {
    const { courseId, versionId } = params;
    const userId = user._id.toString();
    
    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });
    
    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError('You do not have permission to view this progress');
    }
    
    const progress = await this.progressService.getUserProgress(
      userId,
      courseId,
      versionId,
    );

    return progress;
  }

  @OpenAPI({
    summary: 'Get %age progress in a course version',
    description: 'Retrieves the progress of a user in a specific course version.',
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
    @Ability(getProgressAbility) {ability, user},
  ): Promise<CompletedProgressResponse> {
    const { courseId, versionId } = params;
    const userId = user._id.toString();
    
    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });
    
    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError('You do not have permission to view this progress');
    }
    
    const progress = await this.progressService.getUserProgressPercentage(
      userId,
      courseId,
      versionId,
    );

    return progress;
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
  @ResponseSchema(BadRequestError, {
    description: 'courseVersionId, moduleId, sectionId, or itemId do not match user progress',
    statusCode: 400,
  })
  async startItem(
    @Params() params: StartItemParams,
    @Body() body: StartItemBody,
    @Ability(getProgressAbility) {ability, user}
  ): Promise<StartItemResponse> {
    const { courseId, versionId } = params;
    const { itemId, moduleId, sectionId } = body;
    const userId = user._id.toString();
    
    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });
    
    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.Modify, progressResource)) {
      throw new ForbiddenError('You do not have permission to modify this progress');
    }
    const watchItemId: string = await this.progressService.startItem(
      userId,
      courseId,
      versionId,
      moduleId,
      sectionId,
      itemId,
    );

    return new StartItemResponse({
      watchItemId,
    });
  }

  @OpenAPI({
    summary: 'Stop an item for user progress',
    description: 'Marks the stop of an item for a user in a course version.',
  })
  @Authorized()
  @Post('/progress/courses/:courseId/versions/:versionId/stop')
  @OnUndefined(200)
  @ResponseSchema(ProgressNotFoundErrorResponse, {
    description: 'Progress not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestError, {
    description: 'courseVersionId, moduleId, sectionId, or itemId do not match user progress',
    statusCode: 400,
  })
  @ResponseSchema(InternalServerError, {
    description: 'Failed to stop tracking item',
    statusCode: 500,
  })
  async stopItem(
    @Params() params: StopItemParams,
    @Body() body: StopItemBody,
    @Ability(getProgressAbility) {ability, user}
  ): Promise<void> {
    const { courseId, versionId } = params;
    const { itemId, sectionId, moduleId, watchItemId, attemptId } = body;
    const userId = user._id.toString();
    
    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });
    
    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.Modify, progressResource)) {
      throw new ForbiddenError('You do not have permission to modify this progress');
    }
    
    await this.progressService.stopItem(
      userId,
      courseId,
      versionId,
      itemId,
      sectionId,
      moduleId,
      watchItemId,
    );

    await this.progressService.updateProgress(
      userId,
      courseId,
      versionId,
      moduleId,
      sectionId,
      itemId,
      watchItemId,
      attemptId,
    );
  }

  @OpenAPI({
    summary: 'Reset user progress',
    description: `Resets the user's progress in a course version. 
If only moduleId is provided, resets to the beginning of the module. 
If moduleId and sectionId are provided, resets to the beginning of the section. 
If moduleId, sectionId, and itemId are provided, resets to the beginning of the item. 
If none are provided, resets to the beginning of the course.`,
  })
  @Authorized()
  @Patch('/:userId/progress/courses/:courseId/versions/:versionId/reset')
  @OnUndefined(200)
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  @ResponseSchema(InternalServerError, {
    description: 'Progress could not be reset',
    statusCode: 500,
  })
  async resetProgress(
    @Params() params: ResetCourseProgressParams,
    @Body() body: ResetCourseProgressBody,
    @Ability(getProgressAbility) {ability}
  ): Promise<void> {
    const { userId, courseId, versionId } = params;
    const { moduleId, sectionId, itemId } = body;
    
    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });
    
    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.Modify, progressResource)) {
      throw new ForbiddenError('You do not have permission to modify this progress');
    }

    // Check if only moduleId is provided
    // If so, reset progress to the beginning of the module
    if (moduleId && !sectionId && !itemId) {
      await this.progressService.resetCourseProgressToModule(
        userId,
        courseId,
        versionId,
        moduleId,
      );
    }

    // Check if moduleId and sectionId are provided
    // If so, reset progress to the beginning of the section
    else if (moduleId && sectionId && !itemId) {
      await this.progressService.resetCourseProgressToSection(
        userId,
        courseId,
        versionId,
        moduleId,
        sectionId,
      );
    }

    // Check if moduleId, sectionId, and itemId are provided
    // If so, reset progress to the beginning of the item
    else if (moduleId && sectionId && itemId) {
      await this.progressService.resetCourseProgressToItem(
        userId,
        courseId,
        versionId,
        moduleId,
        sectionId,
        itemId,
      );
    }

    // If no moduleId, sectionId, or itemId are provided, reset progress to the beginning of the course
    else {
      await this.progressService.resetCourseProgress(
        userId,
        courseId,
        versionId,
      );
    }
  }

  @OpenAPI({
    summary: 'Get User Watch Time',
    description: `Gets the User Watch Time for the given Item Id`,
  })
  @Authorized()
  @Get('/:userId/watchTime/item/:itemId/')
  @OnUndefined(200)
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  @ResponseSchema(InternalServerError, {
    description: 'Could not Fetch the Watch Time',
    statusCode: 500,
  })
  async getWatchTime(
    @Params() params: WatchTimeParams,
    @Body() body: WatchTimeBody,
    @Ability(getProgressAbility) {ability}
  ): Promise<WatchTimeResponse> {
    const { userId, itemId } = params;
    const { courseId, versionId, type } = body;

    // Create a progress resource object for permission checking
    const progressResource = subject('Progress', { userId, courseId, versionId });
    // Check permission using ability.can() with the actual progress resource
    if (!ability.can(ProgressActions.View, progressResource)) {
      throw new ForbiddenError('You do not have permission to view this progress');
    }

    const watchTime = await this.progressService.getWatchTime(
      userId,
      itemId,
      courseId,
      versionId,
    )

    if (type === 'QUIZ'){
      const quizMetrics = await this.quizService.getUserMetricsForQuiz(userId, itemId);
      if (quizMetrics) {
        return {watchTime, quizMetrics}
      }
    }

    return {watchTime};
  }

  @OpenAPI({
    summary: 'Get Total Watch Time of User',
    description: `Gets the Total Watch Time of the User`,
  })
  @Authorized()
  @Get('/watchtime/total')
  @HttpCode(200)
  async getTotalWatchtimeOfUser(@Ability(getProgressAbility) {user}): Promise<number> {
    const userId = user._id.toString();
    
    const totalWatchTime = await this.progressService.getTotalWatchtimeOfUser(userId);
    return totalWatchTime;
  }
}
export { ProgressController };
