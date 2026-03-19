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

  @IsEnum(RuleTypeEnum)
  type!: RuleTypeEnum;

  @IsNumber()
  value!: number;

  @IsEnum(RewardApplyWhenEnum)
  applyWhen!: RewardApplyWhenEnum;

  @IsBoolean()
  onlyWithinDeadline!: boolean;

  @IsBoolean()
  allowLate!: boolean;

  @IsEnum(LateBehaviorEnum)
  lateBehavior!: LateBehaviorEnum;

  @IsNumber()
  minHpFloor!: number;

  @IsNumber()
  @IsOptional()
  required_percentage?: number;
}

export class HpPenaltyRuleDto {
  @IsBoolean()
  enabled!: boolean;

  @IsEnum(RuleTypeEnum)
  type!: RuleTypeEnum;

  @IsNumber()
  value!: number;

  @IsEnum(PenaltyApplyWhenEnum)
  applyWhen!: PenaltyApplyWhenEnum;

  @IsNumber()
  @Min(0)
  graceMinutes!: number;

  @IsOptional()
  @IsBoolean()
  runOnce?: boolean;
}

export class HpRuleLimitsDto {
  @IsOptional()
  @IsNumber()
  minHp?: number;

  @IsOptional()
  @IsNumber()
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

  @IsDateString()
  deadlineAt!: string;

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