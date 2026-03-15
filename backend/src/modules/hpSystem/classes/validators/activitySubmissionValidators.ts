import { Expose, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { ReviewDecision, SubmissionSource, SubmissionStatus } from "../../constants.js";
import { ToNumber } from "../../utils/toNumber.js";

export class SubmissionLinkDto {
    @Expose()
    @IsString()
    @IsNotEmpty()
    url!: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    label!: string;
}

export class SubmissionFileDto {
    @Expose()
    @IsString()
    @IsNotEmpty()
    fileId!: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    url!: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    name!: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    mimeType!: string;

    @Expose()
    @IsOptional()
    sizeBytes?: number;
}

export class SubmissionImageDto {
    @Expose()
    @IsString()
    @IsNotEmpty()
    fileId!: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    url!: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    name!: string;
}

export class SubmissionPayloadDto {
    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    textResponse?: string;

    @Expose()
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SubmissionLinkDto)
    @ArrayMaxSize(20)
    links?: SubmissionLinkDto[];
}

export class CreateOrUpdateHpActivitySubmissionBodyDto {
    @Expose()
    @IsString()
    @IsNotEmpty()
    courseId!: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    courseVersionId!: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    cohort!: string;

    @Expose()
    @IsString()
    @IsNotEmpty()
    activityId!: string;

    @Expose()
    @ValidateNested()
    @Type(() => SubmissionPayloadDto)
    payload!: SubmissionPayloadDto;

    @Expose()
    @IsOptional()
    @IsEnum(["CSV_IMPORT", "IN_PLATFORM", "VIBE_AUTO"])
    submissionSource?: SubmissionSource;
}


export class ReviewHpActivitySubmissionBodyDto {
    @Expose()
    @IsString()
    @IsIn(["APPROVED", "REJECTED", "REVERTED"])
    decision!: ReviewDecision;

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;

    @Expose()
    @IsOptional()
    @IsNumber()
    pointsToDeduct: number;
}

export class SubmissionFeedbackDto {
    @Expose()
    @IsString()
    feedback!: string;
}

export class SubmissionFeedbackBody {
    @Expose()
    @IsString()
    @MaxLength(1000)
    feedback: string;
}

export class ListSubmissionsQueryDto {
    @Expose()
    @IsOptional()
    @ToNumber()
    @IsNumber()
    @Min(1)
    page?: number;

    @Expose()
    @IsOptional()
    @ToNumber()
    @IsNumber()
    @Min(1)
    limit?: number;

    @Expose()
    @IsOptional()
    @IsString()
    search?: string;

    @Expose()
    @IsOptional()
    @IsString()
    courseVersionId?: string;

    @Expose()
    @IsOptional()
    @IsString()
    cohort?: string;

    @Expose()
    @IsOptional()
    @IsString()
    activityId?: string;

    @Expose()
    @IsOptional()
    @IsString()
    @IsIn(["SUBMITTED", "APPROVED", "REJECTED", "REVERTED"])
    status?: SubmissionStatus;

    @Expose()
    @IsOptional()
    @IsString()
    sortBy?: string;

    @Expose()
    @IsOptional()
    @IsString()
    @IsIn(["asc", "desc"])
    sortOrder?: "asc" | "desc";
}



export class FilterQueryDto {
    @Expose()
    @IsOptional()
    @ToNumber()
    @IsNumber()
    @Min(1)
    page?: number;

    @Expose()
    @IsOptional()
    @ToNumber()
    @IsNumber()
    @Min(1)
    limit?: number;

    @Expose()
    @IsOptional()
    @IsString()
    search?: string;

    @Expose()
    @IsOptional()
    @IsString()
    sortBy?: string;

    @Expose()
    @IsOptional()
    @IsString()
    @IsIn(["asc", "desc"])
    sortOrder?: "asc" | "desc";
}



export class StudentSubmissionActivityDto {
    @Expose()
    @IsString()
    id!: string;

