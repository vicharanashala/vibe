import {inject, injectable} from 'inversify';
import {
  Authorized,
  HttpCode,
  JsonController,
  Params,
  Post,
  Patch,
  ForbiddenError,
  Body,
  Get,
  QueryParam,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {PROJECTS_TYPES} from '../types.js';
import {BadRequestErrorResponse} from '#root/shared/index.js';
import {AttemptNotFoundErrorResponse} from '#root/modules/quizzes/classes/index.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {subject} from '@casl/ability';
import {
  projectAbility,
  ProjectActions,
  ProjectSubject,
} from '../abilities/projectAbilites.js';
import {
  CourseVersionParams,
  MySubmissionResponse,
  ReviewProjectBody,
  SubmissionIdParams,
  SubmissionResponse,
  SubmitProjectBody,
  SuccessResponse,
} from '../classes/validators/ProjectValidators.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {ProgressService} from '#root/modules/users/services/ProgressService.js';
import {ProjectService} from '../services/projectService.js';

@OpenAPI({
  tags: ['Project'],
})
@injectable()
@JsonController('/project')
export class ProjectController {
  constructor(
    @inject(PROJECTS_TYPES.ProjectService)
    private readonly _projectService: ProjectService,

    @inject(USERS_TYPES.ProgressService)
    private readonly _progressService: ProgressService,
  ) {}

  @OpenAPI({
    summary: 'Submit a project',
    description:
      'Allows a student to submit a project for a specific course version.',
  })
  @Authorized()
  @Post('/')
  @HttpCode(200)
  @ResponseSchema(SuccessResponse, {
    description: 'Project submitted successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  @ResponseSchema(AttemptNotFoundErrorResponse, {statusCode: 404})
  async submitProject(
    @Ability(projectAbility) {ability, user},
    @Body() body: SubmitProjectBody,
  ): Promise<SuccessResponse> {
    const {
      projectId,
      courseId,
      versionId,
      moduleId,
      sectionId,
      watchItemId,
      submissionURL,
      comment,
      cohortId,
    } = body;

    const userId = user._id.toString();
    const projectSubject = subject(ProjectSubject, {
      courseId,
      versionId,
      userId,
    });

    if (!ability.can(ProjectActions.Submit, projectSubject)) {
      throw new ForbiddenError(
        'You do not have permission to submit this project.',
      );
    }

    await this._projectService.submitProject(
      projectId,
      userId,
      courseId,
      versionId,
      submissionURL,
      comment,
      cohortId,
    );

    // await this._progressService.stopItem(
    //   userId,
    //   courseId,
    //   versionId,
    //   projectId,
    //   sectionId,
    //   moduleId,
    //   watchItemId,
    // );

    // await this._progressService.updateProgress(
    //   userId,
    //   courseId,
    //   versionId,
    //   moduleId,
    //   sectionId,
    //   projectId,
    //   watchItemId,
    // );

    return {
      message: 'Project submitted successfully',
    };
  }

  @OpenAPI({
    summary: "Get my project submission",
    description: "Returns the authenticated student's own submission for a course version, if it exists.",
  })
  @Authorized()
  @Get('/my-submission')
  @HttpCode(200)
  async getMySubmission(
    @Ability(projectAbility) {user},
    @QueryParam('courseId') courseId: string,
    @QueryParam('versionId') versionId: string,
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<MySubmissionResponse | null> {
    return this._projectService.getMySubmission(user._id.toString(), courseId, versionId, cohortId);
  }

  @OpenAPI({
    summary: 'Review a project submission',
    description: 'Instructor saves feedback and grade for a submission.',
  })
  @Authorized()
  @Patch('/submissions/:submissionId/review')
  @HttpCode(200)
  @ResponseSchema(SuccessResponse, {statusCode: 200})
  async reviewSubmission(
    @Params() params: SubmissionIdParams,
    @Ability(projectAbility) {user},
    @Body() body: ReviewProjectBody,
  ): Promise<SuccessResponse> {
    const isStaff =
      user.globalRole === 'admin' ||
      user.enrollments.some((e: any) =>
        ['INSTRUCTOR', 'MANAGER', 'STAFF', 'TA'].includes(e.role),
      );
    if (!isStaff) {
      throw new ForbiddenError('You do not have permission to review submissions.');
    }
    await this._projectService.reviewSubmission(
      params.submissionId,
      user._id.toString(),
      body.feedback,
      body.grade,
    );
    return {message: 'Review saved'};
  }

  @OpenAPI({
    summary: 'Get project submissions',
    description:
      'Returns all submissions for a given course and version, including user information.',
  })
  @Authorized()
  @Get('/course/:courseId/version/:versionId/submissions')
  @HttpCode(200)
  @ResponseSchema(SubmissionResponse, {
    description: 'List of submissions fetched successfully',
    statusCode: 200,
    isArray: true,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  @ResponseSchema(AttemptNotFoundErrorResponse, {statusCode: 404})
  async getSubmissions(
    @Params() params: CourseVersionParams,
    @Ability(projectAbility) {ability, user},
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<SubmissionResponse> {
    const {courseId, versionId} = params;
    const userId = user._id.toString();
    const projectSubject = subject(ProjectSubject, {
      courseId,
      versionId,
      userId,
    });

    if (!ability.can(ProjectActions.View, projectSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view project submissions.',
      );
    }

    const submissions = await this._projectService.getSubmissions(
      courseId,
      versionId,
      cohortId,
    );
    return submissions;
  }


  
}
