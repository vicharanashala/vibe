import { IsArray, IsBoolean, IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { ActivityStatus, ActivityType, AttachmentKind, SubmissionMode } from "../../models.js";
import { Type } from "class-transformer";
import { CreateHpRuleConfigBody } from "./ruleConfigValidators.js";

export class AttachmentDto {
    @IsString()
    name!: string;

    @IsString()
    url!: string;

    @IsEnum(["PDF", "LINK", "OTHER"])
    kind!: AttachmentKind;
}

export class CreateActivityBody {
    // Scoping
    @IsString()
    courseVersionId!: string;

    @IsString()
    courseId!: string;

    @IsMongoId()
    cohortId!: string;

    // Content
    @IsString()
    title!: string;

    @IsString()
    description!: string;

    @IsEnum(["ASSIGNMENT", "MILESTONE", "EXTERNAL_IMPORT", "VIBE_MILESTONE", "OTHER"])
    activityType!: ActivityType;

    @IsEnum(["DRAFT", "PUBLISHED", "ARCHIVED"])
    status!: ActivityStatus

    // Timing
    @IsOptional()
    @IsDateString()
    deadlineAt?: string; // ISO

    @IsBoolean()
    allowLateSubmission!: boolean;


    // Submission mode
    @IsEnum(["IN_PLATFORM", "EXTERNAL_LINK"])
    submissionMode!: SubmissionMode;

    @IsOptional()
    @IsString()
    externalLink?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttachmentDto)
    attachments?: AttachmentDto[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    required_percentage?: number;
}

export class CreateActivityWithRuleBody{
    @ValidateNested()
    @Type(() => CreateActivityBody)
    activity!: CreateActivityBody;

    @ValidateNested()
    @Type(() => CreateHpRuleConfigBody)
    ruleConfig!: CreateHpRuleConfigBody;
}

export class UpdateActivityBody {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(["ASSIGNMENT", "MILESTONE", "EXTERNAL_IMPORT", "VIBE_MILESTONE", "OTHER"])
    activityType?: ActivityType;

    @IsOptional()
    @IsDateString()
    deadlineAt?: string;

    @IsOptional()
    @IsBoolean()
    allowLateSubmission?: boolean;

    @IsOptional()

    @IsOptional()
    @IsEnum(["IN_PLATFORM", "EXTERNAL_LINK"])
    submissionMode?: SubmissionMode;

    @IsOptional()
    @IsString()
    externalLink?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttachmentDto)
    attachments?: AttachmentDto[];

    @IsOptional()
    @IsString()
    ruleConfigId?: string;

    @IsOptional()
    @IsBoolean()
    isMandatory?: boolean;

    @IsOptional()
    @IsMongoId()
    cohortId?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    required_percentage?: number;
}


export class ListActivitiesQuery {
    @IsOptional()
    @IsMongoId({ message: "courseId must be a valid MongoDB ObjectId" })
    courseId?: string;

    @IsOptional()
    @IsMongoId({ message: "courseVersionId must be a valid MongoDB ObjectId" })
    courseVersionId?: string;

    @IsOptional()
    @IsMongoId({ message: "cohortId must be a valid MongoDB ObjectId" })
    cohortId?: string;

    @IsOptional()
    @IsEnum(["DRAFT", "PUBLISHED", "ARCHIVED"], {
        message: "status must be one of DRAFT, PUBLISHED, ARCHIVED",
    })
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";

    @IsOptional()
    @IsEnum(["ASSIGNMENT", "MILESTONE", "EXTERNAL_IMPORT", "VIBE_MILESTONE", "OTHER"], {
        message: "activityType must be one of ASSIGNMENT, MILESTONE, EXTERNAL_IMPORT, VIBE_MILESTONE, OTHER ",
    })
    activityType?: | "ASSIGNMENT"
        | "MILESTONE"
        | "EXTERNAL_IMPORT"
        | "VIBE_MILESTONE"
        | "OTHER";

    @IsOptional()
    @IsMongoId({ message: "createdByTeacherId must be a valid MongoDB ObjectId" })
    createdByTeacherId?: string;

    @IsOptional()
    @IsString({ message: "search must be a string" })
    search?: string;

    @IsOptional()
    @IsString({ message: "activity must be a string" })
    activity?: string;
}