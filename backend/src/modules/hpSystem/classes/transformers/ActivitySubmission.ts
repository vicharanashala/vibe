import { ObjectIdArrayToStringArray, ObjectIdToString, StringArrayToObjectIdArray, StringToObjectId } from "#root/shared/index.js";
import { Expose, Transform, Type } from "class-transformer";
import { JSONSchema } from "class-validator-jsonschema";
import { ID, ReviewDecision, SubmissionSource, SubmissionStatus } from "../../constants.js";
import { IsArray, IsBoolean, IsEnum, IsNumber, IsString, ValidateNested } from "class-validator";



export class HpSubmissionLink {
    @Expose()
    @IsString()
    @JSONSchema({ title: 'Link URL', type: 'string', example: 'https://example.com' })
    url: string;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Link Label', type: 'string', example: 'PR Link' })
    label: string;
}

export class HpSubmissionFile {
    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({
        title: 'File ID',
        type: 'string',
        example: '60d5ec49b3f1c8e4a8f8b8c1',
    })
    fileId: ID;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'File URL', type: 'string', example: 'https://cdn/file.pdf' })
    url: string;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'File Name', type: 'string', example: 'proof.pdf' })
    name: string;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Mime Type', type: 'string', example: 'application/pdf' })
    mimeType: string;

    @Expose()
    @IsNumber()
    @JSONSchema({ title: 'Size (bytes)', type: 'number', example: 1024 })
    sizeBytes: number;
}

export class HpSubmissionImage {
    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({
        title: 'Image File ID',
        type: 'string',
        example: '60d5ec49b3f1c8e4a8f8b8c1',
    })
    fileId: ID;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Image URL', type: 'string', example: 'https://cdn/image.png' })
    url: string;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Image Name', type: 'string', example: 'screenshot.png' })
    name: string;
}

export class HpSubmissionPayload {
    @Expose()
    @IsString()
    @JSONSchema({ title: 'Text Response', type: 'string', example: 'My submission details' })
    textResponse: string;

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HpSubmissionLink)
    @JSONSchema({
        title: 'Links',
        type: 'array',
        items: { type: 'object' },
        example: [{ url: 'https://example.com', label: 'PR' }],
    })
    links: HpSubmissionLink[];

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HpSubmissionFile)
    @JSONSchema({
        title: 'Files',
        type: 'array',
        items: { type: 'object' },
    })
    files: HpSubmissionFile[];

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HpSubmissionImage)
    @JSONSchema({
        title: 'Images',
        type: 'array',
        items: { type: 'object' },
    })
    images: HpSubmissionImage[];
}


export class SubmissionFeedbackItem {
    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({
        title: 'Teacher ID',
        type: 'string',
        example: '60d5ec49b3f1c8e4a8f8b8c1',
    })
    teacherId: ID;

    @Expose()
    @Type(() => Date)
    @JSONSchema({
        title: 'Feedback At',
        type: 'string',
        format: 'date-time',
        example: '2026-02-28T10:00:00Z',
    })
    feedbackAt: Date;

    @Expose()
    @IsString()
    @JSONSchema({
        title: 'Feedback',
        type: 'string',
        example: 'Please improve the explanation and resubmit.',
    })
    feedback: string;
}

export class HpSubmissionReview {
    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({
        title: 'Reviewed By Teacher ID',
        type: 'string',
        example: '60d5ec49b3f1c8e4a8f8b8c1',
    })
    reviewedByTeacherId: ID;

    @Expose()
    @Type(() => Date)
    @JSONSchema({
        title: 'Reviewed At',
        type: 'string',
        format: 'date-time',
        example: '2026-02-28T10:00:00Z',
    })
    reviewedAt: Date;

    @Expose()
    @IsEnum(ReviewDecision)
    @JSONSchema({
        title: 'Decision',
        type: 'string',
        example: 'APPROVED',
        enum: Object.values(ReviewDecision),
    })
    decision: ReviewDecision;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Note', type: 'string', example: 'Looks valid' })
    note: string;
}

export class HpSubmissionLedgerRefs {
    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Reward Ledger ID', type: 'string' })
    rewardLedgerId: ID;

