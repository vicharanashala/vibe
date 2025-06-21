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
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {InviteService} from '../services/InviteService.js';
import {InviteBody, InviteResponse} from '../classes/validators/InviteValidators.js';
import {InviteProResponse} from '../classes/transformers/Invite.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {SignUpBody} from '#auth/classes/validators/AuthValidators.js'
import { NOTIFICATIONS_TYPES } from '../types.js';


/**
 * Controller for managing student enrollments in courses.
 *
 * @category Invite/Controllers
 */
@OpenAPI({
  tags: ['Invite Notifications'],
})
@JsonController('/notifications/invite', {transformResponse: true})
@injectable()
export class InviteController {
  constructor(
    @inject(NOTIFICATIONS_TYPES.InviteService)
    private readonly inviteService: InviteService,
  ) {}

//@Authorized(['instructor']) // Or use another role or remove if not required
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
    summary: 'Invite multiple users to a course',
    description: 'Invites multiple users to a specific version of a course.',
  })
  async inviteUserToCourse(
    @Body() body: InviteBody,
    @Param('courseId') courseId: string,
    @Param('courseVersionId') courseVersionId: string,
  ) {
    

    if (!body.emails || !Array.isArray(body.emails) || body.emails.length === 0) {
      throw new BadRequestError('Email list is missing or invalid');
    }

    try {
      const results = await this.inviteService.inviteUserToCourse(
        body.emails,
        courseId,
        courseVersionId,
      );

      return {
        statusCode: 200,
        results,
      };
    } catch (error) {
      
      throw new InternalServerError('Failed to invite users. Please try again.');
    }
  }

  

  @Post('/:token')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Process Invite',
    description: 'Process an invite using a token.',
    responses: {
      '200': {
        description: 'Invite processed successfully',
      },
      '400': {
        description: 'Invalid or expired token / signup required / no account',
      },
      '500': {
        description: 'Internal server error',
      },
    },
  })
  @ResponseSchema(InviteProResponse)
  async process(@Param('token') token: string): Promise<InviteProResponse> {
    try {
      const response = await this.inviteService.processInvite(token);
      if(response.statusCode && response.statusCode !== 200) {
        return new InviteProResponse(
          response.statusCode,
          response.error,
          response.message,
        );
      }else{
        return new InviteProResponse(
          200,
          'success',
          'Invite processed successfully',
          response.courseId,
          response.courseVersionId,
          response.email,
        );
      }
    } catch (error) {
      
      return new InviteProResponse(
        500,
        'internal_server_error',
        'Something went wrong while processing the invite'
      );
    }
  }
}


