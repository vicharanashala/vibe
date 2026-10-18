import 'reflect-metadata';
import {
  Authorized,
  Body,
  Delete,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  OnUndefined,
  Params,
  Patch,
  Post,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {inject, injectable} from 'inversify';
import {subject} from '@casl/ability';

import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {BadRequestErrorResponse} from '#root/shared/middleware/errorHandler.js';

import {DISCUSSIONBOARD_TYPES} from '../types.js';
import {DiscussionService} from '../services/DiscussionService.js';
import {
  getDiscussionAbility,
  DiscussionActions,
  DiscussionSubject,
} from '../abilities/discussionAbilities.js';
import {
  CourseIdParams,
  CreateReplyBody,
  CreateThreadBody,
  PinThreadBody,
  ReplyIdParams,
  ThreadIdParams,
  UpdateThreadBody,
} from '../classes/validators/DiscussionValidators.js';
import {
  DiscussionReplyResponse,
  DiscussionThreadDetailResponse,
  DiscussionThreadResponse,
  toReplyResponse,
  toThreadDetailResponse,
  toThreadResponse,
} from '../classes/transformers/Discussion.js';

/**
 * Pulled from `routing-controllers`' `Ability` decorator — that's the
 * raw auth user doc, which carries both the MongoDB `_id` (used as
 * `AuthenticatedUser.userId` already) and the `firebaseUID` we want to
 * denormalise onto new threads / replies for own-content UI checks.
 *
 * We accept it loosely via `any` because the shared decorator types
 * `user` as the auth-shape but the runtime object is the underlying
 * FirebaseAuthService user doc (which has `_id` + `firebaseUID`).
 */
type AuthUserRecord = {
  _id?: unknown;
  firebaseUID?: string;
};

function firebaseUidOf(
  user: AuthUserRecord | undefined | null,
): string | undefined {
  return user?.firebaseUID ?? undefined;
}

@OpenAPI({
  tags: ['Discussions'],
})
@JsonController()
@injectable()
export class DiscussionController {
  constructor(
    @inject(DISCUSSIONBOARD_TYPES.DiscussionService)
    private readonly _service: DiscussionService,
  ) {}

  /**
   * List threads on a course visible to the caller. Cohort scoping is
   * applied server-side — the caller can never widen beyond their own
   * cohort (or, for unrestricted roles, beyond the whole course).
   */
  @Authorized()
  @Get('/course/:courseId/discussions')
  @HttpCode(200)
  @OpenAPI({
    summary: 'List discussion threads on a course',
    description:
      'Returns threads visible to the authenticated caller. Threads from ' +
      "cohorts the caller isn't enrolled in are filtered out server-side.",
  })
  @ResponseSchema(DiscussionThreadResponse, {
    description: 'Visible threads',
    statusCode: 200,
    isArray: true,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async listThreads(
    @Params() params: CourseIdParams,
    @Ability(getDiscussionAbility) {ability, user, authenticatedUser},
  ): Promise<DiscussionThreadResponse[]> {
    const courseSubject = subject(DiscussionSubject, {
      courseId: params.courseId,
    });
    if (!ability.can(DiscussionActions.View, courseSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view discussions on this course',
      );
    }

    const threads = await this._service.listThreads(
      params.courseId,
      authenticatedUser,
    );
    return threads.map(t => toThreadResponse(t, t.authorFirebaseUid));
  }

  /**
   * Create a new thread. The `cohortId` in the body is treated as a
   * request — the service re-checks it against the caller's authorised
   * scope, so a student can't post into another cohort by tampering with
   * the request.
   */
  @Authorized()
  @Post('/course/:courseId/discussions')
  @HttpCode(201)
  @OpenAPI({
    summary: 'Create a discussion thread',
    description:
      'Creates a thread in the requested cohort. The cohortId must be ' +
      "inside the caller's authorised cohort scope for the course.",
  })
  @ResponseSchema(DiscussionThreadResponse, {
    description: 'Thread created',
    statusCode: 201,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async createThread(
    @Params() params: CourseIdParams,
    @Body() body: CreateThreadBody,
    @Ability(getDiscussionAbility) {user, authenticatedUser},
  ): Promise<DiscussionThreadResponse> {
    const created = await this._service.createThread(
      {
        courseId: params.courseId,
        cohortId: body.cohortId,
        title: body.title,
        body: body.body,
        authorFirebaseUid: firebaseUidOf(user),
      },
      authenticatedUser,
    );
    return toThreadResponse(
      created,
      created.authorFirebaseUid ?? firebaseUidOf(user),
    );
  }

  /**
   * Fetch a single thread + its replies. Cohorts the caller can't
   * read return the same 404 the missing-thread path uses; see the
   * service.
   */
  @Authorized()
  @Get('/discussions/:threadId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get a discussion thread',
    description:
      'Returns a thread and its replies. The thread must belong to a ' +
      'cohort the caller is permitted to read.',
  })
  @ResponseSchema(DiscussionThreadDetailResponse, {
    description: 'Thread and replies',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async getThread(
    @Params() params: ThreadIdParams,
    @Ability(getDiscussionAbility) {authenticatedUser},
  ): Promise<DiscussionThreadDetailResponse> {
    const {thread, replies} = await this._service.getThread(
      params.threadId,
      authenticatedUser,
    );
    return toThreadDetailResponse(thread, replies);
  }

  /**
   * Edit an existing thread. Author can edit their own thread; a
   * teacher-track role on the thread's course can edit any thread in
   * their cohort.
   */
  @Authorized()
  @Patch('/discussions/:threadId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Edit a discussion thread',
    description:
      'Edits the title and/or body of a thread. The caller must be ' +
      'the author, or a course moderator (teacher-track role) on ' +
      "the thread's course.",
  })
  @ResponseSchema(DiscussionThreadResponse, {
    description: 'Updated thread',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async updateThread(
    @Params() params: ThreadIdParams,
    @Body() body: UpdateThreadBody,
    @Ability(getDiscussionAbility) {authenticatedUser},
  ): Promise<DiscussionThreadResponse> {
    const updated = await this._service.updateThread(
      params.threadId,
      {title: body.title, body: body.body},
      authenticatedUser,
    );
    return toThreadResponse(updated, updated.authorFirebaseUid);
  }

  /**
   * Delete a thread (and cascade its replies). Author can delete their
   * own thread; a teacher-track role on the thread's course can delete
   * any thread in their cohort.
   */
  @Authorized()
  @Delete('/discussions/:threadId')
  @OnUndefined(204)
  @HttpCode(204)
  @OpenAPI({
    summary: 'Delete a discussion thread',
    description:
      'Deletes a thread and cascades to its replies. The caller must ' +
      'be the author, or a course moderator on the thread course.',
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async deleteThread(
    @Params() params: ThreadIdParams,
    @Ability(getDiscussionAbility) {authenticatedUser},
  ): Promise<void> {
    await this._service.deleteThread(params.threadId, authenticatedUser);
  }

  /**
   * Pin / unpin a thread. Teacher-only — anyone else (including the
   * thread's own author) gets 403.
   */
  @Authorized()
  @Patch('/discussions/:threadId/pin')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Pin or unpin a discussion thread',
    description:
      'Sets the pinned flag on a thread. Teacher-only — students get ' +
      '403. The pin endpoint uses 403 (not 404) on denial because the ' +
      "thread's existence isn't in question here.",
  })
  @ResponseSchema(DiscussionThreadResponse, {
    description: 'Thread with the new pin state',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async pinThread(
    @Params() params: ThreadIdParams,
    @Body() body: PinThreadBody,
    @Ability(getDiscussionAbility) {authenticatedUser},
  ): Promise<DiscussionThreadResponse> {
    const updated = await this._service.pinThread(
      params.threadId,
      {pinned: body.pinned},
      authenticatedUser,
    );
    return toThreadResponse(updated, updated.authorFirebaseUid);
  }

  /**
   * Post a reply to an existing thread. The thread must be in a cohort
   * the caller can read (see `DiscussionService.createReply`).
   */
  @Authorized()
  @Post('/discussions/:threadId/replies')
  @HttpCode(201)
  @OpenAPI({
    summary: 'Reply to a discussion thread',
    description:
      'Posts a reply to a thread the caller is permitted to read.',
  })
  @ResponseSchema(DiscussionReplyResponse, {
    description: 'Reply posted',
    statusCode: 201,
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async createReply(
    @Params() params: ThreadIdParams,
    @Body() body: CreateReplyBody,
    @Ability(getDiscussionAbility) {user, authenticatedUser},
  ): Promise<DiscussionReplyResponse> {
    const reply = await this._service.createReply(
      params.threadId,
      {body: body.body, authorFirebaseUid: firebaseUidOf(user)},
      authenticatedUser,
    );
    return toReplyResponse(reply, reply.authorFirebaseUid);
  }

  /**
   * Delete a single reply. Author can delete their own reply; a
   * teacher-track role on the parent thread's course can delete any
   * reply in their cohort.
   */
  @Authorized()
  @Delete('/replies/:replyId')
  @OnUndefined(204)
  @HttpCode(204)
  @OpenAPI({
    summary: 'Delete a discussion reply',
    description:
      'Deletes a single reply. The caller must be the author, or a ' +
      'course moderator on the parent thread course.',
  })
  @ResponseSchema(BadRequestErrorResponse, {statusCode: 400})
  async deleteReply(
    @Params() params: ReplyIdParams,
    @Ability(getDiscussionAbility) {authenticatedUser},
  ): Promise<void> {
    await this._service.deleteReply(params.replyId, authenticatedUser);
  }
}
