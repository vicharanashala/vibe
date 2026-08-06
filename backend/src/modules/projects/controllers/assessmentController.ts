import {inject, injectable} from 'inversify';
import {
  Authorized,
  HttpCode,
  JsonController,
  Param,
  Get,
  Put,
  ForbiddenError,
  NotFoundError,
  Body,
  QueryParam,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {PROJECTS_TYPES} from '../types.js';
import {BadRequestErrorResponse} from '#root/shared/index.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {subject} from '@casl/ability';
import {
  projectAbility,
  ProjectActions,
  ProjectSubject,
} from '../abilities/projectAbilites.js';
import {
  AssessmentResponse,
  SaveAssessmentBody,
  MySubmissionResponse,
} from '../classes/validators/RubricValidators.js';
import {AssessmentService} from '../services/assessmentService.js';
import {ProjectService} from '../services/projectService.js';
import {IAssessment} from '../repositories/model.js';

function mapAssessment(a: IAssessment): AssessmentResponse {
  return {
    id: a._id!.toString(),
    submissionId: a.submissionId.toString(),
    rubricId: a.rubricId.toString(),
    assessedBy: a.assessedBy.toString(),
    criteria: a.criteria.map(c => ({
      criterionId: c.criterionId,
      points: c.points,
      feedback: c.feedback,
    })),
    totalPoints: a.totalPoints,
    maxPoints: a.maxPoints,
    percentage: a.percentage,
    overallFeedback: a.overallFeedback,
    assessedAt: a.assessedAt,
    updatedAt: a.updatedAt,
  };
}

@OpenAPI({tags: ['Project']})
@injectable()
@JsonController('/project')
export class AssessmentController {
  constructor(
    @inject(PROJECTS_TYPES.AssessmentService)
    private readonly _assessmentService: AssessmentService,

    @inject(PROJECTS_TYPES.ProjectService)
    private readonly _projectService: ProjectService,
  ) {}

  // ─── PUT /project/assessment/submission/:submissionId ─────────────────
  // Upsert — creates or updates, never duplicates.

  @OpenAPI({
    summary: 'Save (upsert) an assessment for a submission',
    description:
      'Instructor-only. Creates or updates the assessment for a submission against a rubric. ' +
      'Score (totalPoints, maxPoints, percentage) is computed server-side. ' +
      'Does NOT modify the submission\'s `featured` status.',
  })
  @Authorized()
  @Put('/assessment/submission/:submissionId')
  @HttpCode(200)
  @ResponseSchema(AssessmentResponse, {description: 'Assessment saved', statusCode: 200})
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async saveAssessment(
    @Param('submissionId') submissionId: string,
    @Ability(projectAbility) {ability, user},
    @Body() body: SaveAssessmentBody,
  ): Promise<AssessmentResponse> {
    // Mirror setFeatured pattern: load submission first — never trust caller-supplied courseId
    const submission = await this._projectService.getSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('Submission not found.');

    const projectSubject = subject(ProjectSubject, {
      courseId: submission.courseId.toString(),
      versionId: submission.courseVersionId.toString(),
    });

    if (!ability.can(ProjectActions.Assess, projectSubject)) {
      throw new ForbiddenError('You do not have permission to assess submissions for this course.');
    }

    const assessment = await this._assessmentService.saveAssessment(
      submissionId,
      body.rubricId,
      user._id.toString(),
      body.criteria,
      body.overallFeedback,
    );

    return mapAssessment(assessment);
  }

  // ─── GET /project/assessment/submission/:submissionId ─────────────────

  @OpenAPI({
    summary: 'Get assessment for a submission',
    description:
      'Instructors may view any assessment in their course/version. ' +
      'Students may only view the assessment for their own submission.',
  })
  @Authorized()
  @Get('/assessment/submission/:submissionId')
  @HttpCode(200)
  @ResponseSchema(AssessmentResponse, {description: 'Assessment detail', statusCode: 200})
  async getAssessment(
    @Param('submissionId') submissionId: string,
    @Ability(projectAbility) {ability, user},
  ): Promise<AssessmentResponse | null> {
    // Load submission to derive course/version for ability check
    const submission = await this._projectService.getSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('Submission not found.');

    const courseId = submission.courseId.toString();
    const versionId = submission.courseVersionId.toString();
    const submittingUserId = submission.userId.toString();
    const requestingUserId = user._id.toString();

    const instructorSubject = subject(ProjectSubject, {courseId, versionId});
    const isInstructor = ability.can(ProjectActions.Assess, instructorSubject);

    if (!isInstructor) {
      // Student path — must be their own submission
      if (submittingUserId !== requestingUserId) {
        throw new ForbiddenError('You can only view the assessment for your own submission.');
      }
      // Also verify CASL student ability (userBounded)
      const studentSubject = subject(ProjectSubject, {
        courseId,
        versionId,
        userId: requestingUserId,
      });
      if (!ability.can(ProjectActions.ViewAssessment, studentSubject)) {
        throw new ForbiddenError('You do not have permission to view this assessment.');
      }
    }

    const assessment = await this._assessmentService.getAssessmentBySubmissionId(submissionId);
    if (!assessment) return null;
    return mapAssessment(assessment);
  }

  // ─── GET /project/submission/my ──────────────────────────────────────
  // Bug-safe student self-lookup: uses getSubmissionByUserAndProject (not getByUser).

  @OpenAPI({
    summary: 'Get student\'s own submission for a project',
    description:
      'Returns the authenticated student\'s own submission for the given projectId, ' +
      'courseId, and versionId — with their assessment attached if one exists. ' +
      'Uses a projectId-scoped query to avoid cross-project collisions.',
  })
  @Authorized()
  @Get('/submission/my')
  @HttpCode(200)
  @ResponseSchema(MySubmissionResponse, {description: 'Student\'s own submission', statusCode: 200})
  async getMySubmission(
    @Ability(projectAbility) {ability, user},
    @QueryParam('projectId') projectId: string,
    @QueryParam('courseId') courseId: string,
    @QueryParam('versionId') versionId: string,
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<MySubmissionResponse | null> {
    const userId = user._id.toString();

    // Verify the caller has ViewAssessment on this course/version (student or instructor)
    const studentSubject = subject(ProjectSubject, {courseId, versionId, userId});
    if (!ability.can(ProjectActions.ViewAssessment, studentSubject)) {
      throw new ForbiddenError('You do not have permission to view your submission here.');
    }

    // Bug-safe lookup — includes projectId in the filter
    const submission = await this._projectService.getSubmissionByUserAndProject(
      userId,
      projectId,
      courseId,
      versionId,
      cohortId,
    );
    if (!submission) return null;

    const submissionId = submission._id!.toString();
    const assessment = await this._assessmentService.getAssessmentBySubmissionId(submissionId);

    return {
      submissionId,
      submissionURL: submission.submissionURL,
      comment: submission.comment,
      assessment: assessment ? mapAssessment(assessment) : undefined,
    };
  }
}
