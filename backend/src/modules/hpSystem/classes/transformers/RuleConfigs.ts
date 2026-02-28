
/* =========================================================
   3) hp_rule_configs Transformer
========================================================= */

import { Expose, Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsString, ValidateNested } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";
import { HpRuleStatus, LateBehavior, PenaltyApplyWhen, RewardApplyWhen, RuleType } from "../../constants.js";
import { ID, ObjectIdToString, StringToObjectId } from "#root/shared/index.js";

export class HpRewardRule {
    @Expose()
    @IsBoolean()
    @JSONSchema({ title: 'Reward Enabled', type: 'boolean', example: true })
    enabled: boolean;

    @Expose()
    @IsEnum(RuleType)
    @JSONSchema({ title: 'Reward Type', type: 'string', enum: Object.values(RuleType) })
    type: RuleType;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Reward Value', type: 'number', example: 10 })
    value: number;

    @Expose()
    @IsEnum(RewardApplyWhen)
    @JSONSchema({
        title: 'Reward Apply When',
        type: 'string',
        enum: Object.values(RewardApplyWhen),
        example: 'ON_SUBMISSION',
    })
    applyWhen: RewardApplyWhen;

    @Expose()
    @IsBoolean()
    @JSONSchema({ title: 'Only Within Deadline', type: 'boolean', example: true })
    onlyWithinDeadline: boolean;

    @Expose()
    @IsBoolean()
    @JSONSchema({ title: 'Allow Late', type: 'boolean', example: false })
    allowLate: boolean;

    @Expose()
    @IsEnum(LateBehavior)
    @JSONSchema({
        title: 'Late Behavior',
        type: 'string',
        enum: Object.values(LateBehavior),
        example: 'NO_REWARD',
    })
    lateBehavior: LateBehavior;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Min HP Floor', type: 'number', example: 0 })
    minHpFloor: number;
}

export class HpPenaltyRule {
    @Expose()
    @IsBoolean()
    @JSONSchema({ title: 'Penalty Enabled', type: 'boolean', example: true })
    enabled: boolean;

    @Expose()
    @IsEnum(RuleType)
    @JSONSchema({ title: 'Penalty Type', type: 'string', enum: Object.values(RuleType) })
    type: RuleType;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Penalty Value', type: 'number', example: 10 })
    value: number;

    @Expose()
    @IsEnum(PenaltyApplyWhen)
    @JSONSchema({
        title: 'Penalty Apply When',
        type: 'string',
        enum: Object.values(PenaltyApplyWhen),
        example: 'AFTER_DEADLINE',
    })
    applyWhen: PenaltyApplyWhen;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Grace Minutes', type: 'number', example: 0 })
    graceMinutes: number;

    @Expose()
    @IsBoolean()
    @JSONSchema({ title: 'Run Once', type: 'boolean', example: true })
    runOnce: boolean;
}

export class HpRuleLimits {
    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Min HP', type: 'number', example: 0 })
    minHp: number;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Max HP', type: 'number', example: 100000 })
    maxHp: number;
}

/**
 * hp_rule_configs data transformation.
 *
 * @category HP/Transformers
 */
export class HpRuleConfig {
    @Expose()
    @JSONSchema({ title: 'Rule Config ID', type: 'string' })
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    _id?: ID;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Course ID', type: 'string' })
    courseId: ID;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Course Version ID', type: 'string' })
    courseVersionId: ID;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Cohort', type: 'string', example: 'JAN-2026' })
    cohort: string;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Rule Name', type: 'string', example: 'Assignment Mandatory +10' })
    name: string;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Created By Teacher ID', type: 'string' })
    createdByTeacherId: ID;

    @Expose()
    @IsBoolean()
    @JSONSchema({ title: 'Is Mandatory', type: 'boolean', example: true })
    isMandatory: boolean;

    @Expose()
    @ValidateNested()
    @Type(() => HpRewardRule)
    @JSONSchema({ title: 'Reward Rule', type: 'object' })
    reward: HpRewardRule;

    @Expose()
    @ValidateNested()
    @Type(() => HpPenaltyRule)
    @JSONSchema({ title: 'Penalty Rule', type: 'object' })
    penalty: HpPenaltyRule;

    @Expose()
    @ValidateNested()
    @Type(() => HpRuleLimits)
    @JSONSchema({ title: 'Limits', type: 'object' })
    limits: HpRuleLimits;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Version', type: 'number', example: 1 })
    version: number;

    @Expose()
    @IsEnum(HpRuleStatus)
    @JSONSchema({
        title: 'Status',
        type: 'string',
        enum: Object.values(HpRuleStatus),
        example: 'ACTIVE',
    })
    status: HpRuleStatus;

    @Expose()
    @Type(() => Date)
    @JSONSchema({ title: 'Created At', type: 'string', format: 'date-time' })
    createdAt?: Date;

    @Expose()
    @Type(() => Date)
    @JSONSchema({ title: 'Updated At', type: 'string', format: 'date-time' })
    updatedAt?: Date;

    constructor(body?: Partial<HpRuleConfig>) {
        if (body) Object.assign(this, body);
        this.reward = this.reward ?? ({} as any);
        this.penalty = this.penalty ?? ({} as any);
        this.limits = this.limits ?? ({} as any);
    }
}