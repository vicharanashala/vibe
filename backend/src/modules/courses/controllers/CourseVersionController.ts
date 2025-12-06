import {CourseVersionService} from '#courses/services/CourseVersionService.js';
import {injectable, inject} from 'inversify';
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
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {COURSES_TYPES} from '#courses/types.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {CourseVersion} from '#courses/classes/transformers/CourseVersion.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
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
  ) {}

  @OpenAPI({
    summary: 'Create a course version',
    description: `Creates a new version of a given course.<br/>
Accessible to:
- Instructor or manager of the course.`,
  })
  @Authorized()
  @Post('/:courseId/versions', {transformResponse: true})
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
  ): Promise<CourseVersion> {
    const {courseId} = params;
    const userId = user._id.toString();

    // Check permissions upfront
    const courseVersionSubject = subject('CourseVersion', {courseId});
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
    @Ability(getCourseVersionAbility) {ability, user},
  ): Promise<CourseVersion> {
    const {versionId} = params;

    // Build the subject context first
    const courseVersionSubject = subject('CourseVersion', {versionId});

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
    @Ability(getCourseVersionAbility) {ability},
  ): Promise<CourseVersion> {
    const {courseId, versionId} = params;

    const courseVersionSubject = subject('CourseVersion', {
      courseId,
      versionId,
    });

    if (!ability.can(CourseVersionActions.Modify, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to update this course version',
      );
    }

    const updatedCourseVersion =
      await this.courseVersionService.updateCourseVersion(versionId, body);
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
    @Ability(getCourseVersionAbility) {ability},
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

    const deletedVersion = await this.courseVersionService.deleteCourseVersion(
      courseId,
      versionId,
    );
    if (!deletedVersion) {
      throw new InternalServerError(
        'Failed to Delete Version, Please try again later',
      );
    }
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
    @Ability(getCourseVersionAbility) {ability},
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

    return {
      message: `Version copied successfully.`,
    };
  }
}
