import {inject, injectable} from 'inversify';
import {
  Authorized,
  HttpCode,
  JsonController,
  Params,
  Post,
  ForbiddenError,
  Body,
  Get,
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
  SubmissionResponse,
  SubmitProjectBody,
} from '../classes/validators/ProjectValidators.js';
import {ProjectService} from '../services/projectService.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {ProgressService} from '#root/modules/users/services/ProgressService.js';

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
    summary: 'Submit project',
    description: 'Submit a new project for the course for user',
  })
  @Authorized()
  @Post('/')
  @HttpCode(200)
  @ResponseSchema(undefined, {
    description: 'Attempt created successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request',
    statusCode: 400,
  })
  @ResponseSchema(AttemptNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  async submitProject(
    @Ability(projectAbility) {ability, user},
    @Body() body: SubmitProjectBody,
  ): Promise<any> {
    const {
      projectId,
      courseId,
      versionId,
      moduleId,
      sectionId,
      watchItemId,
      submissionURL,
      comment,
    } = body;
    const userId = user._id.toString();
    const projectSubject = subject(ProjectSubject, {
      courseId,
      versionId,
      userId,
    });

    if (!ability.can(ProjectActions.Submit, projectSubject)) {
      throw new ForbiddenError(
        'You do not have permission for this project submission',
      );
    }

    const insertedId = await this._projectService.submitProject(
      projectId,
      userId,
      courseId,
      versionId,
      submissionURL,
      comment,
    );

    await this._progressService.stopItem(
      userId,
      courseId,
      versionId,
      projectId,
      sectionId,
      moduleId,
      watchItemId,
    );

    await this._progressService.updateProgress(
      userId,
      courseId,
      versionId,
      moduleId,
      sectionId,
      projectId,
      watchItemId,
    );

    return {
      message: 'Project submitted successfully',
      insertedId,
    };
  }

  @OpenAPI({
    summary: 'Get project submissions',
    description: 'Return the list of submissions for the given course version',
  })
  @Authorized()
  @Get('/course/:courseId/version/:versionId/submissions')
  @HttpCode(200)
  @ResponseSchema(SubmissionResponse, {
    description: 'Submissions fetched successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request',
    statusCode: 400,
  })
  @ResponseSchema(AttemptNotFoundErrorResponse, {
    description: 'No submissions found',
    statusCode: 404,
  })
  async getSubmissions(
    @Params() params: {courseId: string; versionId: string},
    @Ability(projectAbility) {ability, user},
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
        'You do not have permission to view project submissions',
      );
    }

    const submissions = await this._projectService.getSubmissions(
      courseId,
      versionId,
    );

    return submissions;
  }
}
