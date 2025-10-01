import {inject, injectable} from 'inversify';
import {
  Authorized,
  BadRequestError,
  Body,
  CurrentUser,
  Delete,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Param,
  Params,
  Patch,
  Post,
  Put,
  QueryParams,
  Req,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {COURSE_REGISTRATION_TYPES} from '../types.js';
import {CourseRegistrationService} from '../services/CourseRegistrationService.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {BadRequestErrorResponse} from '#root/shared/index.js';
import {CourseVersionIdParams} from '#root/modules/notifications/index.js';
import {
  BulkUpdateStatusBody,
  CourseRegistrationBody,
  RegistrationFilterQuery,
  RegistrationParams,
  UpdateRegistrationSchemasBody,
  // updateSettingsBody,
  UpdateStatusBody,
} from '../classes/index.js';
import {
  CourseRegistrationActions,
  courseRegistrationSubject,
  getCourseRegistrationAbility,
} from '../abilities/CourseRegistrationAbilities.js';
import {subject} from '@casl/ability';
import {ObjectId} from 'mongodb';

@OpenAPI({
  tags: ['CourseRegistration'],
  description: 'Operations for managing course registration',
})
@injectable()
@JsonController('/course/registration')
class CourseRegistrationController {
  constructor(
    @inject(COURSE_REGISTRATION_TYPES.CourseRegistrationService)
    private readonly courseRegistrationService: CourseRegistrationService,
  ) {}

  @OpenAPI({
    summary: 'Get Data for course Details page',
    description:
      'Get all the Data to load in the course details page for student registration.',
  })
  @Authorized()
  @Get('/version/:versionId')
  @HttpCode(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async courseDetails(@Params() params: CourseVersionIdParams) {
    const {versionId} = params;
    const result = await this.courseRegistrationService.getCourseDetails(
      versionId,
    );
    return result;
  }

  //Course Registration For students

  @OpenAPI({
    summary: 'Form Submission for User Course Registration',
    description: 'Details submitted from users for the course registration.',
  })
  @Authorized()
  @Post('/version/:versionId')
  @HttpCode(201)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async courseRegistration(
    @Params() params: CourseVersionIdParams,
    @Body() body: CourseRegistrationBody,
    @Ability(getCourseRegistrationAbility) {ability, user},
    @Req() req: any,
  ) {
    // const userId = req.user?.id || '124'
    const userId = user._id;
    const {versionId} = params;
    const registrationData = {
      userId,
      versionId,
      detail: body,
      status: 'PENDING' as const,
    };

    const result = await this.courseRegistrationService.create(
      registrationData,
    );
    return result;
  }

  @OpenAPI({
    summary: 'Get Data for course Details page',
    description:
      'Get all the Data to load in the course details page for student registration.',
  })
  @Get('/requests/version/:versionId')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getAllRegistrations(
    @Params() params: CourseVersionIdParams,
    @QueryParams() query: RegistrationFilterQuery,
    @Ability(getCourseRegistrationAbility) {ability, user},
  ) {
    const {versionId} = params;
    const {page, limit, status, search, sort} = query;

    // const courseRegistrationResource = subject(courseRegistrationSubject, {
    //   courseVersionId: new ObjectId(versionId),
    // });

    // if (
    //   !ability.can(CourseRegistrationActions.View, courseRegistrationResource)
    // ) {
    //   throw new ForbiddenError(
    //     'You do not have permission to view registrations',
    //   );
    // }

    const result = await this.courseRegistrationService.getAllregistrations(
      versionId,
      page,
      limit,
      status,
      search,
      sort,
    );
    return result;
  }

  @OpenAPI({
    summary: 'Update Enrollment Progress',
    description: 'Update the registration status of a student',
  })
  @Authorized()
  @Patch('/status/:registrationId', {transformResponse: true})
  @ResponseSchema(BadRequestError, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateStatus(
    @Params() params: RegistrationParams,
    @Body() body: UpdateStatusBody,
    @Ability(getCourseRegistrationAbility) {ability, user},
  ) {
    const {registrationId} = params;
    const {status} = body;

    const result = await this.courseRegistrationService.updateStatus(
      registrationId,
      status,
    );
    console.log('result from controller ', result);
    return {
      message: 'Registration status updated successfully',
      registration: result,
    };
  }

  @OpenAPI({
    summary: 'Update Enrollment Progress on Bulk',
    description: 'Update the status of registration on Bulk Manner',
  })
  @Authorized()
  @Patch('/status/update/bulk', {transformResponse: true})
  @ResponseSchema(BadRequestError, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateStatusBulk(
    @Body() body: BulkUpdateStatusBody,
    @Ability(getCourseRegistrationAbility) {ability},
  ) {
    const {registrationIds} = body;
    const result = await this.courseRegistrationService.updateBulkStatus(
      registrationIds,
    );
    return {
      message: 'Registration status updated successfully',
      registration: result,
    };
  }

  @Get('/settings/version/:versionId')
  // @Authorized()
  async getSettings(
    @Params() params: CourseVersionIdParams,
    // @Ability(getCourseRegistrationAbility) {ability},
  ) {
    const {versionId} = params;

    // if (
    //   !ability.can(
    //     CourseRegistrationActions.View,
    //     subject(courseRegistrationSubject, {versionId}),
    //   )
    // ) {
    //   throw new ForbiddenError('You do not have permission to view settings');
    // }

    return this.courseRegistrationService.getSettings(versionId);
  }

  @Put('/settings/version/:versionId')
  @Authorized()
  async updateSettings(
    @Params() params: CourseVersionIdParams,
    @Body() body: UpdateRegistrationSchemasBody,
    @Ability(getCourseRegistrationAbility) {ability},
  ) {
    const {versionId} = params;
    // if (
    //   !ability.can(
    //     CourseRegistrationActions.Modify,
    //     subject(courseRegistrationSubject, {versionId}),
    //   )
    // ) {
    //   throw new ForbiddenError('You do not have permission to modify settings');
    // }

    return this.courseRegistrationService.updateSettings(versionId, body);
  }
}

export {CourseRegistrationController};
