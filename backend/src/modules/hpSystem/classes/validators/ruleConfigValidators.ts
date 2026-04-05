import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ValidateIf
} from "class-validator";
import { Type } from "class-transformer";
import { SubmissionField } from "../../models.js";

/* ===== Enums (same values as your types) ===== */

export enum RuleTypeEnum {
  ABSOLUTE = "ABSOLUTE",
  PERCENTAGE = "PERCENTAGE",
}

export enum RewardApplyWhenEnum {
  ON_SUBMISSION = "ON_SUBMISSION",
  ON_APPROVAL = "ON_APPROVAL",
  ON_MILESTONE_COMPLETION = "ON_MILESTONE_COMPLETION",
}

export enum LateBehaviorEnum {
  NO_REWARD = "NO_REWARD",
  REWARD = "REWARD",
}

export enum PenaltyApplyWhenEnum {
  AFTER_DEADLINE = "AFTER_DEADLINE",
}


/* ===== Nested DTOs ===== */

export class HpRewardRuleDto {
  @IsBoolean()
  enabled!: boolean;

  @ValidateIf(o => o.enabled)
  @IsEnum(RuleTypeEnum)
  type?: RuleTypeEnum;

  @ValidateIf(o => o.enabled)
  @IsNumber()
  @Min(1)
  value?: number;

  @ValidateIf(o => o.enabled)
  @IsEnum(RewardApplyWhenEnum)
  applyWhen?: RewardApplyWhenEnum;

  @ValidateIf(o => o.enabled)
  @IsEnum(LateBehaviorEnum)
  lateBehavior?: LateBehaviorEnum;
}

export class HpPenaltyRuleDto {
  @IsBoolean()
  enabled!: boolean;

  @ValidateIf(o => o.enabled)
  @IsEnum(RuleTypeEnum)
  type?: RuleTypeEnum;

  @ValidateIf(o => o.enabled)
  @IsNumber()
  @Min(1)
  value?: number;

  @ValidateIf(o => o.enabled)
  @IsEnum(PenaltyApplyWhenEnum)
  applyWhen?: PenaltyApplyWhenEnum;

  @ValidateIf(o => o.enabled)
  @IsNumber()
  @Min(0)
  graceMinutes?: number;

  @ValidateIf(o => o.enabled)
  @IsBoolean()
  runOnce?: boolean;
}

export class HpRuleLimitsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  minHp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxHp?: number;
}

/* ===== Create Body ===== */

export class CreateHpRuleConfigBody {
  @IsString()
  courseId!: string;

  @IsString()
  courseVersionId!: string;

  @IsOptional()
  @IsString()
  activityId?: string;

  @IsBoolean()
  isMandatory!: boolean;

  @IsOptional()
  @IsDateString()
  deadlineAt?: string;

  @IsBoolean()
  allowLateSubmission!: boolean;


  @ValidateNested()
  @Type(() => HpRewardRuleDto)
  reward!: HpRewardRuleDto;

  @ValidateNested()
  @Type(() => HpPenaltyRuleDto)
  penalty!: HpPenaltyRuleDto;

  @ValidateNested()
  @Type(() => HpRuleLimitsDto)
  limits!: HpRuleLimitsDto;

  @IsArray()
  @IsEnum(SubmissionField, { each: true })
  submissionValidation!: SubmissionField[];
}

/* ===== Update Body (partial) ===== */

export class UpdateHpRuleConfigBody {

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsDateString()
  deadlineAt?: string;

  @IsOptional()
  @IsBoolean()
  allowLateSubmission?: boolean;


  @IsOptional()
  @ValidateNested()
  @Type(() => HpRewardRuleDto)
  reward?: HpRewardRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HpPenaltyRuleDto)
  penalty?: HpPenaltyRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HpRuleLimitsDto)
  limits?: HpRuleLimitsDto;
  
  @IsArray()
  @IsEnum(SubmissionField, { each: true })
  submissionValidation!: SubmissionField[];
}