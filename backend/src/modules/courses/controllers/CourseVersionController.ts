import 'reflect-metadata';
import {
  Authorized,
  Body,
  Get,
  HttpError,
  JsonController,
  Params,
  Post,
  Delete,
  BadRequestError,
  HttpCode,
  NotFoundError,
  InternalServerError,
} from 'routing-controllers';
import {Inject, Service} from 'typedi';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {CourseVersionService} from '../services';
import {
  CreateCourseVersionParams,
  CreateCourseVersionBody,
  ReadCourseVersionParams,
  DeleteCourseVersionParams,
  CourseVersionDataResponse,
  CourseVersionNotFoundErrorResponse,
  CreateCourseVersionResponse,
} from '../classes/validators/CourseVersionValidators';
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';
import {CourseVersion} from '../classes/transformers';

@OpenAPI({
  tags: ['Course Versions'],
})
@JsonController('/courses')
@Service()
export class CourseVersionController {
  constructor(
    @Inject('CourseVersionService')
    private readonly courseVersionService: CourseVersionService,
  ) {}

  @Authorized(['admin', 'instructor'])
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
  @OpenAPI({
    summary: 'Create Course Version',
    description: 'Creates a new version for a specific course.',
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

  @Authorized(['admin', 'instructor', 'student'])
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
  @OpenAPI({
    summary: 'Get Course Version',
    description: 'Retrieves a course version by its ID.',
  })
  async read(
    @Params() params: ReadCourseVersionParams,
  ): Promise<CourseVersion> {
    const {id} = params;
    const retrievedCourseVersion =
      await this.courseVersionService.readCourseVersion(id);
    const retrievedCourseVersionExample = retrievedCourseVersion;
    return retrievedCourseVersion;
  }

  @Authorized(['admin', 'instructor'])
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
  @OpenAPI({
    summary: 'Delete Course Version',
    description: 'Deletes a course version by its ID.',
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
