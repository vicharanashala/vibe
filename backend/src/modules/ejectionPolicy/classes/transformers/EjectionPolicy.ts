import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {ID} from '#shared/interfaces/models.js';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsEnum,
  ValidateNested,
  IsObject,
  Min,
} from 'class-validator';
import {
  PolicyScope,
  PolicyStatus,
  PolicyTriggers,
  PolicyActions,
  InactivityTrigger,
  MissedDeadlinesTrigger,
  PolicyViolationsTrigger,
} from '../../types.js';

export class EjectionPolicy {
  @JSONSchema({
    title: 'Policy ID',
    description: 'Unique identifier for the ejection policy',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id?: ID;

  @JSONSchema({
    title: 'Policy Name',
    description: 'Human-readable name for the policy',
    example: 'Standard Inactivity Policy',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @JSONSchema({
    title: 'Description',
    description: 'Detailed description of what this policy enforces',
    example: 'Removes learners who are inactive for 30 days',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @JSONSchema({
    title: 'Scope',
    description:
      'Whether this policy applies platform-wide or to a specific course',
    enum: ['platform', 'course'],
    example: 'course',
  })
  @IsNotEmpty()
  @IsEnum(['platform', 'course'])
  scope: PolicyScope;

  @JSONSchema({
    title: 'Course ID',
    description: 'Course this policy applies to (null for platform-wide)',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  courseId?: ID;

  @JSONSchema({
    title: 'Active Status',
    description: 'Whether this policy is currently active',
    type: 'boolean',
    default: true,
  })
  @IsBoolean()
  isActive: boolean = true;

  @JSONSchema({
    title: 'Priority',
    description: 'Policy priority (higher number = higher priority)',
    type: 'number',
    default: 100,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  priority: number = 100;

  @JSONSchema({
    title: 'Triggers',
    description: 'Conditions that trigger ejection evaluation',
    type: 'object',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  triggers: PolicyTriggers;

  @JSONSchema({
    title: 'Actions',
    description: 'Actions to take when policy is triggered',
    type: 'object',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  actions: PolicyActions;

  @JSONSchema({
    title: 'Created By',
    description: 'ID of the admin who created this policy',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  createdBy: ID;

  @Type(() => Date)
  @JSONSchema({
    title: 'Created At',
    description: 'Timestamp when policy was created',
    type: 'string',
    format: 'date-time',
  })
  createdAt: Date;

  @Type(() => Date)
  @JSONSchema({
    title: 'Updated At',
    description: 'Timestamp when policy was last updated',
    type: 'string',
    format: 'date-time',
  })
  updatedAt: Date;

  @Type(() => Date)
  @IsOptional()
  @JSONSchema({
    title: 'Deleted At',
    description: 'Timestamp when policy was soft-deleted',
    type: 'string',
    format: 'date-time',
  })
  deletedAt?: Date;

  constructor(data: Partial<EjectionPolicy>) {
    Object.assign(this, data);
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }
}
