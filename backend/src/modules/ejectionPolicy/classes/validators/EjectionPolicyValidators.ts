import 'reflect-metadata';
import {Expose, Type} from 'class-transformer';
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
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  @Min(1)
  thresholdDays: number;

  @IsNumber()
  @Min(0)
  warningDays: number;
}

export class MissedDeadlinesTriggerDto implements MissedDeadlinesTrigger {
  @IsBoolean()
  enabled: boolean;

  @IsNumber()
  @Min(1)
  consecutiveMisses: number;

  @IsNumber()
  @Min(0)
  warningAfterMisses: number;
}

export class PolicyViolationsTriggerDto implements PolicyViolationsTrigger {
  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @IsString({each: true})
  violationTypes: string[];

  @IsNumber()
  @Min(1)
  thresholdCount: number;
}

export class CustomTriggerDto implements CustomTrigger {
  @IsString()
  type: string;

  @IsObject()
  condition: Record<string, any>;

  @IsNumber()
  threshold: number;
}

export class PolicyTriggersDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => InactivityTriggerDto)
  inactivity?: InactivityTriggerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MissedDeadlinesTriggerDto)
  missedDeadlines?: MissedDeadlinesTriggerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PolicyViolationsTriggerDto)
  policyViolations?: PolicyViolationsTriggerDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => CustomTriggerDto)
  customTriggers?: CustomTriggerDto[];
}

export class PolicyActionsDto {
  @IsBoolean()
  sendWarning: boolean;

  @IsOptional()
  @IsString()
  warningTemplate?: string;

  @IsOptional()
  @IsString()
  ejectionTemplate?: string;

  @IsBoolean()
  allowAppeal: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  appealDeadlineDays?: number;

  @IsOptional()
  @IsObject()
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

// ============ Query Params ============

export class GetPoliciesQuery {
  @IsOptional()
  @IsEnum(['platform', 'course'])
  scope?: PolicyScope;

  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;
}

// ============ Response DTOs ============

@Expose()
export class EjectionPolicyResponse {
  @IsString()
  @Expose()
  _id: string;

  @IsString()
  @Expose()
  name: string;

  @IsOptional()
  @IsString()
  @Expose()
  description?: string;

  @IsString()
  @Expose()
  scope: PolicyScope;

  @IsOptional()
  @IsString()
  @Expose()
  courseId?: string;

  @IsBoolean()
  @Expose()
  isActive: boolean;

  @IsNumber()
  @Expose()
  priority: number;

  @IsObject()
  @Expose()
  triggers: any;

  @IsObject()
  @Expose()
  actions: any;

  @IsString()
  @Expose()
  createdBy: string;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;
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
}
