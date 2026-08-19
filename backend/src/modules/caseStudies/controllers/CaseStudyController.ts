import {subject} from '@casl/ability';
import {inject, injectable} from 'inversify';
import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Params,
  Patch,
  Post,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {IUser} from '#root/shared/interfaces/models.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {
  CourseVersionActions,
  getCourseVersionAbility,
} from '../../courses/abilities/versionAbilities.js';
import {CASE_STUDIES_TYPES} from '../types.js';
import {CaseStudyService} from '../services/CaseStudyService.js';
import {
  CaseStudyCoursePathParams,
  CaseStudyIdPathParams,
  ComparisonIdPathParams,
  CreateCaseStudyBody,
  SubmitCaseResponseBody,
  SubmitPickBody,
  UpdateCaseStudyBody,
} from '../classes/validators/CaseStudyValidators.js';

@OpenAPI({
  tags: ['Case Studies'],
})
@JsonController('/case-studies')
@injectable()
export class CaseStudyController {
  constructor(
    @inject(CASE_STUDIES_TYPES.CaseStudyService)
    private readonly service: CaseStudyService,
  ) {}

  // -----------------------------------------------------------------
  // Participant-facing
  // -----------------------------------------------------------------

  @Authorized()
  @Get('/courses/:courseId/versions/:versionId')
  @HttpCode(200)
  async listCases(
    @Params() params: CaseStudyCoursePathParams,
    @CurrentUser() user: IUser,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    this.assertCanAccessVersion(ability, params.versionId);
    const cases = await this.service.listCasesForUser({
      userId: this.requireUserId(user),
      courseId: params.courseId,
      courseVersionId: params.versionId,
    });
    return {cases};
  }

  @Authorized()
  @Get('/:caseStudyId/my-response')
  @HttpCode(200)
  async getMyResponse(
    @Params() params: CaseStudyIdPathParams,
    @CurrentUser() user: IUser,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanAccessVersion(ability, caseStudy.courseVersionId.toString());
    const response = await this.service.getMyResponse({
      userId: this.requireUserId(user),
      caseStudyId: params.caseStudyId,
    });
    return {response};
  }

  @Authorized()
  @Post('/:caseStudyId/responses')
  @HttpCode(201)
  async submitResponse(
    @Params() params: CaseStudyIdPathParams,
    @Body() body: SubmitCaseResponseBody,
    @CurrentUser() user: IUser,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanAccessVersion(ability, caseStudy.courseVersionId.toString());
    return this.service.submitResponse({
      userId: this.requireUserId(user),
      caseStudyId: params.caseStudyId,
      beat1a: body.beat1a,
      beat1b: body.beat1b,
      beat1c: body.beat1c,
      steelman: body.steelman,
      roomPerspective: body.roomPerspective,
      changeCommitment: body.changeCommitment,
      zoomSessionDate: body.zoomSessionDate,
    });
  }

  @Authorized()
  @Patch('/:caseStudyId/responses')
  @HttpCode(200)
  async reviseResponse(
    @Params() params: CaseStudyIdPathParams,
    @Body() body: SubmitCaseResponseBody,
    @CurrentUser() user: IUser,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanAccessVersion(ability, caseStudy.courseVersionId.toString());
    return this.service.reviseResponse({
      userId: this.requireUserId(user),
      caseStudyId: params.caseStudyId,
      beat1a: body.beat1a,
      beat1b: body.beat1b,
      beat1c: body.beat1c,
      steelman: body.steelman,
      roomPerspective: body.roomPerspective,
      changeCommitment: body.changeCommitment,
    });
  }

  /**
   * Serves the next pair to review, or `{pair: null}` when the pool is
   * exhausted for this reviewer — matching `ReflectionController`'s
   * "nothing left to review is an ordinary state" convention.
   */
  @Authorized()
  @Get('/:caseStudyId/pairs/next')
  @HttpCode(200)
  async getNextPair(
    @Params() params: CaseStudyIdPathParams,
    @CurrentUser() user: IUser,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanAccessVersion(ability, caseStudy.courseVersionId.toString());
    const pair = await this.service.getNextPair({
      reviewerId: this.requireUserId(user),
      caseStudyId: params.caseStudyId,
    });
    return {pair};
  }

