import {
  IsString,
  IsOptional,
  IsMongoId,
  IsNotEmpty,
  IsBoolean,
  Matches,
  MaxLength,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

/**
 * Path params for routes pinned to a single course (list / create).
 */
export class CourseIdParams {
  @JSONSchema({
    description: 'Unique identifier of the course',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseId!: string;
}

/**
 * Path params for routes pinned to a single thread
 * (get / edit / delete / reply).
 */
export class ThreadIdParams {
  @JSONSchema({
    description: 'Unique identifier of the discussion thread',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  threadId!: string;
}

/**
 * Body for `POST /course/:courseId/discussions`.
 *
 * `cohortId` is the *requested* cohort — the service re-derives the caller's
 * authorised scope server-side and rejects any cohortId the caller can't
 * actually write into, so a malicious client cannot post into another
 * cohort by supplying it here.
 */
export class CreateThreadBody {
  @JSONSchema({
    description: 'Title of the discussion thread',
    type: 'string',
    example: 'Stuck on Module 3 Project',
  })
  @IsString()
  @IsNotEmpty({message: 'Title is required'})
  @Matches(/\S/, {message: 'Title cannot be empty or just spaces'})
  @MaxLength(200, {message: 'Title must be 200 characters or fewer'})
  title!: string;

  @JSONSchema({
    description: 'Body of the discussion thread',
    type: 'string',
    example: 'Has anyone else run into the build error on the API call?',
  })
  @IsString()
  @IsNotEmpty({message: 'Body is required'})
  @Matches(/\S/, {message: 'Body cannot be empty or just spaces'})
  body!: string;

  @JSONSchema({
    description:
      'Cohort the thread belongs to. Must be inside the caller\'s authorised scope.',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty({message: 'cohortId is required'})
  cohortId!: string;
}

/**
 * Body for `PATCH /discussions/:threadId`. Both fields are optional but
 * at least one is expected — the service treats an all-empty body as a
 * bad request.
 */
export class UpdateThreadBody {
  @JSONSchema({
    description: 'Updated title',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  @Matches(/\S/, {message: 'Title cannot be empty or just spaces'})
  @MaxLength(200, {message: 'Title must be 200 characters or fewer'})
  title?: string;

  @JSONSchema({
    description: 'Updated body',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  @Matches(/\S/, {message: 'Body cannot be empty or just spaces'})
  body?: string;
}

/**
 * Body for `POST /discussions/:threadId/replies`.
 */
export class CreateReplyBody {
  @JSONSchema({
    description: 'Body of the reply',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty({message: 'Body is required'})
  @Matches(/\S/, {message: 'Body cannot be empty or just spaces'})
  body!: string;
}

/**
 * Path params for routes pinned to a single reply (`DELETE /replies/:replyId`).
 */
export class ReplyIdParams {
  @JSONSchema({
    description: 'Unique identifier of the discussion reply',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  replyId!: string;
}

/**
 * Body for `PATCH /discussions/:threadId/pin`. The boolean is required
 * rather than optional so the API explicitly distinguishes "pin" from
 * "unpin" — a missing field is a 400.
 */
export class PinThreadBody {
  @JSONSchema({
    description: 'Whether the thread should be pinned.',
    type: 'boolean',
  })
  @IsBoolean({message: 'pinned must be a boolean'})
  pinned!: boolean;
}

export const DISCUSSION_VALIDATORS = [
  CourseIdParams,
  ThreadIdParams,
  ReplyIdParams,
  CreateThreadBody,
  UpdateThreadBody,
  CreateReplyBody,
  PinThreadBody,
];