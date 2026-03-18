import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
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
  IsArray,
  IsDate,
} from 'class-validator';
import {
  PolicyScope,
  InactivityTrigger,
  MissedDeadlinesTrigger,
  PolicyViolationsTrigger,
  CustomTrigger,
} from '../../types.js';

// ============ Trigger Classes ============

export class InactivityTriggerDto implements InactivityTrigger {
  @Expose()
  @IsBoolean()
  enabled: boolean;

  @Expose()
  @IsNumber()
  @Min(1)
  thresholdDays: number;

  @Expose()
  @IsNumber()
  @Min(0)
  warningDays: number;
}

export class MissedDeadlinesTriggerDto implements MissedDeadlinesTrigger {
  @IsBoolean()
  @Expose()
  enabled: boolean;

  @IsNumber()
  @Expose()
  @Min(1)
  consecutiveMisses: number;

  @IsNumber()
  @Expose()
  @Min(0)
  warningAfterMisses: number;
}

class ViolationsDto {
  @IsArray()
  @IsString({each: true})
  @Expose()
  predefined: string[];

  @IsOptional()
  @IsArray()
  @IsString({each: true})
  @Expose()
  custom?: string[];
}

export class PolicyViolationsTriggerDto {
  @IsBoolean()
  @Expose()
  enabled: boolean;

  @ValidateNested()
  @Type(() => ViolationsDto)
  @Expose()
  violations: ViolationsDto;

  @IsNumber()
  @Expose()
  @Min(1)
  thresholdCount: number;
}

export class CustomTriggerDto implements CustomTrigger {
  @IsString()
  @Expose()
  type: string;

  @IsObject()
  @Expose()
  condition: Record<string, any>;

  @IsNumber()
  @Expose()
  threshold: number;
}
export class AnomalyDetectionTriggerDto {
  @IsBoolean()
  @Expose()
  enabled: boolean;

  @IsNumber()
  @Expose()
  @Min(0)
  thresholdScore: number;

  @IsOptional()
  @IsNumber()
  @Expose()
  @Min(0)
  warningScore?: number;
}

export class PolicyTriggersDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => InactivityTriggerDto)
  @Expose()
  inactivity?: InactivityTriggerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MissedDeadlinesTriggerDto)
  @Expose()
  missedDeadlines?: MissedDeadlinesTriggerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PolicyViolationsTriggerDto)
  @Expose()
  policyViolations?: PolicyViolationsTriggerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnomalyDetectionTriggerDto)
  @Expose()
  anomalyDetection?: AnomalyDetectionTriggerDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => CustomTriggerDto)
  @Expose()
  customTriggers?: CustomTriggerDto[];
}

export class PolicyActionsDto {
  @IsBoolean()
  @Expose()
  sendWarning: boolean;

  @IsOptional()
  @IsString()
  @Expose()
  warningTemplate?: string;

  @IsOptional()
  @IsString()
  @Expose()
  ejectionTemplate?: string;

  @IsBoolean()
  @Expose()
  allowAppeal: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Expose()
  appealDeadlineDays?: number;

  @IsOptional()
  @IsObject()
  @Expose()
  autoReinstatementRules?: Record<string, any>;
}

// ============ Request DTOs ============

