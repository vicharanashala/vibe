import {injectable, inject} from 'inversify';
import {
  JsonController,
  Authorized,
  Post,
  HttpCode,
  Body,
  Get,
  Params,
  Put,
  Delete,
} from 'routing-controllers';
import {UserSettingsService} from '#settings/services/UserSettingsService.js';
import {
  UserSettings,
  CreateUserSettingsBody,
  ReadUserSettingsParams,
  AddUserProctoringParams,
  AddUserProctoringBody,
  RemoveUserProctoringParams,
  RemoveUserProctoringBody,
} from '#settings/classes/index.js';
import {SETTINGS_TYPES} from '#settings/types.js';
import { OpenAPI } from 'routing-controllers-openapi';

/**
 * This controller handles user settings operations.
 * It allows creating, reading, and updating user settings for proctoring in a course version for a specific student.
 *
 */

@OpenAPI({
  tags: ['User Settings'],
  description: 'Operations for managing user settings in courses',
})
@injectable()
@JsonController('/settings/users')
export class UserSettingsController {
  constructor(
    @inject(SETTINGS_TYPES.UserSettingsService)
    private readonly userSettingsService: UserSettingsService,
  ) {}

  @Authorized(['admin', 'instructor'])
  @Post('/')
  @HttpCode(201)
  async create(@Body() body: CreateUserSettingsBody): Promise<UserSettings> {
    // This method creates user settings for a specific student in a course.
    const userSettings = new UserSettings(body);
    const createdSettings =
      await this.userSettingsService.createUserSettings(userSettings);

    return createdSettings;
  }

  @Authorized(['admin', 'instructor', 'student'])
  @Get('/:studentId/:courseId/:courseVersionId')
  @HttpCode(200)
  async get(
    @Params() params: ReadUserSettingsParams,
  ): Promise<UserSettings | null> {
    // This method retrieves user settings for a specific student in a course version.
    const {studentId, courseId, courseVersionId} = params;

    const userSettings = await this.userSettingsService.readUserSettings(
      studentId,
      courseId,
      courseVersionId,
    );

    return userSettings;
  }

  @Authorized(['admin', 'instructor'])
  @Put('/:studentId/:courseId/:courseVersionId/proctoring')
  @HttpCode(200)
  async updateUserSettings(
    @Params() params: AddUserProctoringParams,
    @Body() body: AddUserProctoringBody,
  ): Promise<{success: boolean}> {
    // This method updates user proctoring settings for a specific student in a course version.
    const {studentId, courseId, courseVersionId} = params;
    const {detectors} = body;

    const result = await this.userSettingsService.updateUserSettings(
      studentId,
      courseId,
      courseVersionId,
      detectors,
    );

    return {success: result};
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
