import { IUserActivityEvent } from '#shared/interfaces/models.js';
import { UserActivityEventService } from '#users/services/UserActivityEventService.js';
import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Post,
  Body,
  OnUndefined,
  InternalServerError,
  ForbiddenError,
  Authorized,
  HttpCode,
  CurrentUser,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { IUser } from '#root/shared/index.js';
import { InternalServerErrorResponse } from '../../../shared/middleware/errorHandler.js';

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

class UserActivityEventResponse {
  success: boolean;
  userActivityEvent?: IUserActivityEvent;
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
}

export { UserActivityEventController };