export class CreateEjectionPolicyBody {
  @JSONSchema({
    description: 'Policy name',
    example: 'Standard Inactivity Policy',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @JSONSchema({
    description: 'Policy description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @JSONSchema({
    description: 'Policy scope',
    enum: ['platform', 'course'],
  })
  @IsNotEmpty()
  @IsEnum(['platform', 'course'])
  scope: PolicyScope;

  @JSONSchema({
    description: 'Course ID (required if scope is "course")',
  })
  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @JSONSchema({
    description: 'Course Version ID (required if scope is "course")',
  })
  @IsOptional()
  @IsMongoId()
  courseVersionId?: string;

  @JSONSchema({
    description: 'Priority level',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;

  @JSONSchema({
    description: 'Trigger configuration',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PolicyTriggersDto)
  triggers: PolicyTriggersDto;

  @JSONSchema({
    description: 'Action configuration',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PolicyActionsDto)
  actions: PolicyActionsDto;
}

export class UpdateEjectionPolicyBody {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PolicyTriggersDto)
  triggers?: PolicyTriggersDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PolicyActionsDto)
  actions?: PolicyActionsDto;
}

// ============ Params ============

export class PolicyIdParams {
  @JSONSchema({
    description: 'Policy ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  policyId: string;
}

export class CourseIdParams {
  @JSONSchema({
    description: 'Course ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;
}

export class CourseVersionParams {
  @JSONSchema({
    description: 'Course ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'Course Version ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseVersionId: string;
}

// ============ Query Params ============

export class GetPoliciesQuery {
  @IsOptional()
  @IsEnum(['platform', 'course'])
  scope?: PolicyScope;

  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsMongoId()
  courseVersionId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;
}

@Expose()
export class EjectionPolicyResponse {
  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({
    description: 'Policy ID',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @IsString()
  @Expose()
  @JSONSchema({
    description: 'Policy name',
    example: 'Platform Inactivity Policy',
  })
  name: string;

  @IsString()
  @IsOptional()
  @Expose()
  @JSONSchema({
    description: 'Policy description',
    example: 'Removes inactive users after 30 days',
  })
  description?: string;

  @IsString()
  @Expose()
  @JSONSchema({
    description: 'Policy scope',
    enum: ['platform', 'course'],
    example: 'platform',
  })
  scope: PolicyScope;

  @IsString()
  @IsOptional()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({
    description: 'Course ID (for course-specific policies)',
    example: '507f1f77bcf86cd799439011',
  })
  courseId?: string;

  @IsString()
  @IsOptional()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({
    description: 'Course Version ID (for course-specific policies)',
    example: '507f1f77bcf86cd799439011',
  })
  courseVersionId?: string;

  @IsBoolean()
  @Expose()
  @JSONSchema({
    description: 'Whether the policy is active',
    example: true,
  })
  isActive: boolean;

  @IsNumber()
  @Expose()
  @JSONSchema({
    description: 'Policy priority (higher = executed first)',
    example: 100,
  })
  priority: number;

  @ValidateNested()
  @Type(() => PolicyTriggersDto)
  @Expose()
  @JSONSchema({
    description: 'Policy triggers',
  })
  triggers: PolicyTriggersDto;

  @ValidateNested()
  @Type(() => PolicyActionsDto)
  @Expose()
  @JSONSchema({
    description: 'Policy actions',
  })
  actions: PolicyActionsDto;

  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({
    description: 'User ID who created the policy',
    example: '507f1f77bcf86cd799439011',
  })
  createdBy: string;

  @IsDate()
  @Type(() => Date)
  @Expose()
  @JSONSchema({
    description: 'Creation timestamp',
    example: '2026-03-14T08:00:00.000Z',
  })
  createdAt: Date;

  @IsDate()
  @Type(() => Date)
  @Expose()
  @JSONSchema({
    description: 'Last update timestamp',
    example: '2026-03-14T08:00:00.000Z',
  })
  updatedAt: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  @Expose()
  @JSONSchema({
    description: 'Deletion timestamp (if soft deleted)',
  })
  deletedAt?: Date;
}

@Expose()
export class PoliciesListResponse {
  @IsArray()
  @Expose()
  @ValidateNested({each: true})
  @Type(() => EjectionPolicyResponse)
  @JSONSchema({
    description: 'List of ejection policies',
  })
  policies: EjectionPolicyResponse[];

  @IsNumber()
  @Expose()
  @JSONSchema({
    description: 'Total number of policies',
  })
  total: number;

  @IsBoolean()
  @Expose()
  @JSONSchema({
    description: 'Tells if user is an admin',
  })
  isAdmin: boolean;
}

@Expose()
export class DeletePolicyResponse {
  @IsString()
  @Expose()
  @JSONSchema({
    description: 'Success message',
    example: 'Policy deleted successfully',
  })
  message: string;

  @IsString()
  @Expose()
  @JSONSchema({
    description: 'ID of the deleted policy',
    example: '507f1f77bcf86cd799439011',
  })
  policyId: string;
}
