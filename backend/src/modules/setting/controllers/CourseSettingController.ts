import { JsonController, Post, HttpCode, Body, Authorized, Get, Params, Put, CurrentUser, UseInterceptor, Req } from 'routing-controllers';
import { inject, injectable } from 'inversify';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { SETTING_TYPES } from '../types.js';
import { CourseSettingService } from '../services/CourseSettingService.js';
import { AddCourseProctoringBody, AddCourseProctoringParams, CourseSetting, CreateCourseSettingBody, ReadCourseSettingParams, SettingNotFoundErrorResponse, UpdateCourseSettingResponse } from '../classes/index.js';
import { BadRequestErrorResponse, IUser } from '#root/shared/index.js';
import { AuditTrailsHandler } from '#root/shared/middleware/auditTrails.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';

@OpenAPI({
  tags: ['Course Setting'],
})
@JsonController('/setting/course-setting')
@injectable()
export class CourseSettingController {
  constructor(
    @inject(SETTING_TYPES.CourseSettingService)
    private readonly courseSettingService: CourseSettingService,
  ) { }

  @Authorized()
  @Post('/')
  @HttpCode(201)
  @ResponseSchema(CourseSetting, {
    description: 'Course settings created successfully'
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(
    @Body() body: CreateCourseSettingBody,
  ): Promise<CourseSetting> {
    // This method creates course settings for a course.
    // It expects the body to contain the courseId and versionId.
    const courseSettings = new CourseSetting(body);
    const createdSettings =
      await this.courseSettingService.createCourseSettings(courseSettings);

    // Error handling yet to be implemented
    return createdSettings;
  }

  @Authorized()
  @Get('/:courseId/:versionId')
  @HttpCode(200)
  @ResponseSchema(CourseSetting, {
    description: 'Course settings fetched successfully'
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(SettingNotFoundErrorResponse, {
    description: 'Setting Not Found Error',
    statusCode: 404,
  })
  async get(
    @Params() params: ReadCourseSettingParams,
  ): Promise<CourseSetting | null> {
    // This method retrives course settings for a specific course and version.
    const { courseId, versionId } = params;

    const courseSettings = await this.courseSettingService.readCourseSettings(
      courseId,
      versionId,
    );

    // Error handling yet to be implemented

    return courseSettings;
  }

  @Authorized()
  @Put('/:courseId/:versionId/proctoring')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(UpdateCourseSettingResponse, {
    description: 'Course settings Updated successfully'
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(SettingNotFoundErrorResponse, {
    description: 'Setting Not Found Error',
    statusCode: 404,
  })
  async updateCourseSettings(
    @Params() params: AddCourseProctoringParams,
    @Body() body: AddCourseProctoringBody,
    @CurrentUser() user: IUser,
    @Req() req: Request
  ): Promise<{ success: boolean }> {
    // This method updates proctoring settings for a course version.
    const { courseId, versionId } = params;
    const { detectors, linearProgressionEnabled, seekForwardEnabled, isPublic } = body;
    const userId = user._id.toString();
    
    const result = await this.courseSettingService.updateCourseSettings(
      courseId,
      versionId,
      detectors,
      linearProgressionEnabled,
      seekForwardEnabled,
      isPublic ?? false,
      userId
    );

    setAuditTrail(req, {
      category: AuditCategory.COURSE_SETTINGS,
      action: AuditAction.COURSE_SETTINGS_UPDATE,
      actor: new ObjectId(userId),
      context:{
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(versionId),
      },
      changes:{
        after:{
          dectors: detectors,
          linearProgressionEnabled: linearProgressionEnabled,
          seekForwardEnabled: seekForwardEnabled
        }
      }, 
      outcome:{
        status: OutComeStatus.SUCCESS,
      }
    })

    return { success: result };
  }

  // This method removes proctoring settings for a course version.
  // This endpoint is not currently used in the implementation, but it is kept for future use.
  /*
  @Authorized()
  @Delete('/:courseId/:versionId/proctoring')
  @HttpCode(200)
  async removeCourseProctoring(
    @Params() params: RemoveCourseProctoringParams,
    @Body() body: RemoveCourseProctoringBody,
  ): Promise<{success: boolean}> {
    const {courseId, versionId} = params;
    const {detectorName} = body;

    const result = await this.courseSettingsService.removeCourseProctoring(
      courseId,
      versionId,
      detectorName,
    );

    return {success: result};
  }
    */
}
