import {CourseVersionService} from '#courses/services/CourseVersionService.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Authorized,
  Post,
  HttpCode,
  Params,
  Body,
  Get,
  Delete,
  BadRequestError,
  InternalServerError,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {COURSES_TYPES} from '#courses/types.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {CourseVersion} from '#courses/classes/transformers/CourseVersion.js';
import {
  CreateCourseVersionResponse,
  CourseVersionNotFoundErrorResponse,
  CreateCourseVersionParams,
  CreateCourseVersionBody,
  CourseVersionDataResponse,
  ReadCourseVersionParams,
  DeleteCourseVersionParams,
} from '#courses/classes/validators/CourseVersionValidators.js';
import { CourseVersionActions } from '../abilities/versionAbilities.js';

@OpenAPI({
  tags: ['Course Versions'],
})
@injectable()
@JsonController('/courses')
export class CourseVersionController {
  constructor(
    @inject(COURSES_TYPES.CourseVersionService)
    private readonly courseVersionService: CourseVersionService,
  ) {}

  @OpenAPI({
    summary: 'Create a course version',
    description: `Creates a new version of a given course.<br/>
Accessible to:
- Instructor or manager of the course.`,
  })
  @Authorized({action: CourseVersionActions.Create, subject: 'CourseVersion'})
  @Post('/:id/versions', {transformResponse: true})
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
  ): Promise<CourseVersion> {
    const {id} = params;
    const createdCourseVersion =
      await this.courseVersionService.createCourseVersion(id, body);
    return createdCourseVersion;
  }

  @OpenAPI({
    summary: 'Get course version details',
    description: `Retrieves information about a specific version of a course.<br/>
Accessible to:
- Users who are part of the course version (students, teaching assistants, instructors, or managers).`,
  })
  @Authorized({action: CourseVersionActions.View, subject: 'CourseVersion'})
  @Get('/versions/:id')
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
  ): Promise<CourseVersion> {
    const {id} = params;
    const retrievedCourseVersion =
      await this.courseVersionService.readCourseVersion(id);
    return retrievedCourseVersion;
  }

  @OpenAPI({
    summary: 'Delete a course version',
    description: `Deletes a specific version of a course.<br/>
Accessible to:
- Manager of the course.`,
  })
  @Authorized({action: CourseVersionActions.Delete, subject: 'CourseVersion'})
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
  ): Promise<{message: string}> {
    const {courseId, versionId} = params;
    if (!versionId || !courseId) {
      throw new BadRequestError('Version ID is required');
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
}
