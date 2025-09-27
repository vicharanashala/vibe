import { inject, injectable } from 'inversify';
import {
  Authorized,
  BadRequestError,
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
  Req,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { COURSE_REGISTRATION_TYPES } from '../types.js';
import { CourseRegistrationService } from '../services/CourseRegistrationService.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { BadRequestErrorResponse, IReport } from '#root/shared/index.js';
import { subject } from '@casl/ability';
import { CourseAndVersionId, CourseVersionIdParams } from '#root/modules/notifications/index.js';
import { CourseRegistrationBody, RegistrationFilterQuery, RegistrationParams, UpdateStatusBody } from '../classes/index.js';


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
  @Get('/version/:versionId')
  @HttpCode(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async courseDetails(
    @Params() params:CourseVersionIdParams
  ) {
    const {versionId} =params
    const result = await this.courseRegistrationService.getCourseDetails(versionId)
    return result
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
    @Body() body:CourseRegistrationBody,
    @Req() req: any,
  ) {
    const userId = req.user?.id || ''
    const {versionId} = params
    const registrationData = {
      userId,
      versionId,
      detail:body,
      status:"PENDING" as const
    };

    const result =await this.courseRegistrationService.Create(registrationData)
    return result
  }



  @OpenAPI({
    summary: 'Get Data for course Details page',
    description: 'Get all the Data to load in the course details page for student registration.',
  })
  // @Authorized()
  @Get('/requests')
  @HttpCode(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getAllRegistrations(@QueryParams() query:RegistrationFilterQuery){
    const {page,limit,status,search,sort} =query
    const result = await this.courseRegistrationService.getAllregistrations(page,limit,status,search,sort)
    return result
  }



   @OpenAPI({
      summary: 'Update Enrollment Progress',
      description: 'Recomputes and updates progress for all enrollments across all courses or a specific course if courseId is provided.',
    })
    // @Authorized()
    @Patch('/status/:registrationId', { transformResponse: true })
    @ResponseSchema(BadRequestError, {
      description: 'Bad Request Error',
      statusCode: 400,
    })
    async updateStatus(
      @Params() params:RegistrationParams,
      @Body () body:UpdateStatusBody
    ) {
        const {registrationId} = params
        const {status} = body
        const result = await this.courseRegistrationService.updateStatus(registrationId,status);
        console.log("result from controller ",result)
        return {message:"Registration status updated successfully", registration: result}
    }
  
}







export {CourseRegistrationController}