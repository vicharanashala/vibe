import { JsonController, Post, HttpCode, Body, Authorized, Get, Params, Put } from 'routing-controllers';
import { inject, injectable } from 'inversify';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { SETTING_TYPES } from '../types.js';
import { CourseSettingService } from '../services/CourseSettingService.js';
import { AddUserProctoringBody, AddUserProctoringParams, CreateUserSettingBody, ReadUserSettingParams, SettingNotFoundErrorResponse, UpdateCourseSettingResponse, UserSetting } from '../classes/index.js';
import { UserSettingService } from '../services/UserSettingService.js';
import { BadRequestErrorResponse } from '#root/shared/index.js';

@OpenAPI({
  tags: ['Course Setting'],
})
@JsonController('/setting/course-setting')
@injectable()
export class UserSettingController {
  constructor(
    @inject(SETTING_TYPES.UserSettingService)
    private readonly userSettingService: UserSettingService,
  ) { }

  @Authorized()
  @Post('/')
  @HttpCode(201)
  @ResponseSchema(UserSetting, {
    description: 'User settings created successfully'
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(@Body() body: CreateUserSettingBody): Promise<UserSetting> {
    // This method creates user settings for a specific student in a course.
    const userSettings = new UserSetting(body);
    const createdSettings =
      await this.userSettingService.createUserSettings(userSettings);

    return createdSettings;
  }

  @Authorized()
  @Get('/:studentId/:courseId/:versionId')
  @HttpCode(200)
  @ResponseSchema(UserSetting, {
    description: 'User settings fetched successfully'
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
    @Params() params: ReadUserSettingParams,
  ): Promise<UserSetting | null> {
    // This method retrieves user settings for a specific student in a course version.
    const { studentId, courseId, versionId } = params;

    const userSettings = await this.userSettingService.readUserSettings(
      studentId,
      courseId,
      versionId,
    );

    return userSettings;
  }

  @Authorized()
  @Put('/:studentId/:courseId/:versionId/proctoring')
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
  async updateUserSettings(
    @Params() params: AddUserProctoringParams,
    @Body() body: AddUserProctoringBody,
  ): Promise<{ success: boolean }> {
    // This method updates user proctoring settings for a specific student in a course version.
    const { studentId, courseId, versionId } = params;
    const { detectors } = body;

    const result = await this.userSettingService.updateUserSettings(
      studentId,
      courseId,
      versionId,
      detectors,
    );

    return { success: result };
  }

  // Commented out deletion endpoint for user proctoring settings
  // This endpoint is not currently used in the implementation, but it is kept for future use.
  /*
  @Authorized(['admin', 'instructor'])
  @Delete('/:studentId/:courseId/:courseVersionId/proctoring')
  @HttpCode(200)
  async removeUserProctoring(
    @Params() params: RemoveUserProctoringParams,
    @Body() body: RemoveUserProctoringBody,
  ): Promise<{success: boolean}> {
    const {studentId, courseId, courseVersionId} = params;
    const {detectorName} = body;

    const result = await this.userSettingsService.removeUserProctoring(
      studentId,
      courseId,
      courseVersionId,
      detectorName,
    );

    return {success: result};
  }
    */
}
