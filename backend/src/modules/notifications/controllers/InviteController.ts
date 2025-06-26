import 'reflect-metadata';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Authorized,
  BadRequestError,
  Get,
  NotFoundError,
  Param,
  QueryParam,
  InternalServerError,
  Body,
  Res
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { InviteService } from '../services/InviteService.js';
import { CourseAndVersionId, InviteBody, InviteIdParams, InviteResponse, InviteResult } from '../classes/validators/InviteValidators.js';
import { BadRequestErrorResponse } from '#shared/middleware/errorHandler.js';
import { SignUpBody } from '#auth/classes/validators/AuthValidators.js'
import { NOTIFICATIONS_TYPES } from '../types.js';
import { CourseVersion } from '#root/modules/courses/classes/index.js';
import { MessageResponse } from '../classes/index.js';


/**
 * Controller for managing student enrollments in courses.
 *
 * @category Invite/Controllers
 */
@OpenAPI({
  tags: ['Invites'],
})
@JsonController('/notifications/invite', { transformResponse: true })
@injectable()
export class InviteController {
  constructor(
    @inject(NOTIFICATIONS_TYPES.InviteService)
    private readonly inviteService: InviteService,
  ) { }

  @Post('/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
  @ResponseSchema(InviteResponse, {
    description: 'Invite users to a course version',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid input data',
    statusCode: 400,
  })
  @OpenAPI({
    summary: 'Invite users to a course',
    description: 'Invites users to a specific version of a course.',
  })
  async inviteUsers(
    @Body() body: InviteBody,
    @Params() params: CourseAndVersionId,
  ) {
    const { courseId, courseVersionId } = params;
    const { inviteData } = body
    const results: InviteResult[] = await this.inviteService.inviteUserToCourse(
      inviteData,
      courseId,
      courseVersionId,
    );

    return new InviteResponse(results);
  }

  @Get('/:inviteId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Process Invite',
    description: 'Process an invite given an inviteId.'
  })
  @ResponseSchema(MessageResponse, {
    description: 'Invite processed successfully',
    statusCode: 200,
  })
  async processInvites(@Params() params: InviteIdParams): Promise<MessageResponse> {
      const { inviteId } = params;
      const response = await this.inviteService.processInvite(inviteId);
      return response;
  }

  @Get('/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get Invites for Course Version',
    description: 'Retrieve all invites for a specific course version.',
  })
  @ResponseSchema(InviteResponse, {
    description: 'List of invites for the course version',
    statusCode: 200,
  })
  async getInvitesForCourseVersion(
    @Params() params: CourseAndVersionId,
  ): Promise<InviteResponse> {
    const { courseId, courseVersionId } = params;
    const invites = await this.inviteService.findInvitesForCourse(
      courseId,
      courseVersionId
    );
    return new InviteResponse(invites);
  }

  @Post('/resend/:inviteId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Resend Invite',
    description: 'Resend an invite email to the user.',
  })
  @ResponseSchema(MessageResponse, {
    description: 'Invite resent successfully',
    statusCode: 200,
  })
  async resendInvite(
    @Params() params: InviteIdParams,
  ): Promise<MessageResponse> {
    const { inviteId } = params;
    return this.inviteService.resendInvite(inviteId);
  }

  @Post('/cancel/:inviteId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Cancel Invite',
    description: 'Cancel an existing invite.',
  })
  @ResponseSchema(MessageResponse, {
    description: 'Invite cancelled successfully',
    statusCode: 200,
  })
  async cancelInvite(
    @Params() params: InviteIdParams,
  ): Promise<MessageResponse> {
    const { inviteId } = params;
    return this.inviteService.cancelInvite(inviteId);
  } 
}


