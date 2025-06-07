import 'reflect-metadata';
import {
  Body,
  Get,
  HttpCode,
  JsonController,
  OnUndefined,
  Params,
  Patch,
  Post,
} from 'routing-controllers';
import {inject, injectable} from 'inversify';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {Progress} from '../classes/transformers';
import {ProgressService} from '../services/ProgressService';
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
} from '../classes/validators';
import TYPES from '../types';

@OpenAPI({
  tags: ['User Progress'],
})
@JsonController('/users', {transformResponse: true})
@injectable()
class ProgressController {
  constructor(
    @inject(TYPES.ProgressService)
    private readonly progressService: ProgressService,
  ) {}

  @Get('/:userId/progress/courses/:courseId/versions/:courseVersionId/')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get user progress',
    description: 'Retrieve progress for a user in a specific course version',
  })
  @ResponseSchema(Progress, {
    description: 'User progress retrieved successfully',
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

  @Post('/:userId/progress/courses/:courseId/versions/:courseVersionId/start')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Start an item',
    description: 'Mark an item as started for a user',
  })
  @ResponseSchema(StartItemResponse, {
    description: 'Item started successfully',
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

  @Post('/:userId/progress/courses/:courseId/versions/:courseVersionId/stop')
  @OnUndefined(200)
  @OpenAPI({
    summary: 'Stop an item',
    description: 'Mark an item as stopped for a user',
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

  @Patch('/:userId/progress/courses/:courseId/versions/:courseVersionId/update')
  @OnUndefined(200)
  @OpenAPI({
    summary: 'Update progress',
    description: 'Update progress for a user in a specific course version',
  })
  async updateProgress(
    @Params() params: UpdateProgressParams,
    @Body() body: UpdateProgressBody,
  ): Promise<void> {
    const {userId, courseId, courseVersionId} = params;
    const {itemId, moduleId, sectionId, watchItemId} = body;

    await this.progressService.updateProgress(
      userId,
      courseId,
      courseVersionId,
      moduleId,
      sectionId,
      itemId,
      watchItemId,
    );
  }

  @Patch('/:userId/progress/courses/:courseId/versions/:courseVersionId/reset')
  @OnUndefined(200)
  @OpenAPI({
    summary: 'Reset course progress',
    description: 'Reset all progress for a user in a specific course version',
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
