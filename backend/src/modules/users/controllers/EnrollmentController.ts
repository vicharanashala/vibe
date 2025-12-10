import { EnrollmentService } from '#users/services/EnrollmentService.js';
import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Post,
  HttpCode,
  Get,
  Authorized,
  QueryParams,
  Patch,
  Req,
  CurrentUser,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import {
  getEnrollmentAbility,
} from '../abilities/enrollmentAbilities.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { BadRequestErrorResponse, EnrollmentFilterQuery, IUser } from '#root/shared/index.js';
import { EnrollmentNotFoundErrorResponse, EnrollmentResponse } from '../classes/index.js';

@OpenAPI({
  tags: ['Enrollment'],
})
@JsonController('/enrollments', { transformResponse: true })
@injectable()
export class EnrollmentController {
  constructor(
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) { }
  @OpenAPI({
    summary: 'Get all enrollments for a user',
    description:
      'Retrieves a paginated list of all course enrollments for a user.',
  })
  @Authorized()
  @Get('/')
  @HttpCode(200)
  @ResponseSchema(EnrollmentResponse, {
    description: 'Paginated list of user enrollments',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'No enrollments found for the user',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async getUserEnrollments(
    @QueryParams() query: EnrollmentFilterQuery,
    // @Ability(getEnrollmentAbility) { user }, @Req() req: any,
    @CurrentUser() user:IUser
  ): Promise<EnrollmentResponse> {
    const { page, limit, search = "", role } = query;
    const userId = user._id.toString();
    // const userId =''
    const skip = (page - 1) * limit;
    // console.log("session on the dashboard ", req.session)
    // if (req.session.bulkInviteId) {
    //   console.log("bulk id in session dashboard ", req.session.bulkInviteId)
    //   let result = await this.enrollmentService.processBulkInvite(userId, req.session.bulkInviteId)
    //   console.log("result after enrollment ", result)
    //   delete req.session.bulkInviteId
    //   await new Promise<void>((resolve, reject) => {
    //     req.session.save(err => err ? reject(err) : resolve());
    //   });
    // }
    const enrollments = await this.enrollmentService.getEnrollments(
      userId,
      skip,
      limit,
      role,
      search,
    );

    const totalDocuments = await this.enrollmentService.countEnrollments(
      userId,
      role
    );

    if (!enrollments || enrollments.length === 0) {
      return {
        totalDocuments: 0,
        totalPages: 0,
        currentPage: page,
        enrollments: [],
        message: 'No enrollments found for the user',
      };
    }

    return {
      totalDocuments,
      totalPages: Math.ceil(totalDocuments / limit),
      currentPage: page,
      enrollments,
    };
  }

}