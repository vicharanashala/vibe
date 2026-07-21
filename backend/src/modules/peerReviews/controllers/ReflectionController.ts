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
  Params,
  Post,
  QueryParams,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {IUser} from '#root/shared/interfaces/models.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {
  CourseActions,
  getCourseAbility,
} from '../../courses/abilities/courseAbilities.js';
import {PEER_REVIEW_TYPES} from '../types.js';
import {ReflectionService} from '../services/ReflectionService.js';
import {
  InstructorPathParams,
  CreateReflectionBody,
  CreateReviewBody,
  InstructorReflectionListQuery,
  InstructorStatsQuery,
  ReflectionIdPathParams,
  ReflectionItemPathParams,
} from '../classes/validators/ReflectionValidator.js';
import {DEFAULT_LIST_LIMIT} from '../constants.js';

@OpenAPI({
  tags: ['Peer Reviewed Reflections'],
})
@JsonController('/peer-reviews')
@injectable()
export class ReflectionController {
  constructor(
    @inject(PEER_REVIEW_TYPES.ReflectionService)
    private readonly service: ReflectionService,
  ) {}

  @Authorized()
  @Post(
    '/courses/:courseId/versions/:courseVersionId/modules/:moduleId/sections/:itemId/reflections',
  )
  @HttpCode(201)
  async submitReflection(
    @Params() params: ReflectionItemPathParams,
    @Body() body: CreateReflectionBody,
    @CurrentUser() user: IUser,
  ): Promise<{reflectionId: string}> {
    return this.service.submitReflection({
      userId: this.requireUserId(user),
      courseId: params.courseId,
      courseVersionId: params.courseVersionId,
      itemId: params.itemId,
      text: body.text,
      confidence: body.confidence,
    });
  }

  @Authorized()
  @Get(
    '/courses/:courseId/versions/:courseVersionId/modules/:moduleId/sections/:itemId/reflections/me',
  )
  @HttpCode(200)
  async getMyReflection(
    @Params() params: ReflectionItemPathParams,
    @CurrentUser() user: IUser,
  ) {
    const result = await this.service.getMyReflection({
      userId: this.requireUserId(user),
      itemId: params.itemId,
    });
    return {reflection: result};
  }

  /**
   * Next peer reflection for this user to review. Returns `{reflection: null}`
   * when the pool is empty rather than 404, because "nothing left to review"
   * is an ordinary state of the queue, not an error.
   */
  @Authorized()
  @Get(
    '/courses/:courseId/versions/:courseVersionId/modules/:moduleId/sections/:itemId/review-queue/next',
  )
  @HttpCode(200)
  async getNextForReview(
    @Params() params: ReflectionItemPathParams,
    @CurrentUser() user: IUser,
  ) {
    const reflection = await this.service.getNextForReview({
      userId: this.requireUserId(user),
      itemId: params.itemId,
    });
    return {reflection};
  }

  @Authorized()
  @Post('/reflections/:reflectionId/reviews')
  @HttpCode(201)
  async submitReview(
    @Params() params: ReflectionIdPathParams,
    @Body() body: CreateReviewBody,
    @CurrentUser() user: IUser,
  ) {
    return this.service.submitReview({
      reviewerId: this.requireUserId(user),
      reflectionId: params.reflectionId,
      scores: body.scores,
      helpful: body.helpful,
    });
  }

  @Authorized()
  @Get('/courses/:courseId/versions/:courseVersionId/reflections')
  @HttpCode(200)
  async listForInstructor(
    @Params() params: InstructorPathParams,
    @QueryParams() query: InstructorReflectionListQuery,
    @Ability(getCourseAbility) {ability}: any,
  ) {
    this.assertCanManageCourse(ability, params.courseId);
    const items = await this.service.listForInstructor({
      courseVersionId: params.courseVersionId,
      itemId: query.itemId,
      limit: query.limit ?? DEFAULT_LIST_LIMIT,
    });
    return {items};
  }

  @Authorized()
  @Get('/courses/:courseId/versions/:courseVersionId/reflections/stats')
  @HttpCode(200)
  async getInstructorStats(
    @Params() params: InstructorPathParams,
    @QueryParams() query: InstructorStatsQuery,
    @Ability(getCourseAbility) {ability}: any,
  ) {
    this.assertCanManageCourse(ability, params.courseId);
    return this.service.getInstructorStats({
      courseVersionId: params.courseVersionId,
      itemId: query.itemId,
    });
  }

  private requireUserId(user: IUser): string {
    const userId = user?._id?.toString();
    if (!userId) {
      throw new ForbiddenError('Unable to resolve authenticated user.');
    }
    return userId;
  }

  /**
   * Instructor listings expose author identities, so they are gated on the same
   * permission that governs editing the course rather than mere enrolment.
   */
  private assertCanManageCourse(ability: any, courseId: string): void {
    if (!ability.can(CourseActions.Modify, subject('Course', {courseId}))) {
      throw new ForbiddenError(
        'You do not have permission to view reflections for this course.',
      );
    }
  }
}
