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
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {IUser} from '#root/shared/interfaces/models.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {ItemActions, getItemAbility} from '../../courses/abilities/itemAbilities.js';
import {COMMENTS_TYPES} from '../types.js';
import {CommentService} from '../services/CommentService.js';
import {CommentItemPathParams, CreateCommentBody} from '../classes/validators/CommentValidators.js';

/**
 * Minimal, deliberately small (PLANNING.md §6) — flat comments under a video
 * item, visible to everyone enrolled in that course version. No voting, no
 * moderation queue in v1; the studentQuestions screening pipeline exists to
 * be wired in later if this proves worth the investment, not before.
 */
@OpenAPI({tags: ['Comments']})
@JsonController('/comments')
@injectable()
export class CommentController {
  constructor(
    @inject(COMMENTS_TYPES.CommentService)
    private readonly service: CommentService,
  ) {}

  @Authorized()
  @Get('/courses/:courseId/versions/:courseVersionId/items/:itemId')
  @HttpCode(200)
  async listComments(
    @Params() params: CommentItemPathParams,
    @Ability(getItemAbility) {ability}: any,
  ) {
    this.assertCanAccessItem(ability, params);
    const comments = await this.service.listForItem(params.courseVersionId, params.itemId);
    return {comments};
  }

  @Authorized()
  @Post('/courses/:courseId/versions/:courseVersionId/items/:itemId')
  @HttpCode(201)
  async postComment(
    @Params() params: CommentItemPathParams,
    @Body() body: CreateCommentBody,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) {ability}: any,
  ) {
    this.assertCanAccessItem(ability, params);
    const userId = user?._id?.toString();
    if (!userId) {
      throw new ForbiddenError('Unable to resolve authenticated user.');
    }
    return this.service.postComment({
      userId,
      itemId: params.itemId,
      courseVersionId: params.courseVersionId,
      text: body.text,
      parentCommentId: body.parentCommentId,
    });
  }

  private assertCanAccessItem(
    ability: any,
    ref: {courseId: string; courseVersionId: string; itemId: string},
  ): void {
    const allowed = ability.can(
      ItemActions.View,
      subject('Item', {courseId: ref.courseId, versionId: ref.courseVersionId, itemId: ref.itemId}),
    );
    if (!allowed) {
      throw new ForbiddenError('You do not have access to comments on this item.');
    }
  }
}
