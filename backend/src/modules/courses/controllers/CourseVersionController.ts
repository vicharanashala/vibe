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
  QueryParams,
  Param,
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
  ReadCourseVersionCohortsParams,
  CohortsQuery,
  CohortsResponse,
  NewCohortBody,
  CohortCreatedMessage,
  CohortUpdatedMessage,
  CohortDeletedMessage,
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
import { ICourseVersion } from '#root/shared/index.js';

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
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
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
  ): Promise<CourseVersion & {hpSystem: boolean}> {
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
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
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
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
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
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
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
  @UseInterceptor(AuditTrailsHandler)
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
  @Ability(getCourseVersionAbility) { ability, user },
  @Req() req: Request,
  ) : Promise<ICourseVersion> {
    const { versionId } = params;

    const courseVersionSubject = subject('CourseVersion', { versionId });

    if (!ability.can(CourseVersionActions.Archive, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to archive or Unarchive this course version',
      );
    }

    const existingVersion = await this.courseVersionService.readCourseVersion(versionId, user._id);
    const updatedVersion = await this.courseVersionService.updateCourseVersionStatus(versionId, body.versionStatus);
    setAuditTrail(req, {
      category: AuditCategory.COURSE_VERSION,
      action: AuditAction.COURSE_VERSION_STATUS_UPDATE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        courseId: ObjectId.createFromHexString(
          existingVersion.courseId.toString(),
        ),
      },
      changes: {
        before: {
          versionStatus: existingVersion.versionStatus,
        },
        after: {
          versionStatus: updatedVersion.versionStatus,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });
    return updatedVersion;
  }

  @OpenAPI({
    summary: 'Get all cohorts for a course version',
    description:
      'Retrieves a paginated list of all cohorts in a specific course version.',
  })
  @Authorized()
  @Get('/:courseId/versions/:versionId/cohorts')
  @HttpCode(200)
  @ResponseSchema(CohortsResponse, {
    description: 'Paginated list of cohorts for the course version',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async getCourseVersionCohorts(
    @Params() params: ReadCourseVersionCohortsParams,
    @QueryParams() query: CohortsQuery,
    @Ability(getCourseVersionAbility) {ability, user},
  ): Promise<CohortsResponse> {
    const { courseId, versionId } = params;

    const courseVersionSubject = subject('CourseVersion', {
      courseId,
      versionId,
    });

    if (!ability.can(CourseVersionActions.View, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to update this course version',
      );
    }

    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      // filter,
    } = query;
    if (page < 1 || limit < 1) {
      throw new BadRequestError('Page and limit must be positive integers.');
    }

    const skip = (page - 1) * limit;
    return await this.courseVersionService.getCohortsByVersion(
      versionId,
      skip,
      limit,
      search,
      sortBy,
      sortOrder
    );
  }


  @OpenAPI({
    summary: 'Add a cohort in a course version',
    description:
      'Add a new cohort in a specific course version.',
  })
  @Authorized()
  @Post('/:courseId/versions/:versionId/cohorts')
  @HttpCode(200)
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(CohortCreatedMessage, {
    description: 'Cohort created successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async AddCohortInCourseVersion(
    @Params() params: ReadCourseVersionCohortsParams,
    @Body() body: NewCohortBody,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request,
  ): Promise<CohortCreatedMessage> {
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

    if(!body.newCohortName){
      throw new BadRequestError("Cohort name required for creating a cohort");
    }

    // Restricting cohort creation for already existing course versions because these versions are already published and have students enrolled in them

    const restrictedVersionIds = [
      '6968e12cbf2860d6e39051af',
      '6970f87e30644cbc74b67150',
      '697b4e262942654879011c57',
      '69903415e1930c015760a719',
      '69942dc6d6d99b252e3a54ff',
    ];

    if (restrictedVersionIds.includes(versionId)) {
      throw new BadRequestError('Cohort creation is restricted for this course version');
    }

    const existingVersion = await this.courseVersionService.readCourseVersion(versionId, user._id);
    if(existingVersion.cohortDetails && existingVersion.cohortDetails?.some(cohort=> cohort.name === body.newCohortName)){
      throw new BadRequestError("The requested cohort name already exists in the course version");
    }
    const newVersionBody = {
      version : existingVersion.version,
      description: existingVersion.description,
      cohorts: Array.of(body.newCohortName.toLowerCase())
    }
    await this.courseVersionService.updateCourseVersion(versionId, newVersionBody);

    setAuditTrail(req, {
      category: AuditCategory.COHORT,
      action: AuditAction.COHORT_ADD,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context:{
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
      },
      changes:{
        after:{
          cohort: body.newCohortName,
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS, 
      }
    })
    return {
      message: `Cohort created successfully.`,
    };
  }



  @OpenAPI({
    summary: 'Update a cohort in a course version',
    description:
      'Update a cohort in a specific course version.',
  })
  @Authorized()
  @Patch('/:courseId/versions/:versionId/cohorts/:cohortId')
  @HttpCode(200)
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(CohortUpdatedMessage, {
    description: 'Cohort updated for the course version',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async UpdateCohortInCourseVersion(
    @Params() params: ReadCourseVersionCohortsParams,
    @Body() body: NewCohortBody,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request,
  ): Promise<CohortUpdatedMessage> {
    const { courseId, versionId, cohortId } = params;

    if(!cohortId){
      throw new BadRequestError("cohortId required for updating a cohort")
    }

    const courseVersionSubject = subject('CourseVersion', {
      courseId,
      versionId,
    });

    if (!ability.can(CourseVersionActions.Modify, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to update this course version',
      );
    }

    if (!body.newCohortName && (body.isPublic === null || body.isPublic === undefined)) {
        throw new BadRequestError("No information provided in request body");
    }
    const existingVersion = await this.courseVersionService.readCourseVersion(versionId, user._id);

    if(!existingVersion.cohorts || existingVersion.cohorts.length <= 0){
      throw new BadRequestError("This courseversion does not have any cohorts to update");
    }
    const cohortExists = existingVersion.cohorts.some(cohort=> cohort?.toString() === cohortId);

    if(!cohortExists){
      throw new BadRequestError("The requested cohort does not exists in the course version");
    }
    if(body.newCohortName){
        if(existingVersion.cohortDetails && existingVersion.cohortDetails.some(cohort=> cohort.name === body.newCohortName)){
          throw new BadRequestError("The requested cohort name already exists in the course version");
        }
    }
    await this.courseVersionService.updateCohortInCourseVersion(cohortId, body?.newCohortName?.toLowerCase(), body?.isPublic );

    setAuditTrail(req, {
      category: AuditCategory.COHORT,
      action: AuditAction.COHORT_UPDATE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context:{
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
        cohortId: ObjectId.createFromHexString(cohortId),
      },
      changes:{
        after:{
          cohort: body.newCohortName,
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS, 
      }
    })

    return {
      message: `Cohort updated successfully.`,
    };
  }


  @OpenAPI({
    summary: 'Delete a cohort in a course version',
    description:
      'Delete a cohort in a specific course version.',
  })
  @Authorized()
  @Delete('/:courseId/versions/:versionId/cohorts/:cohortId')
  @HttpCode(200)
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(CohortDeletedMessage, {
    description: 'Cohort deleted for the course version',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async DeleteCohortInCourseVersion(
    @Params() params: ReadCourseVersionCohortsParams,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request,
  ): Promise<CohortDeletedMessage> {
    const { courseId, versionId, cohortId } = params;

    if(!cohortId){
      throw new BadRequestError("cohortId required for updating a cohort")
    }

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

    if(!existingVersion.cohorts || existingVersion.cohorts.length <= 0){
      throw new BadRequestError("This courseversion does not have any cohorts to delete");
    }
    const cohortExists = existingVersion.cohorts.some(cohort=> cohort?.toString() === cohortId);

    if(!cohortExists){
      throw new BadRequestError("The requested cohort does not exists in the course version");
    }
    
    await this.courseVersionService.deleteCohortInCourseVersion(versionId, cohortId);

    setAuditTrail(req, {
      category: AuditCategory.COHORT,
      action: AuditAction.COHORT_DELETE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context:{
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
        cohortId: ObjectId.createFromHexString(cohortId),
      },
      changes:{
        before:{
          cohort: existingVersion.cohorts.find(cohort=> cohort?.toString() === cohortId),
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS, 
      }
    })
    return {
      message: `Cohort deleted successfully.`,
    };
  }
}