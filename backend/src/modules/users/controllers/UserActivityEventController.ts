import { IUserActivityEvent } from '#shared/interfaces/models.js';
import { UserActivityEventService } from '#users/services/UserActivityEventService.js';
import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Post,
  Get,
  Body,
  OnUndefined,
  InternalServerError,
  ForbiddenError,
  Authorized,
  HttpCode,
  CurrentUser,
  Params,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { IUser } from '#root/shared/index.js';
import { InternalServerErrorResponse } from '../../../shared/middleware/errorHandler.js';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

// Request body for the single endpoint
class UserActivityEventRequestBody {
  rewinds: number;
  fastForwards: number;
  videoId: string;
  userId: string;
  courseId: string;
  versionId: string;
  rewindData: Array<{
    from: string;
    to: string;
    createdAt: string;
  }>;
  fastForwardData: Array<{
    from: string;
    to: string;
    createdAt: string;
  }>;
}

// Parameter validator for userId
class GetUserActivityEventsParams {
  @JSONSchema({
    description: 'User ID to fetch activity events for',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @JSONSchema({
    description: 'VideoId to fetch activity events for',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  videoId: string;

  @JSONSchema({
    description: 'CourseId to fetch activity events for',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'VersionId to fetch activity events for',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  versionId: string;


}

class UserActivityEventResponse {
  success: boolean;
  userActivityEvents?: IUserActivityEvent[];
}

@OpenAPI({
  tags: ['User Activity Events'],
})
@JsonController('/users/user-activity-events', { transformResponse: true })
@injectable()
class UserActivityEventController {
  constructor(
    @inject(USERS_TYPES.UserActivityEventService)
    private readonly userActivityEventService: UserActivityEventService,
  ) {}

  @OpenAPI({
    summary: 'Store user activity event data',
    description:
      'Stores complete user activity event data including rewinds and fast forwards for a video.',
  })
  @Authorized()
  @Post('/')
  @HttpCode(200)
  @ResponseSchema(UserActivityEventResponse, {
    description: 'User activity event data stored successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to store user activity event data',
    statusCode: 500,
  })
  async CreateUserActivityEvent(
    @Body() body: UserActivityEventRequestBody,
    @CurrentUser() user: IUser,
  ): Promise<{ success: boolean; userActivityEvent?: IUserActivityEvent }> {
    const userId = user._id.toString();

    const userActivityEvent = await this.userActivityEventService.CreateUserActivityEvent(
      userId,
      body,
    );

    return { success: true, userActivityEvent };
  }

  @OpenAPI({
    summary: 'Get user activity events',
    description:
      'Retrieves user activity events for a specific user and video.',
  })
  @Authorized()
  @Get('/:userId/videoId/:videoId/courseId/:courseId/versionId/:versionId')
  @HttpCode(200)
  @ResponseSchema(UserActivityEventResponse, {
    description: 'User activity events retrieved successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to retrieve user activity events',
    statusCode: 500,
  })
  async GetUserActivityEvents(
    @Params() params: GetUserActivityEventsParams,
    @CurrentUser() user: IUser,
  ): Promise<{ success: boolean; userActivityEvents?: IUserActivityEvent[] }> {
    // Allow users to fetch their own data or instructors/managers to fetch any data
    const currentUserId = user._id.toString();
    const requestUserId = params.userId;

    const userActivityEvents = await this.userActivityEventService.GetUserActivityEvents(
      requestUserId,
      params.videoId,
      params.courseId,
      params.versionId,
    );

    return { success: true, userActivityEvents };
  }
}

export { UserActivityEventController };
