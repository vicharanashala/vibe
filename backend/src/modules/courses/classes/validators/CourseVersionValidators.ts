import { courseVersionStatus, ICourseVersion } from '#root/shared/interfaces/models.js';
import {
  IsEmpty,
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsInt,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  IsNumber,
  IsIn,
  IsArray,
  ArrayUnique,
  Min,
  IsBoolean,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Cohort } from '../index.js';
import {Type} from 'class-transformer';

class CreateCourseVersionBody implements Partial<ICourseVersion> {
  @JSONSchema({
    title: 'Version Label',
    description: 'The version label or identifier (e.g., v1.0, Fall 2025)',
    example: 'v1.0',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  version: string;

  @JSONSchema({
    title: 'Version Description',
    description: 'A brief description of the course version',
    example: 'First release of the course',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @JSONSchema({
    title: 'Support Link',
    description: 'Support link for students (Discord, email, forum, etc.)',
    example: 'https://discord.gg/abc123',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  supportLink?: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional() // allow the array to be empty
  @JSONSchema({
    description: 'Array of cohort names in a version',
    example: ['cohort1', 'cohort2'],
  })
  cohorts?: string[];
}

class CreateCourseVersionParams {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to attach the new version to',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  courseId: string;
}

class ReadCourseVersionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to retrieve',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  versionId: string;
}

class DeleteCourseVersionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to delete',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to which the version belongs',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  courseId: string;
}

class ReadCourseVersionCohortsParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to which the version belongs',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  courseId: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  cohortId?: string;
}

class CohortsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['name', 'createdAt', 'updatedAt', 'baseHp', 'safeHp'])
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'baseHp' | 'safeHp' =
    'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

class CohortResponse {
  @JSONSchema({
    description: "Unique identifier of the cohort",
    example: "69ab1823a7aeadefb1476049",
    type: "string",
    readOnly: true,
  })
  @IsString()
  id: string;

  @JSONSchema({
    description: "Name of the cohort",
    example: "Frontend Batch A",
    type: "string",
  })
  @IsString()
  name: string;

  @JSONSchema({
    description: "Base Hp for the cohort",
    example: 100,
    type: "number",
  })
  @IsNumber()
  baseHp: number;

  @JSONSchema({
    description: "safe Hp for the cohort",
    example: 100,
    type: "number",
  })
  @IsNumber()
  safeHp: number;

  @JSONSchema({
    description: "Date when the cohort was created",
    example: "2026-03-06T18:08:35.707Z",
    type: "string",
    format: "date-time",
    readOnly: true,
  })
  createdAt: Date;

  @JSONSchema({
    description: "Date when the cohort was last updated",
    example: "2026-03-06T18:08:35.707Z",
    type: "string",
    format: "date-time",
    readOnly: true,
  })
  updatedAt: Date;

  @JSONSchema({
    description: "Indicates if the cohort is public or private",
    example: true,
    type: "boolean",
  })
  @IsBoolean()
  isPublic: boolean;

  @JSONSchema({
    description: "Indicates if the cohort is active for registrations",
    example: true,
    type: "boolean",
  })
  @IsBoolean()
  isActive: boolean;
}

class CohortsResponse {
  @JSONSchema({
    description: "List of cohorts",
    type: "array",
    items: {
      $ref: "#/definitions/CohortResponse",
    },
    example: [
      {
        id: "69ab1823a7aeadefb1476049",
        name: "one",
        createdAt: "2026-03-06T18:08:35.707Z",
        updatedAt: "2026-03-06T18:08:35.707Z",
      },
      {
        id: "69ab1844a7aeadefb147604c",
        name: "two",
        createdAt: "2026-03-06T18:09:08.594Z",
        updatedAt: "2026-03-06T18:09:08.594Z",
      },
    ],
    readOnly: true,
  })
  @IsArray()
  cohorts?: CohortResponse[];

  @IsString()
  version: string
}

class NewCohortBody{

  @IsOptional()
  @IsString()
  newCohortName?: string

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseHp?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  safeHp?: number
}

class CohortUpdatedMessage{
  @IsString()
  @JSONSchema({
    description: 'Success message',
    example: 'Cohort Updated successfully',
  })
  message!: string;
}

class CohortCreatedMessage{
  @IsString()
  @JSONSchema({
    description: 'Success message',
    example: 'Cohort Created successfully',
  })
  message!: string;
}

class CohortDeletedMessage{
  @IsString()
  @JSONSchema({
    description: 'Success message',
    example: 'Cohort Deleted successfully',
  })
  message!: string;
}

class MoveStudentsToCohortBody{
  @JSONSchema({
    description: 'Array of enrollment IDs to move to the cohort',
    example: ['66c2b6c9b4e0a3e6c1a93f41', '66c2b72ab4e0a3e6c1a93f8a'],
    type: 'array',
    items: {
      type: 'string',
    },
  })
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  enrollmentIds: string[];

  @IsString()
  @IsMongoId()
  @JSONSchema({
    description: 'ID of the cohort to move students to',
    example: '69ab1823a7aeadefb1476049',
    type: 'string',
  })
  targetCohortId: string;
}

class MoveStudentsToCohortResponse{
  @IsString()
  @JSONSchema({
    description: 'Success message',
    example: 'Students moved to cohort successfully',
  })
  message!: string;
}

class CourseVersionDataResponse {
  @JSONSchema({
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8d2',
    type: 'string',
    readOnly: true,
  })
  id: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Version name/label',
    example: 'v1.0',
    type: 'string',
    readOnly: true,
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Description of the version',
    example: 'First release of the course',
    type: 'string',
    readOnly: true,
  })
  description: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the course this version belongs to',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    readOnly: true,
  })
  courseId: string;

  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Support link for students (Discord, email, forum, etc.)',
    example: 'https://discord.gg/abc123',
    type: 'string',
    readOnly: true,
  })
  supportLink?: string;

  @JSONSchema({
    description: 'Creation timestamp',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  createdAt: Date;

  @JSONSchema({
    description: 'Last update timestamp',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  updatedAt: Date;

  @IsOptional()
  @IsArray()
    @JSONSchema({
    description: 'Array of cohort names in a course version',
  })
  cohorts: string[];

  @IsOptional()
  @IsArray()
  @JSONSchema({ description: 'Array of cohort details in a course version' })
  cohortDetails: Cohort[];
}

class CourseVersionNotFoundErrorResponse {
  @JSONSchema({
    description: 'HTTP status code',
    example: 404,
    type: 'integer',
    readOnly: true,
  })
  @IsInt()
  statusCode: number;

  @JSONSchema({
    description: 'Error message',
    example: 'Course version not found',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  message: string;

  @JSONSchema({
    description: 'Error type',
    example: 'Not Found',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  error: string;
}

class CreateCourseVersionResponse {
  @IsNotEmpty()
  @JSONSchema({
    description: 'The updated course object',
    type: 'object',
    example: {
      _id: '68ee228f54e2f6908d54de1r',
      courseId: '68d0f72fd802390872101b5',
      version: 'Version title',
      description: 'Version description',
      modules: [],
      totalItems: null,
      createdAt: '2025-10-14T10:14:39.363Z',
      updatedAt: '2025-10-14T10:14:39.363Z',
    },
    readOnly: true,
  })
  course: Record<string, any>;
}

class UpdateCourseVersionParams {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to which the version belongs',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to update',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  versionId: string;
}

class UpdateCourseVersionBody implements Partial<ICourseVersion> {
  @JSONSchema({
    title: 'Version Label',
    description: 'The version label or identifier (e.g., v1.0, Fall 2025)',
    example: 'v1.0',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  version: string;

  @JSONSchema({
    title: 'Version Description',
    description: 'A brief description of the course version',
    example: 'First release of the course',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @JSONSchema({
    title: 'Support Link',
    description: 'Support link for students (Discord, email, forum, etc.)',
    example: 'https://discord.gg/abc123',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  supportLink?: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional() // allow the array to be empty
  @JSONSchema({
    description: 'Array of cohort names in a version',
    example: ['cohort1', 'cohort2'],
  })
  cohorts?: string[];
}
class CopyCourseVersionParams {
  @IsString()
  @JSONSchema({ description: 'The ID of the course' })
  courseId!: string;

  @IsString()
  @JSONSchema({ description: 'The ID of the version to copy' })
  versionId!: string;
}
class CopyCourseVersionResponse {
  @IsString()
  @JSONSchema({
    description: 'Success message',
    example: 'Course version copied successfully',
  })
  message!: string;
}

class GetCourseVersionWatchTimeParams {
  @IsMongoId()
  @JSONSchema({
    description: 'Course ID',
    example: '66c2b6c9b4e0a3e6c1a93f41',
  })
  courseId!: string;

  @IsMongoId()
  @JSONSchema({
    description: 'Course Version ID',
    example: '66c2b72ab4e0a3e6c1a93f8a',
  })
  versionId!: string;
}

class CourseVersionWatchTimeResponse {
  @IsString()
  @JSONSchema({
    description: 'Success message',
    example: 'Watch time fetched successfully',
  })
  message!: string;

  @IsNumber()
  @JSONSchema({
    description: 'Total watch time in seconds',
    example: 15432,
  })
  totalSeconds!: number;

  @IsNumber()
  @JSONSchema({
    description: 'Total watch time in hours',
    example: 4.29,
  })
  totalHours!: number;

  @IsString()
  @JSONSchema({
    description: 'Total watch time in days',
    example: 0.18,
  })
  readableDuration!: string;

  @IsNumber()
  @JSONSchema({
    description: 'Rounded total hours (2 decimal)',
    example: 4.29,
  })
  totalHoursRounded!: number;
}

class UpdateCourseVersionStatusParams{
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to update',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  versionId: string;
}

 class UpdateCourseVersionStatusBody {
  @IsIn(['active', 'archived'])
  versionStatus: courseVersionStatus;
}

export {
  CreateCourseVersionBody,
  GetCourseVersionWatchTimeParams,
  CourseVersionWatchTimeResponse,
  CopyCourseVersionResponse,
  CopyCourseVersionParams,
  CreateCourseVersionParams,
  ReadCourseVersionParams,
  DeleteCourseVersionParams,
  UpdateCourseVersionParams,
  UpdateCourseVersionBody,
  CourseVersionDataResponse,
  CourseVersionNotFoundErrorResponse,
  CreateCourseVersionResponse,
  UpdateCourseVersionStatusBody,
  UpdateCourseVersionStatusParams,
  ReadCourseVersionCohortsParams,
  CohortsQuery,
  CohortResponse,
  CohortsResponse,
  NewCohortBody,
  CohortUpdatedMessage,
  CohortCreatedMessage,
  CohortDeletedMessage,
  MoveStudentsToCohortBody,
  MoveStudentsToCohortResponse
};

export const COURSEVERSION_VALIDATORS = [
  CreateCourseVersionBody,
  CopyCourseVersionResponse,
  CopyCourseVersionParams,
  CreateCourseVersionParams,
  ReadCourseVersionParams,
  DeleteCourseVersionParams,
  UpdateCourseVersionParams,
  UpdateCourseVersionBody,
  CourseVersionDataResponse,
  CourseVersionNotFoundErrorResponse,
  CreateCourseVersionResponse,
  UpdateCourseVersionStatusBody,
  UpdateCourseVersionStatusParams,
  ReadCourseVersionCohortsParams,
  CohortsQuery,
  CohortResponse,
  CohortsResponse,
  NewCohortBody,
  CohortUpdatedMessage,
  CohortCreatedMessage,
  CohortDeletedMessage,
  MoveStudentsToCohortBody,
  MoveStudentsToCohortResponse
];
