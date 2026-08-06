import {inject, injectable} from 'inversify';
import {
  Authorized,
  Delete,
  HttpCode,
  JsonController,
  Params,
  Param,
  Patch,
  Post,
  Get,
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
  CourseVersionRubricParams,
  CreateRubricBody,
  RubricIdParam,
  RubricResponse,
  UpdateRubricBody,
} from '../classes/validators/RubricValidators.js';
import {SuccessResponse} from '../classes/validators/ProjectValidators.js';
import {RubricService} from '../services/rubricService.js';
import {IRubric} from '../repositories/model.js';

function mapRubric(r: IRubric, assessmentCount: number): RubricResponse {
  return {
    id: r._id!.toString(),
    courseId: r.courseId.toString(),
    courseVersionId: r.courseVersionId.toString(),
    title: r.title,
    description: r.description,
    criteria: r.criteria.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      maxPoints: c.maxPoints,
    })),
    assessmentCount,
  };
}

@OpenAPI({tags: ['Project']})
@injectable()
@JsonController('/project')
export class RubricController {
  constructor(
    @inject(PROJECTS_TYPES.RubricService)
    private readonly _rubricService: RubricService,
  ) {}

  // ─── POST /project/rubric/course/:courseId/version/:versionId ─────────

  @OpenAPI({
    summary: 'Create a rubric',
    description:
      'Creates a reusable rubric for a course version. Criterion IDs are assigned server-side.',
  })
  @Authorized()
  @Post('/rubric/course/:courseId/version/:versionId')
  @HttpCode(200)
  @ResponseSchema(RubricResponse, {description: 'Rubric created', statusCode: 200})
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async createRubric(
    @Params() params: CourseVersionRubricParams,
    @Ability(projectAbility) {ability},
    @Body() body: CreateRubricBody,
  ): Promise<RubricResponse> {
    const {courseId, versionId} = params;
    const projectSubject = subject(ProjectSubject, {courseId, versionId});

    if (!ability.can(ProjectActions.CreateRubric, projectSubject)) {
      throw new ForbiddenError('You do not have permission to create rubrics for this course.');
    }

    const rubric = await this._rubricService.createRubric(
      courseId,
      versionId,
      body.title,
      body.description,
      body.criteria,
    );
    // Freshly created rubric has no assessments yet
    return mapRubric(rubric, 0);
  }

  // ─── GET /project/rubric/course/:courseId/version/:versionId ─────────

  @OpenAPI({
    summary: 'List rubrics for a course version',
    description: 'Returns all rubrics scoped to the given course and version, each including an assessmentCount field.',
  })
  @Authorized()
  @Get('/rubric/course/:courseId/version/:versionId')
  @HttpCode(200)
  @ResponseSchema(RubricResponse, {
    description: 'List of rubrics',
    statusCode: 200,
    isArray: true,
  })
  async getRubricsByCourseVersion(
    @Params() params: CourseVersionRubricParams,
    @Ability(projectAbility) {ability},
    @QueryParam('cohortId') _cohortId?: string,
  ): Promise<RubricResponse[]> {
    const {courseId, versionId} = params;
    const projectSubject = subject(ProjectSubject, {courseId, versionId});

    if (!ability.can(ProjectActions.ViewRubric, projectSubject)) {
      throw new ForbiddenError('You do not have permission to view rubrics for this course.');
    }

    const rubrics = await this._rubricService.getRubricsByCourseVersion(courseId, versionId);

    // Fetch assessment counts in parallel — rubric lists are small so N+1 is acceptable.
    const counts = await Promise.all(
      rubrics.map(r => this._rubricService.getRubricAssessmentCount(r._id!.toString())),
    );

    return rubrics.map((r, i) => mapRubric(r, counts[i]));
  }

  // ─── GET /project/rubric/:rubricId ────────────────────────────────────

  @OpenAPI({
    summary: 'Get a rubric by ID',
    description: 'Returns a single rubric including its assessmentCount. Authorization is checked against the rubric\'s own courseId/versionId.',
  })
  @Authorized()
  @Get('/rubric/:rubricId')
  @HttpCode(200)
  @ResponseSchema(RubricResponse, {description: 'Rubric detail', statusCode: 200})
  async getRubric(
    @Param('rubricId') rubricId: string,
    @Ability(projectAbility) {ability},
  ): Promise<RubricResponse> {
    const rubric = await this._rubricService.getRubric(rubricId);
    // Derive course/version from the rubric itself — never trust caller-supplied IDs
    const projectSubject = subject(ProjectSubject, {
      courseId: rubric.courseId.toString(),
      versionId: rubric.courseVersionId.toString(),
    });

    if (!ability.can(ProjectActions.ViewRubric, projectSubject)) {
      throw new ForbiddenError('You do not have permission to view this rubric.');
    }

    const assessmentCount = await this._rubricService.getRubricAssessmentCount(rubricId);
    return mapRubric(rubric, assessmentCount);
  }

  // ─── PATCH /project/rubric/:rubricId ─────────────────────────────────

  @OpenAPI({
    summary: 'Update a rubric',
    description:
      'Updates a rubric. Rejected (400) if any assessment already references it (rubric is locked).',
  })
  @Authorized()
  @Patch('/rubric/:rubricId')
  @HttpCode(200)
  @ResponseSchema(RubricResponse, {description: 'Updated rubric', statusCode: 200})
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async updateRubric(
    @Param('rubricId') rubricId: string,
    @Ability(projectAbility) {ability},
    @Body() body: UpdateRubricBody,
  ): Promise<RubricResponse> {
    // Load first — derive course/version from the stored rubric, not caller
    const existing = await this._rubricService.getRubric(rubricId);
    const projectSubject = subject(ProjectSubject, {
      courseId: existing.courseId.toString(),
      versionId: existing.courseVersionId.toString(),
    });

    if (!ability.can(ProjectActions.ManageRubric, projectSubject)) {
      throw new ForbiddenError('You do not have permission to edit rubrics for this course.');
    }

    const updated = await this._rubricService.updateRubric(rubricId, body);
    // After a successful update the rubric is still unlocked (count remains 0 — the
    // service would have rejected the call otherwise). Return 0 directly.
    return mapRubric(updated, 0);
  }

  // ─── DELETE /project/rubric/:rubricId ────────────────────────────────

  @OpenAPI({
    summary: 'Delete a rubric',
    description:
      'Permanently deletes a rubric. Rejected (400) if any assessment already references it — ' +
      'deleting such a rubric would leave those assessments with an orphaned rubric reference.',
  })
  @Authorized()
  @Delete('/rubric/:rubricId')
  @HttpCode(200)
  @ResponseSchema(SuccessResponse, {description: 'Rubric deleted', statusCode: 200})
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async deleteRubric(
    @Param('rubricId') rubricId: string,
    @Ability(projectAbility) {ability},
  ): Promise<SuccessResponse> {
    // Load first — verify existence and derive course/version from stored data, not caller
    const existing = await this._rubricService.getRubric(rubricId);
    const projectSubject = subject(ProjectSubject, {
      courseId: existing.courseId.toString(),
      versionId: existing.courseVersionId.toString(),
    });

    if (!ability.can(ProjectActions.ManageRubric, projectSubject)) {
      throw new ForbiddenError('You do not have permission to delete rubrics for this course.');
    }

    // The service handles the lock check and the actual delete.
    // It skips re-fetching the rubric (we already did that above) but still
    // does the assessment count check inside a transaction.
    await this._rubricService.deleteRubric(rubricId);
    return {message: 'Rubric deleted successfully.'};
  }
}
