import { Expose, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEmail, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
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

    // @Expose()
    // @IsOptional()
    // @IsArray()
    // @ValidateNested({ each: true })
    // @Type(() => SubmissionFileDto)
    // @ArrayMaxSize(20)
    // files?: SubmissionFileDto[];

    // @Expose()
    // @IsOptional()
    // @IsArray()
    // @ValidateNested({ each: true })
    // @Type(() => SubmissionImageDto)
    // @ArrayMaxSize(20)
    // images?: SubmissionImageDto[];
}

export class CreateHpActivitySubmissionBodyDto {
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

    //   @Expose()
    //   @IsOptional()
    //   @IsString()
    //   studentId?: string;

    //   @Expose()
    //   @IsOptional()
    //   @IsEmail()
    //   studentEmail?: string;

    //   @Expose()
    //   @IsOptional()
    //   @IsString()
    //   studentName?: string;

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
    @IsIn(["APPROVE", "REJECT", "REVERT"])
    decision!: ReviewDecision;

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
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