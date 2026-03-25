import 'reflect-metadata';
import {
  JsonController,
  Get,
  Post,
  QueryParams,
  Authorized,
  HttpCode,
  Param,
} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {Expose, Transform} from 'class-transformer';
import {
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {Transform as ClassTransform} from 'class-transformer';
import {NotificationService} from '../services/NotificationService.js';
import {NOTIFICATIONS_TYPES} from '../types.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {getInviteAbility} from '../abilities/inviteAbilities.js';

class NotificationIdParams {
  @IsMongoId()
  notificationId: string;
}

class GetNotificationsQuery {
  @IsOptional()
  @IsNumber()
  @JSONSchema({
    description: 'Max number of notifications to return',
    example: 20,
  })
  @ClassTransform(({value}) => parseInt(value, 10))
  limit?: number;

  @IsOptional()
  @JSONSchema({
    description: 'Return only unread notifications',
    type: 'boolean',
  })
  @ClassTransform(({value}) => value === 'true' || value === true)
  onlyUnread?: boolean;
}

@Expose()
class NotificationResponse {
  @IsString()
  @Expose()
  @ClassTransform(({value}) => value?.toString())
  _id: string;

  @IsString()
  @Expose()
  type: string;

  @IsString()
  @Expose()
  title: string;

  @IsString()
  @Expose()
  message: string;

  @IsBoolean()
  @Expose()
  read: boolean;

  @Expose()
  createdAt: Date;

  @IsOptional()
  @IsString()
  @Expose()
  @ClassTransform(({value}) => value?.toString())
  courseId?: string;

  @IsOptional()
  @IsString()
  @Expose()
  @ClassTransform(({value}) => value?.toString())
  courseVersionId?: string;

  @IsOptional()
  @IsString()
  @Expose()
  @ClassTransform(({value}) => value?.toString())
  cohortId?: string;

  @IsOptional()
  @IsString()
  @Expose()
  @ClassTransform(({value}) => value?.toString())
  policyId?: string;
}

@Expose()
class NotificationsListResponse {
  @Expose()
  notifications: NotificationResponse[];

  @IsNumber()
  @Expose()
  unreadCount: number;
}

@Expose()
class MarkReadResponse {
  @IsString()
  @Expose()
  message: string;
}

@OpenAPI({tags: ['Notifications']})
@JsonController('/notifications/user', {transformResponse: true})
@injectable()
export class NotificationController {
  constructor(
    @inject(NOTIFICATIONS_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
  ) {}

  @Authorized()
  @Get('/')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get notifications for current user',
    description:
      'Returns ejection, reinstatement, and policy notifications for the authenticated user.',
  })
  async getNotifications(
    @QueryParams() query: GetNotificationsQuery,
    @Ability(getInviteAbility) {user},
  ): Promise<NotificationsListResponse> {
    const limit = query.limit ?? 20;
    const onlyUnread = query.onlyUnread ?? false;

    const [rawNotifications, unreadCount] = await Promise.all([
      this.notificationService.getUserNotifications(
        user._id.toString(),
        limit,
        onlyUnread,
      ),
      this.notificationService.getUnreadCount(user._id.toString()),
    ]);

    const notifications = await this.notificationService.enrichWithAppealStatus(
      user._id.toString(),
      rawNotifications,
    );

    return {
      notifications: notifications.map(n => ({
        _id: n._id?.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt,
        courseId: n.courseId?.toString(),
        courseVersionId: n.courseVersionId?.toString(),
        cohortId: n.cohortId?.toString(),
        policyId: n.policyId?.toString(),
        metadata: n.metadata,
        extra: n.extra,
      })) as NotificationResponse[],
      unreadCount,
    };
  }

  @Authorized()
  @Post('/:notificationId/read')
  @HttpCode(200)
  @OpenAPI({summary: 'Mark a notification as read'})
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @Ability(getInviteAbility) {user},
  ): Promise<MarkReadResponse> {
    await this.notificationService.markAsRead(
      notificationId,
      user._id.toString(),
    );

    return {message: 'Notification marked as read'};
  }

  @Authorized()
  @Post('/read-all')
  @HttpCode(200)
  @OpenAPI({summary: 'Mark all notifications as read'})
  async markAllAsRead(
    @Ability(getInviteAbility) {user},
  ): Promise<MarkReadResponse> {
    await this.notificationService.markAllAsRead(user._id.toString());
    return {message: 'All notifications marked as read'};
  }
}