    @Expose()
    @Transform(ObjectIdArrayToStringArray.transformer, { toPlainOnly: true })
    @Transform(StringArrayToObjectIdArray.transformer, { toClassOnly: true })
    @JSONSchema({
        title: 'Revert Ledger IDs',
        type: 'array',
        items: { type: 'string' },
    })
    revertLedgerIds: ID[];

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Penalty Ledger ID', type: 'string' })
    penaltyLedgerId: ID;
}


/**
 * hp_activity_submissions data transformation.
 *
 * @category HP/Transformers
 */
export class HpActivitySubmission {
    @Expose()
    @JSONSchema({
        title: 'Submission ID',
        description: 'Unique identifier for the submission',
        example: '60d5ec49b3f1c8e4a8f8b8c1',
        type: 'string',
    })
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
    cohortId: ID;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Cohort', type: 'string', example: 'JAN-2026' })
    cohort: string;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Activity ID', type: 'string' })
    activityId: ID;

    // Identity
    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    @JSONSchema({ title: 'Student ID', type: 'string' })
    studentId: ID;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Student Email', type: 'string', example: 'student@mail.com' })
    studentEmail: string;

    @Expose()
    @IsString()
    @JSONSchema({ title: 'Student Name', type: 'string', example: 'Abi' })
    studentName: string;

    // Submission content
    @Expose()
    @IsEnum(SubmissionStatus)
    @JSONSchema({
        title: 'Status',
        type: 'string',
        enum: Object.values(SubmissionStatus),
        example: 'SUBMITTED',
    })
    status: SubmissionStatus;

    @Expose()
    @Type(() => Date)
    @JSONSchema({
        title: 'Submitted At',
        type: 'string',
        format: 'date-time',
        example: '2026-02-28T10:00:00Z',
    })
    submittedAt: Date;

    @Expose()
    @ValidateNested()
    @Type(() => HpSubmissionPayload)
    @JSONSchema({ title: 'Payload', type: 'object' })
    payload: HpSubmissionPayload;

    // Teacher review / revert
    @Expose()
    @ValidateNested()
    @Type(() => HpSubmissionReview)
    @JSONSchema({ title: 'Review', type: 'object' })
    review: HpSubmissionReview;

    // Ledger linkage
    @Expose()
    @ValidateNested()
    @Type(() => HpSubmissionLedgerRefs)
    @JSONSchema({ title: 'Ledger References', type: 'object' })
    ledgerRefs: HpSubmissionLedgerRefs;


    @Expose()
    @Type(() => SubmissionFeedbackItem)
    @ValidateNested({ each: true })
    @IsArray()
    @JSONSchema({
        title: 'Feedbacks',
        type: 'array',
        items: {
            $ref: '#/components/schemas/SubmissionFeedbackItem',
        },
    })
    feedbacks: SubmissionFeedbackItem[];

    // Useful flags
    @Expose()
    @IsBoolean()
    @JSONSchema({ title: 'Is Late', type: 'boolean', example: false })
    isLate: boolean;

    @Expose()
    @IsEnum(SubmissionSource)
    @JSONSchema({
        title: 'Submission Source',
        type: 'string',
        enum: Object.values(SubmissionSource),
        example: 'IN_PLATFORM',
    })
    submissionSource: SubmissionSource;

    @Expose()
    @Type(() => Date)
    @JSONSchema({ title: 'Created At', type: 'string', format: 'date-time' })
    createdAt?: Date;

    @Expose()
    @Type(() => Date)
    @JSONSchema({ title: 'Updated At', type: 'string', format: 'date-time' })
    updatedAt?: Date;

    constructor(body?: Partial<HpActivitySubmission>) {
        if (body) Object.assign(this, body);

        this.payload = this.payload ?? ({ links: [], files: [], images: [] } as HpSubmissionPayload);
        this.ledgerRefs = this.ledgerRefs ?? {} as HpSubmissionLedgerRefs;
        this.review = this.review ?? {} as HpSubmissionReview;
        this.feedbacks = this.feedbacks ?? [] as SubmissionFeedbackItem[]
    }
}