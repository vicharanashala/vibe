import { inject, injectable } from 'inversify';
import {
  Authorized,
  BadRequestError,
  Body,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Params,
  Patch,
  Post,
  Put,
  QueryParams,
  Req,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { COURSE_REGISTRATION_TYPES } from '../types.js';
import { CourseRegistrationService } from '../services/CourseRegistrationService.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { BadRequestErrorResponse } from '#root/shared/index.js';
import { CourseVersionIdParams } from '#root/modules/notifications/index.js';
import {
  AllRegistrationsResponse,
  BulkUpdateStatusBody,
  CourseVersionDetailsResponse,
  RegistrationFilterQuery,
  RegistrationParams,
  UpdateRegistrationSchemasBody,
  UpdateStatusBody,
  updateStatusBulkResponse,
  updateStatusResponse,
} from '../classes/index.js';
import {
  CourseRegistrationActions,
  courseRegistrationSubject,
  getCourseRegistrationAbility,
} from '../abilities/CourseRegistrationAbilities.js';
import { subject } from '@casl/ability';
import { UpdateCourseSettingResponse, UpdateSettingResponse } from '#root/modules/setting/index.js';

@OpenAPI({
  tags: ['CourseRegistration'],
  description: 'Operations for managing course registration',
})
@injectable()
@Authorized()
@JsonController('/course/registration')
class CourseRegistrationController {
  constructor(
    @inject(COURSE_REGISTRATION_TYPES.CourseRegistrationService)
    private readonly courseRegistrationService: CourseRegistrationService,
  ) { }

  @OpenAPI({
    summary: 'Get Data for course Details page',
    description:
      'Get all the Data to load in the course details page for student registration.',
  })
  @Authorized()
  @Get('/version/:versionId')
  @HttpCode(200)
  @Authorized()
  @ResponseSchema(CourseVersionDetailsResponse, {
    description: 'Course details retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async courseDetails(@Params() params: CourseVersionIdParams) {
    const { versionId } = params;
    const result = await this.courseRegistrationService.getCourseDetails(
      versionId,
    );
    return result;
  }

  //Course Registration For students

  @OpenAPI({
    summary: 'Form Submission for User Course Registration',
    description: 'Details submitted from users for the course registration.',
    responses:
    {
      '201': {
        description: 'Course registration created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                result: {
                  type: 'String',
                  example: '60d5ec49b3f1c8e4a8f8b8d1'
                }

              },
            },
          },
        },
      },
    },

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
    @Body() body: Record<string, any>,
    @Ability(getCourseRegistrationAbility) { ability, user },
    @Req() req: any,
  ) {
    const userId = user._id;
    const { versionId } = params;

    // Extract and verify reCAPTCHA token
    const recaptchaToken = body.recaptchaToken;

    if (!recaptchaToken) {
      throw new BadRequestError('reCAPTCHA verification is required');
    }

    // Import and verify reCAPTCHA
    const { verifyRecaptcha } = await import('#root/shared/functions/verifyRecaptcha.js');

    try {
      const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidRecaptcha) {
        throw new BadRequestError('reCAPTCHA verification failed. Please try again.');
      }
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new BadRequestError('Failed to verify reCAPTCHA. Please try again.');
    }

    // Remove recaptchaToken from body before processing
    const { recaptchaToken: _, ...registrationBody } = body;

    const registrationData = {
      userId,
      versionId,
      detail: registrationBody,
      status: 'PENDING' as const,
    };

    const result = await this.courseRegistrationService.create(
      registrationData,
    );
    if (versionId === "6981df886e100cfe04f9c4ae")
      await this.courseRegistrationService.updateStatus(result, "APPROVED");
    return result;
  }

  @OpenAPI({
    summary: 'Get all request details in instructor side',
    description:
      'Get all the Data to load in the course registration request page in instructor side',
  })
  @Get('/requests/version/:versionId')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(AllRegistrationsResponse, {
    description: 'All registrations retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getAllRegistrations(
    @Params() params: CourseVersionIdParams,
    @QueryParams() query: RegistrationFilterQuery,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;
    const { page, limit, status, search, sort } = query;

    const courseRegistrationResource = subject(courseRegistrationSubject, {
      versionId,
    });

    if (
      !ability.can(CourseRegistrationActions.View, courseRegistrationResource)
    ) {
      throw new ForbiddenError(
        'You do not have permission to view registrations',
      );
    }
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
  @Patch('/status/:registrationId', { transformResponse: true })
  @ResponseSchema(updateStatusResponse, {
    description: 'Registration status updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateStatus(
    @Params() params: RegistrationParams,
    @Body() body: UpdateStatusBody,
    @Ability(getCourseRegistrationAbility) { ability, user },
  ) {
    const { registrationId } = params;
    const { status } = body;

    const result = await this.courseRegistrationService.updateStatus(
      registrationId,
      status,
    );
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
  @Patch('/status/update/bulk', { transformResponse: true })
  @ResponseSchema(updateStatusBulkResponse, {
    description: 'Registration status updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateStatusBulk(
    @Body() body: BulkUpdateStatusBody,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { selected } = body;
    const result = await this.courseRegistrationService.updateBulkStatus(
      selected,
    );
    return {
      message: 'Registration status updated successfully',
      registration: result,
    };
  }

  @Get('/build-form/version/:versionId')
  @Authorized()
  @ResponseSchema(UpdateRegistrationSchemasBody, {
    description: 'Registration settings retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getSettings(
    @Params() params: CourseVersionIdParams,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;

    const courseRegistrationResource = subject(courseRegistrationSubject, {
      versionId,
    });

    if (
      !ability.can(CourseRegistrationActions.View, courseRegistrationResource)
    ) {
      throw new ForbiddenError('You do not have permission to view this page');
    }

    return this.courseRegistrationService.getSettings(versionId);
  }

  @Put('/build-form/version/:versionId')
  @Authorized()
  @ResponseSchema(UpdateSettingResponse, {
    description: 'Registration settings updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateSettings(
    @Params() params: CourseVersionIdParams,
    @Body() body: UpdateRegistrationSchemasBody,
    @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;
    if (
      !ability.can(
        CourseRegistrationActions.Modify,
        subject(courseRegistrationSubject, { versionId }),
      )
    ) {
      throw new ForbiddenError('You do not have permission to modify settings');
    }
    return this.courseRegistrationService.updateSettings(versionId, body);
  }

  @OpenAPI({
    summary: 'Get Data for student registration form',
    description:
      'Get all the Data to load in the register form page for student registration.',
  })
  @Get('/form/version/:versionId')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(UpdateRegistrationSchemasBody, {
    description: 'Course details retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getRegistrationForm(
    @Params() params: CourseVersionIdParams,
    // @Ability(getCourseRegistrationAbility) { ability },
  ) {
    const { versionId } = params;

    // const courseRegistrationResource = subject(courseRegistrationSubject, {
    //   versionId,
    // });

    // if (
    //   !ability.can(CourseRegistrationActions.View, courseRegistrationResource)
    // ) {
    //   throw new ForbiddenError('You do not have permission to view registration form');
    // }

    const result = await this.courseRegistrationService.getRegistrationForm(
      versionId,
    );
    return result;
  }
}

export { CourseRegistrationController };
