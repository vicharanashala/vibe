import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

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

  @IsOptional()
  @IsEnum(RuleTypeEnum)
  type?: RuleTypeEnum;

  @IsOptional()
  @IsNumber()
  @Min(1)
  value?: number;

  @IsOptional()
  @IsEnum(RewardApplyWhenEnum)
  applyWhen?: RewardApplyWhenEnum;

  @IsOptional()
  @IsEnum(LateBehaviorEnum)
  lateBehavior?: LateBehaviorEnum;
}

export class HpPenaltyRuleDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsEnum(RuleTypeEnum)
  type?: RuleTypeEnum;

  @IsOptional()
  @IsNumber()
  @Min(1)
  value?: number;

  @IsOptional()
  @IsEnum(PenaltyApplyWhenEnum)
  applyWhen?: PenaltyApplyWhenEnum;

  @IsOptional()
  @IsNumber()
  @Min(0)
  graceMinutes?: number;

  @IsOptional()
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

  @IsString()
  activityId!: string;

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
}