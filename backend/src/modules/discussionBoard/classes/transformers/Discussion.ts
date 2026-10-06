import {Type, Transform, plainToInstance} from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  ObjectIdToString,
  StringToObjectId,
} from '#root/shared/constants/transformerConstants.js';
import {ID} from '#root/shared/interfaces/models.js';
import {IDiscussionThread, IDiscussionReply} from '../../repositories/model.js';

/**
 * Wire shape returned to API clients for a DiscussionThread. Mirrors the
 * underlying document but with ObjectIds stringified — the persistence
 * layer stores ObjectId but the API never leaks that.
 */
export class DiscussionThreadResponse {
  @JSONSchema({description: 'Thread ID', type: 'string'})
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id!: ID;

  @JSONSchema({description: 'Course ID', type: 'string'})
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  courseId!: ID;

  @JSONSchema({description: 'Cohort ID', type: 'string'})
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  cohortId!: ID;

  @JSONSchema({description: 'Author (user) MongoDB ID', type: 'string'})
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  authorId!: ID;

  /**
   * Author's Firebase UID — stable across MongoDB row rebuilds and what
   * the client's `useAuthStore.user.uid` carries. Exposed so the UI can
   * decide whether a thread / reply belongs to the current viewer
   * (own-content menu) without an extra round-trip. Optional because
   * older threads created before Milestone C may not have been authored
   * through a path that records it.
   */
  @JSONSchema({
    description: "Author's Firebase UID (when known).",
    type: 'string',
  })
  @IsOptional()
  @IsString()
  authorFirebaseUid?: string;

  @JSONSchema({description: 'Thread title', type: 'string'})
  @IsString()
  title!: string;

  @JSONSchema({description: 'Thread body', type: 'string'})
  @IsString()
  body!: string;

  @JSONSchema({description: 'Whether the thread is pinned', type: 'boolean'})
  @IsBoolean()
  pinned!: boolean;

  @Type(() => Date)
  @IsDate()
  createdAt!: Date;

  @Type(() => Date)
  @IsDate()
  updatedAt!: Date;
}

export class DiscussionReplyResponse {
  @JSONSchema({description: 'Reply ID', type: 'string'})
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id!: ID;

  @JSONSchema({description: 'Parent thread ID', type: 'string'})
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  threadId!: ID;

  @JSONSchema({description: 'Author (user) MongoDB ID', type: 'string'})
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  authorId!: ID;

  @JSONSchema({
    description: "Author's Firebase UID (when known).",
    type: 'string',
  })
  @IsOptional()
  @IsString()
  authorFirebaseUid?: string;

  @JSONSchema({description: 'Reply body', type: 'string'})
  @IsString()
  body!: string;

  @Type(() => Date)
  @IsDate()
  createdAt!: Date;

  @Type(() => Date)
  @IsDate()
  updatedAt!: Date;
}

/**
 * Bundled payload for `GET /discussions/:threadId`. Thread + replies are
 * returned together so the client doesn't need a second roundtrip.
 */
export class DiscussionThreadDetailResponse {
  @ValidateNested()
  @Type(() => DiscussionThreadResponse)
  thread!: DiscussionThreadResponse;

  @IsArray()
  @ValidateNested({each: true})
  @Type(() => DiscussionReplyResponse)
  replies!: DiscussionReplyResponse[];
}

/**
 * Convert a raw thread document into the API response shape. ObjectIds
 * become strings via the @Transform decorators on the response class.
 *
 * `authorFirebaseUid` is optional and only attached when the caller
 * supplies it (the controller knows who the author is via the ability
 * decorator's `user` field). Threads created before Milestone C simply
 * omit the field — the frontend treats it as "not own content" for any
 * comparison against `useAuthStore.user.uid`.
 */
export function toThreadResponse(
  thread: IDiscussionThread,
  authorFirebaseUid?: string,
): DiscussionThreadResponse {
  return plainToInstance(DiscussionThreadResponse, {
    _id: thread._id,
    courseId: thread.courseId,
    cohortId: thread.cohortId,
    authorId: thread.authorId,
    authorFirebaseUid: authorFirebaseUid ?? thread.authorFirebaseUid,
    title: thread.title,
    body: thread.body,
    pinned: thread.pinned ?? false,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  });
}

/**
 * Convert a raw reply document into the API response shape. ObjectIds
 * become strings via the @Transform decorators on the response class.
 */
export function toReplyResponse(
  reply: IDiscussionReply,
  authorFirebaseUid?: string,
): DiscussionReplyResponse {
  return plainToInstance(DiscussionReplyResponse, {
    _id: reply._id,
    threadId: reply.threadId,
    authorId: reply.authorId,
    authorFirebaseUid: authorFirebaseUid ?? reply.authorFirebaseUid,
    body: reply.body,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
  });
}

/**
 * Convenience: bundle a thread + replies into the bundled
 * `DiscussionThreadDetailResponse` shape. Both payloads get the
 * caller-supplied author Firebase UID where applicable.
 */
export function toThreadDetailResponse(
  thread: IDiscussionThread,
  replies: IDiscussionReply[],
  authorFirebaseUid?: string,
): DiscussionThreadDetailResponse {
  return plainToInstance(DiscussionThreadDetailResponse, {
    thread: {
      _id: thread._id,
      courseId: thread.courseId,
      cohortId: thread.cohortId,
      authorId: thread.authorId,
      authorFirebaseUid:
        authorFirebaseUid ?? thread.authorFirebaseUid,
      title: thread.title,
      body: thread.body,
      pinned: thread.pinned ?? false,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    },
    replies: replies.map(r => ({
      _id: r._id,
      threadId: r.threadId,
      authorId: r.authorId,
      authorFirebaseUid: authorFirebaseUid ?? r.authorFirebaseUid,
      body: r.body,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
}