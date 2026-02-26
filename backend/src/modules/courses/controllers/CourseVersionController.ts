import { CourseVersionService } from '#courses/services/CourseVersionService.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Body,
  Get,
  Put,
  Delete,
  BadRequestError,
  InternalServerError,
  ForbiddenError,
  Authorized,
  Patch,
  UseInterceptor,
  Req,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { COURSES_TYPES } from '#courses/types.js';
import { BadRequestErrorResponse } from '#shared/middleware/errorHandler.js';
import { CourseVersion } from '#courses/classes/transformers/CourseVersion.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import {
  CreateCourseVersionResponse,
  CourseVersionNotFoundErrorResponse,
  CreateCourseVersionParams,
  CreateCourseVersionBody,
  CourseVersionDataResponse,
  ReadCourseVersionParams,
  DeleteCourseVersionParams,
  UpdateCourseVersionParams,
  UpdateCourseVersionBody,
  CopyCourseVersionResponse,
  CopyCourseVersionParams,
  CourseVersionWatchTimeResponse,
  GetCourseVersionWatchTimeParams,
  UpdateCourseVersionStatusBody,
  UpdateCourseVersionStatusParams,
} from '#courses/classes/validators/CourseVersionValidators.js';
import {
  CourseVersionActions,
  getCourseVersionAbility,
} from '../abilities/versionAbilities.js';
import {subject} from '@casl/ability';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {response} from 'express';
import {CourseActions} from '../abilities/courseAbilities.js';
import { AuditTrailsHandler } from '#root/shared/middleware/auditTrails.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';

@OpenAPI({
  tags: ['Course Versions'],
})
@injectable()
@JsonController('/courses')
export class CourseVersionController {
  constructor(
    @inject(COURSES_TYPES.CourseVersionService)
    private readonly courseVersionService: CourseVersionService,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) { }

