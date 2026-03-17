

/* =========================================================
   4) hp_ledger Transformer
========================================================= */

import { Expose, Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { HpLedgerDirection, HpLedgerEventType, HpReasonCode, ID, RuleType, TriggeredBy } from "../../constants.js";
import { JSONSchema } from "class-validator-jsonschema";
import { ObjectIdArrayToStringArray, ObjectIdToString, StringArrayToObjectIdArray, StringToObjectId } from "#root/shared/index.js";

export class HpLedgerCalc {
    @Expose()
    @IsEnum(RuleType)
    @JSONSchema({ title: 'Rule Type', type: 'string', enum: Object.values(RuleType) })
    ruleType: RuleType;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Percentage', type: 'number', example: 20 })
    percentage: number;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Absolute Points', type: 'number', example: 10 })
    absolutePoints: number;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Base HP At Time', type: 'number', example: 120 })
    baseHpAtTime: number;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Computed Amount', type: 'number', example: 24 })
    computedAmount: number;

    @Expose()
    @Type(() => Date)
    @JSONSchema({ title: 'Deadline At', type: 'string', format: 'date-time' })
    deadlineAt: Date;

    @Expose()
    @IsBoolean()
    @JSONSchema({ title: 'Within Deadline', type: 'boolean', example: true })
    withinDeadline: boolean;

    @Expose()
    @IsEnum(HpReasonCode)
    @JSONSchema({
        title: 'Reason Code',
        type: 'string',
        enum: Object.values(HpReasonCode),
        example: 'SUBMISSION_REWARD',
    })
    reasonCode: HpReasonCode;
}

export class HpLedgerLinks {
    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Reversed Ledger ID', type: 'string' })
    reversedLedgerId: ID;

    @Expose()
    @Transform(ObjectIdArrayToStringArray.transformer, { toPlainOnly: true })
    @Transform(StringArrayToObjectIdArray.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Related Ledger IDs', type: 'array', items: { type: 'string' } })
    relatedLedgerIds: ID[];
}

export class HpLedgerMeta {
    @Expose()
    @IsEnum(TriggeredBy)
    @JSONSchema({
        title: 'Triggered By',
        type: 'string',
        enum: Object.values(TriggeredBy),
        example: 'SYSTEM',
    })
    triggeredBy: TriggeredBy;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Triggered By User ID', type: 'string' })
    triggeredByUserId: ID;

    @Expose()
    @IsOptional()
    @IsString()
    @JSONSchema({ title: 'Triggered By User Name', type: 'string' })
    triggeredByUserName?: string;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Note', type: 'string', example: 'Auto reward on submission' })
    note: string;
}

/**
 * hp_ledger data transformation.
 *
 * @category HP/Transformers
 */
export class HpLedgerTransformer {
    @Expose()
    @JSONSchema({ title: 'Ledger ID', type: 'string' })
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
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Cohort ID', type: 'string' })
    cohort: string;

    // Identity
    @Expose()
    @IsString()
    @JSONSchema({ title: 'Student ID', type: 'string' })
    studentId: string;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Student Email', type: 'string', example: 'student@mail.com' })
    studentEmail: string;

    // Context
    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Activity ID', type: 'string' })
    activityId: ID;

    @Expose()
    @IsOptional()
    @IsString()
    @JSONSchema({ title: 'Activity Title', type: 'string' })
    activityTitle?: string;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Submission ID', type: 'string' })
    submissionId: ID;

    // Event
    @Expose()
    @IsEnum(HpLedgerEventType)
    @JSONSchema({
        title: 'Event Type',
        type: 'string',
        enum: Object.values(HpLedgerEventType),
        example: 'CREDIT',
    })
    eventType: HpLedgerEventType;

    @Expose()
    @IsEnum(HpLedgerDirection)
    @JSONSchema({
        title: 'Direction',
        type: 'string',
        enum: Object.values(HpLedgerDirection),
        example: 'CREDIT',
    })
    direction: HpLedgerDirection;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Amount', type: 'number', example: 24 })
    amount: number;

    @Expose()
    @ValidateNested()
    @Type(() => HpLedgerCalc)
    @JSONSchema({ title: 'Calc', type: 'object' })
    calc: HpLedgerCalc;

    @Expose()
    @ValidateNested()
    @Type(() => HpLedgerLinks)
    @JSONSchema({ title: 'Links', type: 'object' })
    links: HpLedgerLinks;

    @Expose()
    @ValidateNested()
    @Type(() => HpLedgerMeta)
    @JSONSchema({ title: 'Meta', type: 'object' })
    meta: HpLedgerMeta;

    @Expose()
    @Type(() => Date)
    @JSONSchema({ title: 'Created At', type: 'string', format: 'date-time' })
    createdAt?: Date;

    constructor(body?: Partial<HpLedgerTransformer>) {
        if (body) Object.assign(this, body);
        this.calc = this.calc ?? ({} as HpLedgerCalc);
        this.links = this.links ?? ({} as HpLedgerLinks);
        this.meta = this.meta ?? ({} as HpLedgerMeta);
    }
}