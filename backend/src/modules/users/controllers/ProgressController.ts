import { User } from '#root/modules/auth/classes/index.js';
import {Progress} from '#users/classes/transformers/Progress.js';
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
} from '#users/classes/validators/ProgressValidators.js';
import {ProgressService} from '#users/services/ProgressService.js';
import {USERS_TYPES} from '#users/types.js';
import {injectable, inject} from 'inversify';
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
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import { UserNotFoundErrorResponse } from '../classes/validators/UserValidators.js';

@OpenAPI({
  tags: ['Progress'],
})
@JsonController('/users', {transformResponse: true})
@injectable()
class ProgressController {
  constructor(
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,
  ) {}

  @OpenAPI({
    summary: 'Get user progress in a course version',
    description: 'Retrieves the progress of a user in a specific course version.',
  })
  @Get('/:userId/progress/courses/:courseId/versions/:courseVersionId/')
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
  ): Promise<Progress> {
    const {userId, courseId, courseVersionId} = params;

    const progress = await this.progressService.getUserProgress(
      userId,
      courseId,
      courseVersionId,
    );

    return progress;
  }

  @OpenAPI({
    summary: 'Start an item for user progress',
    description: 'Marks the start of an item for a user in a course version.',
  })
  @Post('/:userId/progress/courses/:courseId/versions/:courseVersionId/start')
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
  ): Promise<StartItemResponse> {
    const {userId, courseId, courseVersionId} = params;
    const {itemId, moduleId, sectionId} = body;

    const watchItemId: string = await this.progressService.startItem(
      userId,
      courseId,
      courseVersionId,
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
  @Post('/:userId/progress/courses/:courseId/versions/:courseVersionId/stop')
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
  ): Promise<void> {
    const {userId, courseId, courseVersionId} = params;
    const {itemId, sectionId, moduleId, watchItemId} = body;

    await this.progressService.stopItem(
      userId,
      courseId,
      courseVersionId,
      itemId,
      sectionId,
      moduleId,
      watchItemId,
    );
  }

  @OpenAPI({
    summary: 'Update user progress',
    description: 'Updates the progress of a user for a specific item in a course version.',
  })
  @Patch('/:userId/progress/courses/:courseId/versions/:courseVersionId/update')
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
    description: 'Progress could not be updated',
    statusCode: 500,
  })
  async updateProgress(
    @Params() params: UpdateProgressParams,
    @Body() body: UpdateProgressBody,
  ): Promise<void> {
    const {userId, courseId, courseVersionId} = params;
    const {itemId, moduleId, sectionId, watchItemId, attemptId} = body;

    await this.progressService.updateProgress(
      userId,
      courseId,
      courseVersionId,
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
  @Patch('/:userId/progress/courses/:courseId/versions/:courseVersionId/reset')
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
  ): Promise<void> {
    const {userId, courseId, courseVersionId} = params;
    const {moduleId, sectionId, itemId} = body;

    // Check if only moduleId is provided
    // If so, reset progress to the beginning of the module
    if (moduleId && !sectionId && !itemId) {
      await this.progressService.resetCourseProgressToModule(
        userId,
        courseId,
        courseVersionId,
        moduleId,
      );
    }

    // Check if moduleId and sectionId are provided
    // If so, reset progress to the beginning of the section
    else if (moduleId && sectionId && !itemId) {
      await this.progressService.resetCourseProgressToSection(
        userId,
        courseId,
        courseVersionId,
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
        courseVersionId,
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
        courseVersionId,
      );
    }
  }
}
export {ProgressController};
