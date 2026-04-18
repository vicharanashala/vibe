import 'reflect-metadata';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Get,
  Body,
  ContentType,
  ForbiddenError,
  Authorized,
  CurrentUser,
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { InviteService } from '../services/InviteService.js';
import { CourseAndVersionId, InviteBody, InviteIdParams, InviteResponse, InviteResult } from '../classes/validators/InviteValidators.js';
import { BadRequestErrorResponse } from '#shared/middleware/errorHandler.js';
import { NOTIFICATIONS_TYPES } from '../types.js';
import { MessageResponse } from '../classes/index.js';
import { appConfig } from '#root/config/app.js';
import { inviteRedirectTemplate } from '../redirectTemplate.js';
import { InviteActions, getInviteAbility } from '../abilities/inviteAbilities.js';
import { subject } from '@casl/ability';

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

  @Authorized()
  @Post('/courses/:courseId/versions/:versionId')
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
    @Ability(getInviteAbility) { ability }
  ) {
    const { courseId, versionId } = params;
    const { inviteData } = body;

    // Validate that the user can invite to each specific role
    // This ensures students can only invite students, TAs can invite students/TAs, etc.
    for (const invite of inviteData) {
      const roleSpecificSubject = subject('Invite', {
        courseId,
        versionId,
        targetRole: invite.role
      });

      if (!ability.can(InviteActions.Create, roleSpecificSubject)) {
        throw new ForbiddenError(`You do not have permission to invite users with the role: ${invite.role}`);
      }
    }

    const results: InviteResult[] = await this.inviteService.inviteUserToCourse(
      inviteData,
      courseId,
      versionId,
    );

    return new InviteResponse(results);
  }

  @Get('/:inviteId')
  @HttpCode(200)
  @ContentType('html')
  @OpenAPI({
    summary: 'Process Invite',
    description: 'Process an invite given an inviteId and send a response before redirecting the user.',
    responses: {
      '200': {
        description: 'JSON response with redirect information'
      }
    }
  })
  @ResponseSchema(MessageResponse, {
    description: 'Invite processed successfully',
    statusCode: 200,
  })
  async processInvites(
    @Params() params: InviteIdParams,
  ): Promise<string> {
    const { inviteId } = params;
    const result = await this.inviteService.processInvite(inviteId);
    return inviteRedirectTemplate(result.message, appConfig.frontendUrl);
  }

  @Authorized()
  @Get('/courses/:courseId/versions/:versionId')
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
    @Ability(getInviteAbility) { ability }
  ): Promise<InviteResponse> {
    const { courseId, versionId } = params;

    // Build subject context first
    const inviteContext = { courseId, versionId };
    const inviteSubject = subject('Invite', inviteContext);

    if (!ability.can(InviteActions.View, inviteSubject)) {
      throw new ForbiddenError('You do not have permission to view invites for this course');
    }

    const invites = await this.inviteService.findInvitesForCourse(
      courseId,
      versionId
    );
    return new InviteResponse(invites);
  }

  @Authorized()
  @Get('/')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get Invites for a User',
    description: 'Retrieve all invites for a specific User.',
  })
  @ResponseSchema(InviteResponse, {
    description: 'List of invites for the User',
    statusCode: 200,
  })
  async getInvitesForUser(
    @Ability(getInviteAbility) { ability },
    @CurrentUser() user: { _id: string }
  ): Promise<InviteResponse> {
    const invites = await this.inviteService.findInvitesByUserId(user._id);
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
    @Ability(getInviteAbility) { ability }
  ): Promise<MessageResponse> {
    const { inviteId } = params;
    const invite = await this.inviteService.findInviteById(inviteId);
    // Build subject context first
    const inviteSubject = subject('Invite', { courseId: invite.courseId, versionId: invite.courseVersionId });

    if (!ability.can(InviteActions.Modify, inviteSubject)) {
      throw new ForbiddenError('You do not have permission to resend this invite');
    }

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
    @Ability(getInviteAbility) { ability }
  ): Promise<MessageResponse> {
    const { inviteId } = params;

    const invite = await this.inviteService.findInviteById(inviteId);
    // Build subject context first
    const inviteSubject = subject('Invite', { courseId: invite.courseId, versionId: invite.courseVersionId });

    if (!ability.can(InviteActions.Modify, inviteSubject)) {
      throw new ForbiddenError('You do not have permission to cancel this invite');
    }

    return this.inviteService.cancelInvite(inviteId);
  }
}


