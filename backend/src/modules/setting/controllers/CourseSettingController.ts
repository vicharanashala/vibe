import {
  JsonController,
  Post,
  HttpCode,
  Body,
  Authorized,
  Get,
  Params,
  Put,
  CurrentUser,
  UseInterceptor,
  Req,
} from 'routing-controllers';
import {inject, injectable} from 'inversify';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {SETTING_TYPES} from '../types.js';
import {CourseSettingService} from '../services/CourseSettingService.js';
import {
  AddCourseProctoringBody,
  AddCourseProctoringParams,
  CourseSetting,
  CreateCourseSettingBody,
  ReadCourseSettingParams,
  SettingNotFoundErrorResponse,
  UpdateCourseSettingResponse,
  UpdateFollowUpInviteBody,
} from '../classes/index.js';
import {BadRequestErrorResponse, IUser} from '#root/shared/index.js';
import {AuditTrailsHandler} from '#root/shared/middleware/auditTrails.js';
import {setAuditTrail} from '#root/utils/setAuditTrail.js';
import {
  AuditAction,
  AuditCategory,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import {ObjectId} from 'mongodb';
import {getContainer} from '#root/bootstrap/loadModules.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import type {ProgressService} from '#root/modules/users/services/ProgressService.js';

@OpenAPI({
  tags: ['Course Setting'],
})
@JsonController('/setting/course-setting')
@injectable()
export class CourseSettingController {
  constructor(
    @inject(SETTING_TYPES.CourseSettingService)
    private readonly courseSettingService: CourseSettingService,
  ) {}

  @Authorized()
  @Post('/')
  @HttpCode(201)
  @ResponseSchema(CourseSetting, {
    description: 'Course settings created successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(@Body() body: CreateCourseSettingBody): Promise<CourseSetting> {
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
    description: 'Course settings fetched successfully',
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
    const {courseId, versionId} = params;

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
    description: 'Course settings Updated successfully',
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
    @Req() req: Request,
  ): Promise<{success: boolean}> {
    // This method updates proctoring settings for a course version.
    const {courseId, versionId} = params;
    const {
      detectors,
      linearProgressionEnabled,
      seekForwardEnabled,
      isPublic,
      hpSystem,
      baseHp,
      randomizeItems,
      crowdsourcedQuestionSubmissionEnabled,
    } = body;
    const userId = user._id.toString();

    const result = await this.courseSettingService.updateCourseSettings(
      courseId,
      versionId,
      detectors,
      linearProgressionEnabled,
      seekForwardEnabled,
      hpSystem,
      isPublic ?? false,
      baseHp,
      randomizeItems,
      userId,
      crowdsourcedQuestionSubmissionEnabled ?? false,
    );

    setAuditTrail(req, {
      category: AuditCategory.COURSE_SETTINGS,
      action: AuditAction.COURSE_SETTINGS_UPDATE,
      actor: {
        id: new ObjectId(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(versionId),
      },
      changes: {
        after: {
          dectors: detectors,
          linearProgressionEnabled: linearProgressionEnabled,
          seekForwardEnabled: seekForwardEnabled,
          crowdsourcedQuestionSubmissionEnabled:
            crowdsourcedQuestionSubmissionEnabled ?? false,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return {success: result};
  }

  @Authorized()
  @Put('/:courseId/:versionId/follow-up-invite')
  @HttpCode(200)
  @ResponseSchema(UpdateCourseSettingResponse, {
    description: 'Follow-up invite settings updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(SettingNotFoundErrorResponse, {
    description: 'Setting Not Found Error',
    statusCode: 404,
  })
  async updateFollowUpInvite(
    @Params() params: ReadCourseSettingParams,
    @Body() body: UpdateFollowUpInviteBody,
  ): Promise<{success: boolean}> {
    // Configures which follow-up course a student is invited to when they
    // complete this (source) course version.
    const {courseId, versionId} = params;

    const result = await this.courseSettingService.updateFollowUpInvite(
      courseId,
      versionId,
      {
        enabled: body.enabled,
        courseId: body.courseId,
        courseVersionId: body.courseVersionId,
        cohortId: body.cohortId,
        role: body.role,
      },
    );

    return {success: result};
  }

  @Authorized()
  @Post('/:courseId/:versionId/follow-up-invite/backfill')
  @HttpCode(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async backfillFollowUpInvites(
    @Params() params: ReadCourseSettingParams,
  ): Promise<{
    completed: number;
    alreadyEnrolled: number;
    missingEmail: number;
    invited: number;
  }> {
    // Re-sends the configured follow-up invite to every student who already
    // completed this (source) course version but isn't yet enrolled in the
    // target course — e.g. students who finished before the invite was set up.
    const {courseId, versionId} = params;

    const progressService = getContainer().get<ProgressService>(
      USERS_TYPES.ProgressService,
    );

    return progressService.backfillFollowUpInvites(courseId, versionId);
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