  @OpenAPI({
    summary: 'Create a course version',
    description: `Creates a new version of a given course.<br/>
Accessible to:
- Instructor or manager of the course.`,
  })
  @Authorized()
  @Post('/:courseId/versions', {transformResponse: true})
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(201)
  @ResponseSchema(CreateCourseVersionResponse, {
    description: 'Course version created successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseVersionNotFoundErrorResponse, {
    description: 'Course not found',
    statusCode: 404,
  })
  async create(
    @Params() params: CreateCourseVersionParams,
    @Body() body: CreateCourseVersionBody,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request
  ): Promise<CourseVersion> {
    const { courseId } = params;
    const userId = user._id.toString();

    // Check permissions upfront
    const courseVersionSubject = subject('CourseVersion', { courseId });
    if (!ability.can(CourseVersionActions.Create, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to create course versions',
      );
    }

    // Create course version
    const createdCourseVersion =
      await this.courseVersionService.createCourseVersion(courseId, body);
    if (!createdCourseVersion) {
      return null; // or throw error if creation must succeed
    }

    // Enroll user as instructor
    await this.enrollmentService.enrollUser(
      userId,
      courseId,
      String(createdCourseVersion._id), // only convert here
      'INSTRUCTOR',
    );

    setAuditTrail(req, {
      category: AuditCategory.COURSE_VERSION,
      action: AuditAction.COURSE_VERSION_CREATE,
      actor: ObjectId.createFromHexString(userId),
      context:{
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(createdCourseVersion._id.toString()),
      },
      changes:{
        after: {
          version: createdCourseVersion.version,
          description: createdCourseVersion.description,
          totalItems: createdCourseVersion.totalItems,
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS,
      }
    })

    return createdCourseVersion;
  }

  @OpenAPI({
    summary: 'Get course version details',
    description: `Retrieves information about a specific version of a course.<br/>
Accessible to:
- Users who are part of the course version (students, teaching assistants, instructors, or managers).`,
  })
  @Authorized()
  @Get('/versions/:versionId')
  @ResponseSchema(CourseVersionDataResponse, {
    description: 'Course version retrieved successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseVersionNotFoundErrorResponse, {
    description: 'Course version not found',
    statusCode: 404,
  })
  async read(
    @Params() params: ReadCourseVersionParams,
    @Ability(getCourseVersionAbility) { ability, user },
  ): Promise<CourseVersion> {
    const { versionId } = params;

    // Build the subject context first
    const courseVersionSubject = subject('CourseVersion', { versionId });

    if (!ability.can(CourseVersionActions.View, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view this course version',
      );
    }

    const retrievedCourseVersion =
      await this.courseVersionService.readCourseVersion(versionId, user._id);
    return retrievedCourseVersion;
  }

  @OpenAPI({
    summary: 'Update a course version',
    description: `Updates course version metadata such as version label or description.<br/>
Accessible to:
- Instructor or manager for the course.`,
  })
  @Authorized()
  @Patch('/:courseId/versions/:versionId', {transformResponse: true})
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(CourseVersionDataResponse, {
    description: 'Course version updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseVersionNotFoundErrorResponse, {
    description: 'Course version not found',
    statusCode: 404,
  })
  async update(
    @Params() params: UpdateCourseVersionParams,
    @Body() body: UpdateCourseVersionBody,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request
  ): Promise<CourseVersion> {
    const { courseId, versionId } = params;

    const courseVersionSubject = subject('CourseVersion', {
      courseId,
      versionId,
    });

    if (!ability.can(CourseVersionActions.Modify, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to update this course version',
      );
    }

    const existingVersion = await this.courseVersionService.readCourseVersion(versionId, user._id);
    const updatedCourseVersion =
      await this.courseVersionService.updateCourseVersion(versionId, body);

      setAuditTrail(req,{
      category: AuditCategory.COURSE_VERSION,
      action: AuditAction.COURSE_VERSION_UPDATE,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context:{
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
      },
      changes:{
        before: {
          version: existingVersion.version,
          description: existingVersion.description,
          totalItems: existingVersion.totalItems,
        },
        after: {
          version: updatedCourseVersion.version,
          description: updatedCourseVersion.description,
          totalItems: updatedCourseVersion.totalItems,
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS, 
      }
  })
    return updatedCourseVersion;
  }

  @OpenAPI({
    summary: 'Delete a course version',
    description: `Deletes a specific version of a course.<br/>
Accessible to:
- Manager of the course.`,
  })
  @Authorized()
  @Delete('/:courseId/versions/:versionId')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(DeleteCourseVersionParams, {
    description: 'Course version deleted successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseVersionNotFoundErrorResponse, {
    description: 'Course or version not found',
    statusCode: 404,
  })
  async delete(
    @Params() params: DeleteCourseVersionParams,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request
  ): Promise<{message: string}> {
    const {courseId, versionId} = params;
    if (!versionId || !courseId) {
      throw new BadRequestError('Version ID is required');
    }

    // Build the subject context first
    const courseVersionSubject = subject('CourseVersion', {
      courseId,
      versionId,
    });

    if (!ability.can(CourseVersionActions.Delete, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to delete this course version',
      );
    }

    if (versionId == '692f030a945e82ec875e9117') {
      throw new BadRequestError(`You can't delete this version!`);
    }

    const courseVersionToDelete = await this.courseVersionService.readCourseVersion(versionId, user._id);

    const deletedVersion = await this.courseVersionService.deleteCourseVersion(
      courseId,
      versionId,
    );
    if (!deletedVersion) {
      throw new InternalServerError(
        'Failed to Delete Version, Please try again later',
      );
    }

    setAuditTrail(req, {
      category: AuditCategory.COURSE_VERSION,
      action: AuditAction.COURSE_VERSION_DELETE,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context:{
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
      },
      changes:{
        before: {
          version: courseVersionToDelete.version,
          description: courseVersionToDelete.description,
          totalItems: courseVersionToDelete.totalItems,
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS, 
      }
    })
    return {
      message: `Version with the ID ${versionId} has been deleted successfully.`,
    };
  }

  @OpenAPI({
    summary: 'Copy a course version',
    description: `Creates a duplicate of a specific version of a course.<br/>
Accessible to:
- Manager of the course.`,
  })
  @Authorized()
  @Post('/:courseId/version/:versionId/copy')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(CopyCourseVersionResponse, {
    description: 'Course version copied successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseVersionNotFoundErrorResponse, {
    description: 'Course or version not found',
    statusCode: 404,
  })
  async copy(
    @Params() params: CopyCourseVersionParams,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request
  ): Promise<{message: string}> {
    const {courseId, versionId} = params;

    if (!versionId || !courseId) {
      throw new BadRequestError('Version ID is required');
    }

    // const courseVersionSubject = subject('CourseVersion', {
    //   courseId,
    //   versionId,
    // });

    if (!ability.can(CourseVersionActions.Create, 'CourseVersion')) {
      throw new ForbiddenError(
        'You do not have permission to copy this course version',
      );
    }

    const newVersion = await this.courseVersionService.copyCourseVersion(
      courseId,
      versionId,
    );

    if (!newVersion) {
      throw new InternalServerError(
        'Failed to copy version, please try again later',
      );
    }

    setAuditTrail(req, {
      category: AuditCategory.COURSE_VERSION,
      action: AuditAction.COURSE_VERSION_CLONE,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context:{
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
      },
      outcome:{
        status: OutComeStatus.SUCCESS, 
      }
    });

    return {
      message: `Version copied successfully.`,
    };
  }




  @OpenAPI({
    summary: 'Get course version watch time',
    description: `Returns total watch time for a specific course version`,
  })
  @Get('/:courseId/versions/:versionId/watch-time')
  @ResponseSchema(CourseVersionWatchTimeResponse, {
    description: 'Course version watch time fetched successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseVersionNotFoundErrorResponse, {
    description: 'Course or version not found',
    statusCode: 404,
  })
  async getCourseVersionWatchTime(
    @Params() params: GetCourseVersionWatchTimeParams,
  ): Promise<CourseVersionWatchTimeResponse> {
    const { courseId, versionId } = params;

    if (!courseId || !versionId) {
      throw new BadRequestError('Course ID and Version ID are required');
    }
    const result = await this.courseVersionService.getCourseVersionTotalWatchTime(
      courseId,
      versionId,
    );

    if (!result) {
      throw new InternalServerError(
        'Failed to fetch watch time, please try again later',
      );
    }

    const formatWatchTime = (totalSeconds: number): string => {
      if (!totalSeconds || totalSeconds <= 0) return '0 minutes';

      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);

      const parts: string[] = [];

      if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
      if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
      if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);

      return parts.join(' ');
    }

    const totalSeconds = result.totalSeconds ?? 0;
    const totalHours = totalSeconds / 3600;
    const readableDuration = formatWatchTime(totalSeconds);

    return {
      message: result.message || 'Course version watch time fetched successfully',
      totalSeconds,
      totalHours,
      totalHoursRounded: Number(totalHours.toFixed(2)),
      readableDuration,
    };
  }
  
  @OpenAPI({
    summary: 'Update a course status',
    description: `Updates course status to archive and unarchive.<br/>
  Accessible to:
  - Instructor or manager for the course.`,
  })
  @Authorized()
  @Patch('/versions/:versionId/archive', {transformResponse: true})
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseVersionNotFoundErrorResponse, {
    description: 'Course version not found',
    statusCode: 404,
  })
  async updateStatus(
  @Params() params: UpdateCourseVersionStatusParams,
  @Body() body: UpdateCourseVersionStatusBody,
  @Ability(getCourseVersionAbility) { ability },
  ) {
    const { versionId } = params;

    const courseVersionSubject = subject('CourseVersion', { versionId });

    if (!ability.can(CourseVersionActions.Archive, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to archive or Unarchive this course version',
      );
    }

    return await this.courseVersionService.updateCourseVersionStatus(
      versionId,
      body.versionStatus,
    );
  }
}
