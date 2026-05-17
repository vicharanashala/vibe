import { IsArray, IsNumber, IsOptional, IsString, ValidateNested, IsBoolean, Min, IsIn, IsEmail, IsInt, IsNotEmpty } from "class-validator";
import { Expose, Type } from "class-transformer";
import { ToNumber } from "../../utils/toNumber.js";
import { statusFilter } from "../../models.js";
import { JSONSchema } from "class-validator-jsonschema";
import { HpResetMode } from '../../models.js';

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
    @IsString()
    cohortId!: string;

    @IsString()
    cohortName!: string;

    @IsString()
    courseId!: string;

    @IsString()
    courseVersionId!: string;

    @ValidateNested()
    @Type(() => CohortStatsDto)
    stats!: CohortStatsDto;

    @IsString() // ISO date string
    lastActivityAt!: string;

    @IsString() // ISO date string
    createdAt!: string;

    @IsNumber()
    percentCompleted?: number;
    // @IsBoolean()
    // isPublic!: boolean;
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



export class CohortStudentItemDto {
    @Expose()
    @IsString()
    _id!: string;

    @Expose()
    @IsString()
    enrollmentId!: string;

    @Expose()
    @IsString()
    name!: string;

    @Expose()
    @IsEmail()
    email!: string;

    @Expose()
    @IsInt()
    @Min(0)
    totalHp!: number;

    @Expose()
    @IsInt()
    @Min(0)
    completionPercentage!: number;

    @Expose()
    @IsOptional()
    @IsBoolean()
    isSafe?:boolean;
}

export class CohortStudentsResponseDto {
    @Expose()
    @IsBoolean()
    success!: boolean;

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CohortStudentItemDto)
    data!: CohortStudentItemDto[];
}



export class CohortStudentsListQueryDto {
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
    @IsIn(["ALL", "SAFE", "UNSAFE"])
    status?: statusFilter;
}


export class ResetHpRequest {
    @IsNumber()
    @Min(0)
    targetHp: number;
    
    @IsIn(['ALL', 'ONLY_ZERO_HP', 'ONLY_WITH_HP'])
    mode: HpResetMode;
}

export class ResetRequestParams {
    @JSONSchema({
        description: 'Course version id',
        example: '69bed49fc461e665a086938c',
        type: 'string',
    })
    @IsString()
    @IsNotEmpty()
    versionId: string;

    @JSONSchema({
        description: 'Name of the cohort',
        example: 'Krushkalians',
        type: 'string',
    })
    @IsString()
    @IsNotEmpty()
    cohortName: string;
}

export class ResetStudentRequestParams {
    @JSONSchema({
        description: 'Course version id',
        example: '69bed49fc461e665a086938c',
        type: 'string',
    })
    @IsString()
    @IsNotEmpty()
    versionId: string;

    @JSONSchema({
        description: 'Name of the cohort',
        example: 'Krushkalians',
        type: 'string',
    })
    @IsString()
    @IsNotEmpty()
    cohortName: string;

    @JSONSchema({
        description: 'Id of student',
        example: '69d389b65670ad9fcd11df17',
        type: 'string',
    })
    @IsString()
    @IsNotEmpty()
    studentId: string;
}

export class ResetStudentHpRequest {
    @IsNumber()
    @Min(0)
    targetHp: number;
}