    @Expose()
    @IsString()
    title!: string;

    @Expose()
    @IsString()
    description!: string;

    @Expose()
    @IsString()
    activityType!: string;
}

export class SubmissionAttachmentsDto {
    @Expose()
    @IsString()
    textResponse!: string;

    @Expose()
    @Type(() => SubmissionLinkDto)
    @IsArray()
    links!: SubmissionLinkDto[];

    @Expose()
    @Type(() => SubmissionFileDto)
    @IsArray()
    files!: SubmissionFileDto[];

    @Expose()
    @Type(() => SubmissionFileDto)
    @IsArray()
    images!: SubmissionFileDto[];
}

export class StudentSubmissionDto {
    @Expose()
    @IsString()
    _id!: string;

    @Expose()
    @IsString()
    status!: string;

    @Expose()
    @IsOptional()
    @IsDateString()
    submittedAt!: Date | null;

    @Expose()
    @IsBoolean()
    isLate!: boolean;

    @Expose()
    @Type(() => SubmissionAttachmentsDto)
    attachments!: SubmissionAttachmentsDto;
}

export class SubmissionHpDto {
    @Expose()
    @IsNumber()
    baseHp!: number;

    @Expose()
    @IsNumber()
    currentHp!: number;
}

export class InstructorFeedbackDto {
    @Expose()
    @IsString()
    reviewedBy!: string;

    @Expose()
    @IsOptional()
    @IsEmail()
    reviewerEmail?: string | null;

    @Expose()
    @IsOptional()
    @IsString()
    reviewerName?: string | null;

    @Expose()
    @IsDateString()
    reviewedAt!: Date;

    @Expose()
    @IsString()
    decision!: string;

    @Expose()
    @IsString()
    note!: string;
}

export class StudentActivitySubmissionsViewDto {

    @Expose()
    @Type(() => StudentSubmissionActivityDto)
    activity!: StudentSubmissionActivityDto;

    @Expose()
    @IsDateString()
    deadline!: Date;

    @Expose()
    @Type(() => StudentSubmissionDto)
    submission!: StudentSubmissionDto;

    @Expose()
    @Type(() => SubmissionHpDto)
    hp!: SubmissionHpDto;

    @Expose()
    @IsOptional()
    @Type(() => InstructorFeedbackDto)
    instructorFeedback!: InstructorFeedbackDto | null;

    @Expose()
    @IsOptional()
    @Type(() => SubmissionFeedbackDto)
    @IsArray()
    feedbacks!: SubmissionFeedbackDto[];

    @Expose()
    @IsString()
    isRequiredInstructorApproval!: boolean;
}

export class PaginationMetaDto {
    @Expose()
    @IsNumber()
    total!: number;

    @Expose()
    @IsNumber()
    page!: number;

    @Expose()
    @IsNumber()
    limit!: number;
}

export class StudentActivitySubmissionsResponseDto {

    @Expose()
    @IsBoolean()
    success!: boolean;

    @Expose()
    @Type(() => StudentActivitySubmissionsViewDto)
    @IsArray()
    data!: StudentActivitySubmissionsViewDto[];

    @Expose()
    @Type(() => PaginationMetaDto)
    @IsOptional()
    meta?: PaginationMetaDto;
}


export class StudentActivitySubmissionStatsViewDto {
    @Expose()
    @IsNumber()
    totalActivities!: number;
    @Expose()
    @IsNumber()
    totalSubmissions!: number;
    @Expose()
    @IsNumber()
    totalPendings!: number;
    @Expose()
    @IsNumber()
    totalLateSubmissions!: number;
    @Expose()
    @IsNumber()
    currentHp!: number;
}

export class StudentActivitySubmissionStatsResponseDto {

    @Expose()
    @IsBoolean()
    success!: boolean;

    @Expose()
    data!: StudentActivitySubmissionStatsViewDto
}