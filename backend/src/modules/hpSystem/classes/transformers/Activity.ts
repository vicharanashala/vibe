import {
  ObjectIdToString,
  StringToObjectId,
  ObjectIdArrayToStringArray,
  StringArrayToObjectIdArray,
} from '#root/shared/constants/transformerConstants.js';

import { ID } from '#root/shared/interfaces/models.js';

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Expose, Transform, Type } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';
import { ActivityStatus, ActivityType, AttachmentKind, LateRewardPolicy, ReviewDecision, SubmissionMode } from '../../constants.js';


export class HpActivityAttachment {
  @Expose()
  @IsString()
  @JSONSchema({ title: 'Attachment Name', type: 'string', example: 'Rubric' })
  name: string;

  @Expose()
  @IsString()
  @JSONSchema({ title: 'Attachment URL', type: 'string', example: 'https://example.com/doc.pdf' })
  url: string;

  @Expose()
  @IsEnum(AttachmentKind)
  @JSONSchema({
    title: 'Attachment Kind',
    type: 'string',
    enum: Object.values(AttachmentKind),
    example: 'PDF',
  })
  kind: AttachmentKind;
}

export class HpActivityStats {
  @Expose()
  @IsNumber()
  @JSONSchema({ title: 'Total Students', type: 'number', example: 50 })
  totalStudents: number;

  @Expose()
  @IsNumber()
  @JSONSchema({ title: 'Submitted Count', type: 'number', example: 40 })
  submittedCount: number;

  @Expose()
  @IsNumber()
  @JSONSchema({ title: 'Completed Count', type: 'number', example: 38 })
  completedCount: number;

  @Expose()
  @IsNumber()
  @JSONSchema({ title: 'Overdue Count', type: 'number', example: 5 })
  overdueCount: number;

  @Expose()
  @Type(() => Date)
  @JSONSchema({ title: 'Last Recomputed At', type: 'string', format: 'date-time' })
  lastRecomputedAt: Date;
}

/**
 * hp_activities data transformation.
 *
 * @category HP/Transformers
 */
export class HpActivityTransformer {
  @Expose()
  @JSONSchema({ title: 'Activity ID', type: 'string' })
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  // Scoping
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  @JSONSchema({ title: 'Course Version ID', type: 'string' })
  courseVersionId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  @JSONSchema({ title: 'Course ID', type: 'string' })
  courseId: ID;

  @Expose()
  @IsString()
  @JSONSchema({ title: 'Cohort', type: 'string', example: 'JAN-2026' })
  cohort: string;

  // Authoring
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  @JSONSchema({ title: 'Created By Teacher ID', type: 'string' })
  createdByTeacherId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  @JSONSchema({ title: 'Published By Teacher ID', type: 'string' })
  publishedByTeacherId: ID;

  @Expose()
  @IsEnum(ActivityStatus)
  @JSONSchema({
    title: 'Status',
    type: 'string',
    enum: Object.values(ActivityStatus),
    example: 'PUBLISHED',
  })
  status: ActivityStatus;

  // Content
  @Expose()
  @IsString()
  @JSONSchema({ title: 'Title', type: 'string', example: 'LinkedIn Post' })
  title: string;

  @Expose()
  @IsString()
  @JSONSchema({ title: 'Description', type: 'string', example: 'Create a post about Git' })
  description: string;

  @Expose()
  @IsEnum(ActivityType)
  @JSONSchema({
    title: 'Activity Type',
    type: 'string',
    enum: Object.values(ActivityType),
    example: 'ASSIGNMENT',
  })
  activityType: ActivityType;

  // Timing
  @Expose()
  @Type(() => Date)
  @JSONSchema({ title: 'Deadline At', type: 'string', format: 'date-time' })
  deadlineAt: Date;

  @Expose()
  @IsBoolean()
  @JSONSchema({ title: 'Allow Late Submission', type: 'boolean', example: false })
  allowLateSubmission: boolean;

  @Expose()
  @IsEnum(LateRewardPolicy)
  @JSONSchema({
    title: 'Late Reward Policy',
    type: 'string',
    enum: Object.values(LateRewardPolicy),
    example: 'REWARD_DENIED',
  })
  lateRewardPolicy: LateRewardPolicy;

  // Submission mode
  @Expose()
  @IsEnum(SubmissionMode)
  @JSONSchema({
    title: 'Submission Mode',
    type: 'string',
    enum: Object.values(SubmissionMode),
    example: 'IN_PLATFORM',
  })
  submissionMode: SubmissionMode;

  @Expose()
  @IsString()
  @JSONSchema({ title: 'External Link', type: 'string', example: 'https://forms.google.com' })
  externalLink: string;

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HpActivityAttachment)
  @JSONSchema({ title: 'Attachments', type: 'array', items: { type: 'object' } })
  attachments: HpActivityAttachment[];

  // Rules
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  @JSONSchema({ title: 'Rule Config ID', type: 'string' })
  ruleConfigId: ID;

  @Expose()
  @IsBoolean()
  @JSONSchema({ title: 'Is Mandatory', type: 'boolean', example: true })
  isMandatory: boolean;

  // Stats
  @Expose()
  @ValidateNested()
  @Type(() => HpActivityStats)
  @JSONSchema({ title: 'Stats', type: 'object' })
  stats: HpActivityStats;

  @Expose()
  @Type(() => Date)
  @JSONSchema({ title: 'Created At', type: 'string', format: 'date-time' })
  createdAt?: Date;

  @Expose()
  @Type(() => Date)
  @JSONSchema({ title: 'Updated At', type: 'string', format: 'date-time' })
  updatedAt?: Date;

  constructor(body?: Partial<HpActivityTransformer>) {
    if (body) Object.assign(this, body);
    this.attachments = this.attachments ?? [];
    this.stats = this.stats ?? ({} as any);
  }
}


