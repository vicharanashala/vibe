import { inject, injectable } from 'inversify';
import {
  Authorized,
  Body,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Param,
  Params,
  Patch,
  Post,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { COURSE_REGISTRATION_TYPES } from '../types.js';
import { CourseRegistrationService } from '../services/CourseRegistrationService.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { BadRequestErrorResponse, IReport } from '#root/shared/index.js';
import { subject } from '@casl/ability';
import { CourseAndVersionId } from '#root/modules/notifications/index.js';


@OpenAPI({
  tags: ['CourseRegistration'],
  description: 'Operations for managing course registration',
})
@injectable()
@JsonController('/course/registration')

class CourseRegistrationController {
  constructor(
    @inject(COURSE_REGISTRATION_TYPES.CourseRegistrationService)
    private readonly courseRegistrationService: CourseRegistrationService
  ){}

  @OpenAPI({
    summary: 'Get Data for course Details page',
    description: 'Get all the Data to load in the course details page for student registration.',
  })
  // @Authorized()
  @Get('/:courseId/:versionId')
  @HttpCode(201)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async courseDetails(
    @Params() params:CourseAndVersionId 
  ) {
    const {courseId,versionId} =params
    const result = await this.courseRegistrationService.getCourseDetails(courseId,versionId)
    return {result}
  }
}

export {CourseRegistrationController}