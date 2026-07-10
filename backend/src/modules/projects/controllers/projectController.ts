import {inject, injectable} from 'inversify';
import {
  Authorized,
  HttpCode,
  JsonController,
  Params,
  Param,
  Patch,
  Post,
  ForbiddenError,
  NotFoundError,
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
  GalleryParams,
  GallerySubmissionDto,
  SetFeaturedBody,
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


  @OpenAPI({
    summary: 'Set featured status of a submission',
    description:
      'Allows an instructor to mark a submission as featured or unfeatured for the gallery.',
  })
  @Authorized()
  @Patch('/submission/:submissionId/featured')
  @HttpCode(200)
  @ResponseSchema(SuccessResponse, {
    description: 'Featured status updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  @ResponseSchema(AttemptNotFoundErrorResponse, {statusCode: 404})
  async setFeatured(
    @Param('submissionId') submissionId: string,
    @Ability(projectAbility) {ability, user},
    @Body() body: SetFeaturedBody,
  ): Promise<SuccessResponse> {
    // Load submission first — do NOT trust caller-supplied courseId
    const submission = await this._projectService.getSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError('Submission not found.');
    }

    // Authorize against the submission's own courseId and courseVersionId
    const projectSubject = subject(ProjectSubject, {
      courseId: submission.courseId.toString(),
      versionId: submission.courseVersionId.toString(),
    });

    if (!ability.can(ProjectActions.FeatureSubmission, projectSubject)) {
      throw new ForbiddenError(
        'You do not have permission to curate submissions for this course.',
      );
    }

    const updated = await this._projectService.setFeatured(submissionId, body.featured);
    if (!updated) {
      throw new NotFoundError('Submission not found or could not be updated.');
    }

    return { message: `Submission ${body.featured ? 'featured' : 'unfeatured'} successfully.` };
  }

  @OpenAPI({
    summary: 'Get featured project gallery',
    description:
      'Returns the curated gallery of featured submissions for a project within a course version.',
  })
  @Authorized()
  @Get('/:projectId/course/:courseId/version/:versionId/gallery')
  @HttpCode(200)
  @ResponseSchema(GallerySubmissionDto, {
    description: 'List of featured submissions',
    statusCode: 200,
    isArray: true,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async getGallery(
    @Params() params: GalleryParams,
    @Ability(projectAbility) {ability, user},
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<GallerySubmissionDto[]> {
    const {projectId, courseId, versionId} = params;

    const projectSubject = subject(ProjectSubject, {
      courseId,
      versionId,
    });

    if (!ability.can(ProjectActions.ViewGallery, projectSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view the project gallery.',
      );
    }

    const submissions = await this._projectService.getFeaturedSubmissions(
      projectId,
      courseId,
      versionId,
      cohortId,
    );

    // Map to sanitized DTO — no email, grades, feedback, or internal fields
    return submissions.map(s => ({
      submissionId: s._id!.toString(),
      projectId: s.projectId.toString(),
      submissionURL: s.submissionURL,
      comment: s.comment,
    }));
  }
}
