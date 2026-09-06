import {subject} from '@casl/ability';
import {inject, injectable} from 'inversify';
import {
  Authorized,
  Body,
  CurrentUser,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Param,
  Params,
  Patch,
  Post,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {IUser} from '#root/shared/interfaces/models.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {
  ItemActions,
  getItemAbility,
} from '../../courses/abilities/itemAbilities.js';
import {
  CourseActions,
  getCourseAbility,
} from '../../courses/abilities/courseAbilities.js';
import {CASE_STUDIES_TYPES} from '../types.js';
import {CaseStudyService} from '../services/CaseStudyService.js';
import {
  CaseStudyIdPathParams,
  ComparisonIdPathParams,
  InstructorCaseResponsesPathParams,
  SubmitCaseResponseBody,
  SubmitPickBody,
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

  /**
   * Sync + fetch the case backing a CASE_STUDY course item. The learner panel
   * calls this on open with the course context it already has, so the runtime
   * can key on the item's own id. Idempotent.
   */
  @Authorized()
  @Post('/courses/:courseId/versions/:versionId/items/:itemId/ensure')
  @HttpCode(200)
  async ensureCaseForItem(
    @Param('courseId') courseId: string,
    @Param('versionId') versionId: string,
    @Param('itemId') itemId: string,
    @Ability(getItemAbility) {ability}: any,
  ) {
    this.assertCanAccessItem(ability, {courseId, versionId, itemId});
    const caseStudy = await this.service.ensureCaseForItem({
      courseId,
      courseVersionId: versionId,
      itemId,
    });
    return {
      caseStudyId: caseStudy._id!.toString(),
      title: caseStudy.title,
      bodyMarkdown: caseStudy.bodyMarkdown,
    };
  }

  @Authorized()
  @Get('/:caseStudyId/my-response')
  @HttpCode(200)
  async getMyResponse(
    @Params() params: CaseStudyIdPathParams,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanAccessItem(ability, {
      courseId: caseStudy.courseId.toString(),
      versionId: caseStudy.courseVersionId.toString(),
      itemId: params.caseStudyId,
    });
    return this.service.getMyResponse({
      userId: this.requireUserId(user),
      caseStudyId: params.caseStudyId,
    });
  }

  @Authorized()
  @Post('/:caseStudyId/responses')
  @HttpCode(201)
  async submitResponse(
    @Params() params: CaseStudyIdPathParams,
    @Body() body: SubmitCaseResponseBody,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanAccessItem(ability, {
      courseId: caseStudy.courseId.toString(),
      versionId: caseStudy.courseVersionId.toString(),
      itemId: params.caseStudyId,
    });
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
    @Ability(getItemAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanAccessItem(ability, {
      courseId: caseStudy.courseId.toString(),
      versionId: caseStudy.courseVersionId.toString(),
      itemId: params.caseStudyId,
    });
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
    @Ability(getItemAbility) {ability}: any,
  ) {
    const caseStudy = await this.service.getCaseStudyOrThrow(params.caseStudyId);
    this.assertCanAccessItem(ability, {
      courseId: caseStudy.courseId.toString(),
      versionId: caseStudy.courseVersionId.toString(),
      itemId: params.caseStudyId,
    });
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
    @Ability(getItemAbility) {ability}: any,
  ) {
    const context = await this.service.getComparisonContext(params.comparisonId);
    this.assertCanAccessItem(ability, {
      courseId: context.courseId,
      versionId: context.courseVersionId,
      itemId: context.caseStudyId,
    });
    return this.service.submitPick({
      reviewerId: this.requireUserId(user),
      comparisonId: params.comparisonId,
      outcome: body.outcome,
    });
  }

  // -----------------------------------------------------------------
  // Instructor-facing
  // -----------------------------------------------------------------

  /**
   * All responses for a CASE_STUDY item, sorted newest first.
   * Gated on instructor-level course access (same check as the reflection
   * instructor listing) — author identities are visible to instructors.
   */
  @Authorized()
  @Get('/courses/:courseId/versions/:versionId/items/:itemId/responses')
  @HttpCode(200)
  async listResponsesForInstructor(
    @Params() params: InstructorCaseResponsesPathParams,
    @Ability(getCourseAbility) {ability}: any,
  ) {
    this.assertCanManageCourse(ability, params.courseId);
    const responses = await this.service.listResponsesForInstructor(params.itemId);
    return {responses};
  }

  private requireUserId(user: IUser): string {
    const userId = user?._id?.toString();
    if (!userId) {
      throw new ForbiddenError('Unable to resolve authenticated user.');
    }
    return userId;
  }

  private assertCanManageCourse(ability: any, courseId: string): void {
    if (!ability.can(CourseActions.Modify, subject('Course', {courseId}))) {
      throw new ForbiddenError(
        'You do not have permission to view responses for this course.',
      );
    }
  }

  /**
   * A learner may only act on a case-study item they can actually reach. The
   * item ability encodes enrolment and, when linear progression is on, the
   * completed-plus-current allow list — the same gate every other item type
   * uses (see ReflectionController). Version-level access was too permissive:
   * it let a learner open and submit a case study out of sequence, which then
   * could never complete because start/stop require it to be the current item.
   */
  private assertCanAccessItem(
    ability: any,
    ref: {courseId: string; versionId: string; itemId: string},
  ): void {
    const allowed = ability.can(
      ItemActions.View,
      subject('Item', {
        courseId: ref.courseId,
        versionId: ref.versionId,
        itemId: ref.itemId,
      }),
    );
    if (!allowed) {
      throw new ForbiddenError('You do not have access to this case study item.');
    }
  }
}
