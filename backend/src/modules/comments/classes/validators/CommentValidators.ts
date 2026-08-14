import {IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {MAX_COMMENT_LENGTH} from '../../constants.js';

export class CommentItemPathParams {
  @IsMongoId()
  courseId!: string;

  @IsMongoId()
  courseVersionId!: string;

  @IsMongoId()
  itemId!: string;
}

export class CreateCommentBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_COMMENT_LENGTH)
  @JSONSchema({
    description: 'The comment body, free text (no i18n restriction — mixed-script input is expected).',
  })
  text!: string;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({
    description: 'Set to reply to an existing top-level comment. Replies may not themselves be replied to.',
  })
  parentCommentId?: string;
}