  @Authorized()
  @Post('/pairs/:comparisonId/pick')
  @HttpCode(200)
  async submitPick(
    @Params() params: ComparisonIdPathParams,
    @Body() body: SubmitPickBody,
    @CurrentUser() user: IUser,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    const context = await this.service.getComparisonContext(params.comparisonId);
    this.assertCanAccessVersion(ability, context.courseVersionId);
    return this.service.submitPick({
      reviewerId: this.requireUserId(user),
      comparisonId: params.comparisonId,
      outcome: body.outcome,
    });
  }

  // -----------------------------------------------------------------
  // Instructor / admin. Case content is authored via the version-controlled
  // seed file + scripts/seedCaseStudies.ts (the primary path); these routes
  // exist for operational fixes (reordering, corrections), not authoring.
  // -----------------------------------------------------------------

  @Authorized()
  @Post('/courses/:courseId/versions/:versionId')
  @HttpCode(201)
  async createCaseStudy(
    @Params() params: CaseStudyCoursePathParams,
    @Body() body: CreateCaseStudyBody,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    this.assertCanManageVersion(ability, params.versionId);
    return this.service.createCaseStudy({
      courseId: params.courseId,
      courseVersionId: params.versionId,
      sequenceIndex: body.sequenceIndex,
      title: body.title,
      bodyMarkdown: body.bodyMarkdown,
      linkedItemId: body.linkedItemId,
    });
  }

  @Authorized()
  @Patch('/:caseStudyId')
  @HttpCode(200)
  async updateCaseStudy(
    @Params() params: CaseStudyIdPathParams,
    @Body() body: UpdateCaseStudyBody,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanManageVersion(ability, caseStudy.courseVersionId.toString());
    await this.service.updateCaseStudy(params.caseStudyId, body);
    return {success: true};
  }

  @Authorized()
  @Delete('/:caseStudyId')
  @HttpCode(200)
  async deleteCaseStudy(
    @Params() params: CaseStudyIdPathParams,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanManageVersion(ability, caseStudy.courseVersionId.toString());
    await this.service.deleteCaseStudy(params.caseStudyId);
    return {success: true};
  }

  @Authorized()
  @Get('/courses/:courseId/versions/:versionId/stats')
  @HttpCode(200)
  async getStats(
    @Params() params: CaseStudyCoursePathParams,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    this.assertCanManageVersion(ability, params.versionId);
    return this.service.getInstructorStats(params.versionId);
  }

  @Authorized()
  @Get('/courses/:courseId/versions/:versionId/responses')
  @HttpCode(200)
  async listAllResponses(
    @Params() params: CaseStudyCoursePathParams,
    @Ability(getCourseVersionAbility) {ability}: any,
  ) {
    this.assertCanManageVersion(ability, params.versionId);
    const cases = await this.service.getResponsesForInstructor(params.versionId);
    return {cases};
  }

  private requireUserId(user: IUser): string {
    const userId = user?._id?.toString();
    if (!userId) {
      throw new ForbiddenError('Unable to resolve authenticated user.');
    }
    return userId;
  }

  /**
   * Participant routes: enrolled STUDENTs and course staff (view is implied
   * by manage). Scoped to `versionId`, not just `courseId` — a course can
   * have multiple versions, and CourseActions.View only bounds the enrolled
   * course, not which version, which would otherwise let a learner enrolled
   * in one version reach another version's case studies by id.
   */
  private assertCanAccessVersion(ability: any, versionId: string): void {
    if (!ability.can(CourseVersionActions.View, subject('CourseVersion', {versionId}))) {
      throw new ForbiddenError('You do not have access to this course version.');
    }
  }

  /** Admin routes: instructor/manager/admin only, same bar as editing the course version itself. */
  private assertCanManageVersion(ability: any, versionId: string): void {
    if (!ability.can(CourseVersionActions.Modify, subject('CourseVersion', {versionId}))) {
      throw new ForbiddenError(
        'You do not have permission to manage case studies for this course version.',
      );
    }
  }
}
