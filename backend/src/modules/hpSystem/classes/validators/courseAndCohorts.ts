import { IsArray, IsNumber, IsOptional, IsString, ValidateNested, IsBoolean, Min, IsIn } from "class-validator";
import { Type } from "class-transformer";
import { ToNumber } from "../../utils/toNumber.js";

export class CourseVersionDto {

    @IsString()
    courseVersionId!: string;

    @IsString()
    versionName!: string;

    @IsNumber()
    totalCohorts!: number;

    @IsString() // ISO date string
    createdAt!: string;
}

export class CourseWithVersionsDto {

    @IsString()
    courseId!: string;

    @IsString()
    courseName!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CourseVersionDto)
    versions!: CourseVersionDto[];
}


export class CourseVersionListMetaDto {

    @IsNumber()
    totalCourses!: number;

    @IsNumber()
    totalVersions!: number;

    @IsNumber()
    page!: number;

    @IsNumber()
    limit!: number;

    @IsString()
    sortBy!: string;

    @IsString()
    sortOrder!: string;

    @IsOptional()
    @IsString()
    search?: string;
}


export class CourseVersionListResponseDto {

    @IsBoolean()
    success!: boolean;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CourseWithVersionsDto)
    data!: CourseWithVersionsDto[];

    @ValidateNested()
    @Type(() => CourseVersionListMetaDto)
    meta!: CourseVersionListMetaDto;
}


/* =========================================================
   Cohort Stats
========================================================= */

export class CohortStatsDto {
    @IsNumber()
    totalStudents!: number;

    @IsNumber()
    totalActivities!: number;

    @IsNumber()
    publishedActivities!: number;

    @IsNumber()
    draftActivities!: number;

    @IsNumber()
    totalHpDistributed!: number;

    @IsNumber()
    totalCredits!: number;

    @IsNumber()
    totalDebits!: number;

    @IsNumber()
    pendingApprovals!: number;

    @IsNumber()
    overdueActivities!: number;
}

/* =========================================================
   Cohort Item
========================================================= */

export class CohortListItemDto {
    // @IsString()
    // cohortId!: string;

    @IsString()
    cohortName!: string;

    @IsString()
    courseVersionId!: string;

    @ValidateNested()
    @Type(() => CohortStatsDto)
    stats!: CohortStatsDto;

    @IsString() // ISO date string
    lastActivityAt!: string;

    @IsString() // ISO date string
    createdAt!: string;
}

/* =========================================================
   Meta
========================================================= */

export class CohortListMetaDto {
    @IsNumber()
    totalRecords!: number;

    @IsNumber()
    totalPages!: number;

    @IsNumber()
    currentPage!: number;

    @IsNumber()
    limit!: number;

    @IsString()
    sortBy!: string;

    @IsString()
    sortOrder!: string;

    @IsOptional()
    @IsString()
    search?: string;
}

/* =========================================================
   Response Wrapper
========================================================= */

export class CohortListResponseDto {
    @IsBoolean()
    success!: boolean;

    @IsString()
    message!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CohortListItemDto)
    data!: CohortListItemDto[];

    @ValidateNested()
    @Type(() => CohortListMetaDto)
    meta!: CohortListMetaDto;
}



/* =========================================================
   CourseVersionListQuery (Validator DTO)
========================================================= */

export class CourseVersionListQueryDto {
    @IsOptional()
    @ToNumber()
    @IsNumber()
    @Min(1)
    page?: number;

    @IsOptional()
    @ToNumber()
    @IsNumber()
    @Min(1)
    limit?: number;

    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsString()
    @IsIn(["asc", "desc"])
    sortOrder?: "asc" | "desc";

    @IsOptional()
    @IsString()
    search?: string;
}

/* =========================================================
   CohortListQuery (Validator DTO)
========================================================= */

export class CohortListQueryDto {
    @IsOptional()
    @ToNumber()
    @IsNumber()
    @Min(1)
    page?: number;

    @IsOptional()
    @ToNumber()
    @IsNumber()
    @Min(1)
    limit?: number;

    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsString()
    @IsIn(["asc", "desc"])
    sortOrder?: "asc" | "desc";

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    courseVersionId?: string;
}