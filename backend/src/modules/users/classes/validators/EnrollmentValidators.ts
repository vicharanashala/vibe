import {Type} from 'class-transformer';
import {
  IsMongoId,
  IsString,
  IsNotEmpty,
  IsDate,
  IsEnum,
  IsInt,
  IsArray,
  ValidateNested,
  IsEmail,
  IsOptional,
  IsNumber,
  ArrayMaxSize,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {ProgressDataResponse} from './ProgressValidators.js';
import {
  EnrollmentRole,
  EnrollmentStatus,
  ICourse,
  ID,
} from '#root/shared/interfaces/models.js';
import {CourseDataResponse} from '#root/modules/courses/classes/index.js';
import {ContentCountsValidator} from './ContentCountsValidators.js';

export class EnrollmentParams {
  @JSONSchema({
    description: 'User ID of the student to enroll',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @JSONSchema({
    description: 'ID of the course to enroll in',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'ID of the specific course version to enroll in',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;
}

export class EnrollmentBody {
  @JSONSchema({
    description: 'Role of the user',
    example: 'INSTRUCTOR',
    type: 'string',
    enum: ['INSTRUCTOR', 'STUDENT'],
  })
  @IsEnum(['INSTRUCTOR', 'STUDENT', 'MANAGER', 'TA', 'STAFF'])
  @IsNotEmpty()
  role: EnrollmentRole;
}

export class BulkUnenrollBody {
  @JSONSchema({
    description: 'Array of user IDs to unenroll (maximum 50)',
    example: ['60d5ec49b3f1c8e4a8f8b8d2', '60d5ec49b3f1c8e4a8f8b8d3'],
    type: 'array',
    items: {type: 'string'},
    maxItems: 50,
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayMaxSize(50, {message: 'Cannot unenroll more than 50 students at once'})
  @IsMongoId({each: true})
  userIds: string[];

  @IsOptional()
  @IsMongoId()
  cohortId?: string
}

export class ChangeEnrollmentStatusBody {
  @JSONSchema({
    description: 'New status for the enrollment',
    example: 'inactive',
    type: 'string',
    enum: ['active', 'inactive'],
  })
  @IsEnum(['ACTIVE', 'INACTIVE'])
  @IsNotEmpty()
  status: EnrollmentStatus;

  @IsOptional()
  @IsMongoId()
  cohortId?: string;
}

export class BulkChangeEnrollmentStatusBody {
  @JSONSchema({
    description: 'Array of user IDs to update (maximum 50)',
    example: ['60d5ec49b3f1c8e4a8f8b8d2', '60d5ec49b3f1c8e4a8f8b8d3'],
    type: 'array',
    items: {type: 'string'},
    maxItems: 50,
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayMaxSize(50, {message: 'Cannot update more than 50 students at once'})
  @IsMongoId({each: true})
  userIds: string[];

  @JSONSchema({
    description: 'New status for the enrollments',
    example: 'inactive',
    type: 'string',
    enum: ['active', 'inactive'],
  })
  @IsEnum(['ACTIVE', 'INACTIVE'])
  @IsNotEmpty()
  status: EnrollmentStatus;

  @IsOptional()
  @IsMongoId()
  cohortId?: string;
}
export class EnrollmentDataResponse {
  @JSONSchema({
    description: 'Unique identifier for the enrollment record',
    example: '60d5ec49b3f1c8e4a8f8b8d2',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsMongoId()
  _id?: ID;

  @JSONSchema({
    description: 'Course ID associated with this enrollment',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseId: ID;

  @JSONSchema({
    description: 'Course version ID associated with this enrollment',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseVersionId: ID;

  @JSONSchema({
    description: 'Role of the user',
    example: 'INSTRUCTOR',
    type: 'string',
    enum: ['INSTRUCTOR', 'STUDENT'],
  })
  @IsNotEmpty()
  @IsString()
  role: EnrollmentRole;

  @JSONSchema({
    description: 'Status of the enrollment',
    example: 'active',
    type: 'string',
    enum: ['active', 'inactive'],
  })
  @IsNotEmpty()
  @IsString()
  status: EnrollmentStatus;

  @JSONSchema({
    description: 'Date when the user was enrolled',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  enrollmentDate: Date;

  @JSONSchema({
    description: 'Optional course details related to the enrollment',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CourseDataResponse)
  course: ICourse;

  @JSONSchema({
    description: 'Content counts for the course (videos, quizzes, articles)',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContentCountsValidator)
  contentCounts?: ContentCountsValidator;

  @JSONSchema({
    description: 'Flag indicating new items were added after course completion',
    type: 'boolean',
  })
  @IsOptional()
  hasNewItemsAfterCompletion?: boolean;

  @IsOptional()
  cohortId?: ID;

  @IsOptional()
  cohortName?: string;

  @IsOptional()
  hpSystem?: boolean;
}

class QuizScoresResponse {
  @JSONSchema({
    description: 'Total quiz score achieved by the user',
    example: 85,
    type: 'number',
    format: 'float',
  })
  @IsNotEmpty()
  @IsNumber()
  totalQuizScore: number;

  @JSONSchema({
    description: 'Total maximum quiz score possible',
    example: 100,
    type: 'number',
    format: 'float',
  })
  @IsNotEmpty()
  @IsNumber()
  totalQuizMaxScore: number;
}

export class EnrollUserResponseData {
  @JSONSchema({
    description: 'Enrollment data for the user',
    type: 'object',
    items: {$ref: '#/components/schemas/EnrollmentDataResponse'},
  })
  @ValidateNested()
  @Type(() => EnrollmentDataResponse)
  @IsNotEmpty()
  enrollment: EnrollmentDataResponse;

  @JSONSchema({
    description: 'Progress data for the user',
    type: 'object',
    items: {$ref: '#/components/schemas/ProgressDataResponse'},
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProgressDataResponse)
  progress: ProgressDataResponse;

  @JSONSchema({
    description: 'Quiz scores data for the user',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuizScoresResponse)
  quizScores: QuizScoresResponse;
}

export class EnrolledUserResponseData {
  @JSONSchema({
    description: 'Role of the user in the course',
    example: 'INSTRUCTOR',
    type: 'string',
    enum: ['INSTRUCTOR', 'STUDENT'],
  })
  @IsNotEmpty()
  role: EnrollmentRole;

  @JSONSchema({
    description: 'Status of the enrollment',
    example: 'active',
    type: 'string',
    enum: ['active', 'inactive'],
  })
  @IsNotEmpty()
  status: EnrollmentStatus;

  @JSONSchema({
    description: 'Date when the user was enrolled',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  enrollmentDate: Date;
}

class UserResponse {
  @JSONSchema({
    description: 'Unique identifier for the user',
    example: '60d5ec49b3f1c8e4a8f8b8d2',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  userId: string;

  @JSONSchema({
    description: 'First name of the user',
    example: 'John',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @JSONSchema({
    description: 'Last name of the user',
    example: 'Doe',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @JSONSchema({
    description: 'Email address of the user',
    example: 'user@example.com',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;
}

class ProgressResponse {
  @JSONSchema({
    description: 'Number of items completed by the user',
    example: 5,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  completedItems: number;

  @JSONSchema({
    description: 'Total number of items in the course',
    example: 10,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  totalItems: number;

  @JSONSchema({
    description: 'Percentage of the course completed by the user',
    example: 50,
    type: 'number',
    format: 'float',
  })
  @IsNotEmpty()
  @IsInt()
  percentCompleted: number;
}

export class UpdateEnrollmentProgressResponse {
  @IsNumber()
  totalCount: number;

  @IsNumber()
  updatedCount: number;
}

class AllEnrollmentsResponse {
  @JSONSchema({
    description: 'Role of the user',
    example: 'INSTRUCTOR',
    type: 'string',
    enum: ['INSTRUCTOR', 'STUDENT'],
  })
  @IsNotEmpty()
  @IsString()
  role: EnrollmentRole;

  @JSONSchema({
    description: 'Status of the enrollment',
    example: 'active',
    type: 'string',
    enum: ['active', 'inactive'],
  })
  @IsNotEmpty()
  @IsString()
  status: EnrollmentStatus;

  @JSONSchema({
    description: 'Date when the user was enrolled',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  enrollmentDate: Date;

  @JSONSchema({
    description: 'Date when the user was unenrolled',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  unenrolledAt?: Date;

  @JSONSchema({
    description: 'User data associated with the enrollment',
    type: 'object',
    items: {$ref: '#/components/schemas/EnrolledUserResponseData'},
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UserResponse)
  user: UserResponse;

  @JSONSchema({
    description: 'Progress data for the user in the course',
    type: 'object',
    items: {$ref: '#/components/schemas/ProgressDataResponse'},
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProgressResponse)
  progress: ProgressResponse;
}

export class EnrollmentResponse {
  @JSONSchema({
    description: 'Total number of documents in the response',
    example: 100,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  totalDocuments: number;

  @JSONSchema({
    description: 'Total number of pages in the response',
    example: 10,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  totalPages: number;

  @JSONSchema({
    description: 'Current page number in the response',
    example: 1,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  currentPage: number;

  @JSONSchema({
    description: 'Array of enrollment data for the user',
    type: 'array',
    items: {$ref: '#/components/schemas/EnrollmentDataResponse'},
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => EnrollmentDataResponse)
  enrollments: EnrollmentDataResponse[];

  @JSONSchema({
    description: 'Optional message about the enrollment status',
    example: 'No enrollments found for the user',
    type: 'string',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @JSONSchema({
    description: 'Count of active courses',
    example: 4,
    type: 'integer',
  })
  @IsInt()
  @IsOptional()
  activeCount?: number;

  @JSONSchema({
    description: 'Count of archived courses',
    example: 4,
    type: 'integer',
  })
  @IsInt()
  @IsOptional()
  archivedCount?: number;
}
export class BulkUnenrollResponse {
  @JSONSchema({
    description: 'Whether the bulk operation was successful',
    example: true,
    type: 'boolean',
  })
  @IsNotEmpty()
  success: boolean;

  @JSONSchema({
    description: 'Total number of users requested to unenroll',
    example: 5,
    type: 'number',
  })
  @IsNumber()
  totalRequested: number;

  @JSONSchema({
    description: 'Number of users successfully unenrolled',
    example: 4,
    type: 'number',
  })
  @IsNumber()
  successCount: number;

  @JSONSchema({
    description: 'Number of users that failed to unenroll',
    example: 1,
    type: 'number',
  })
  @IsNumber()
  failureCount: number;

  @JSONSchema({
    description: 'Array of error messages for failed unenrollments',
    type: 'array',
    items: {type: 'string'},
  })
  @IsArray()
  @IsOptional()
  errors?: string[];
}

export class CourseVersionEnrollmentResponse {
  @JSONSchema({
    description: 'Array of enrollment data for the course version',
    type: 'array',
    items: {$ref: '#/components/schemas/AllEnrollmentsResponse'},
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => AllEnrollmentsResponse)
  enrollments: AllEnrollmentsResponse[];
  totalDocuments: number;
  totalPages: number;
  currentPage: number;
}

export class EnrollmentNotFoundErrorResponse {
  @JSONSchema({
    description: 'Error message indicating the enrollment was not found',
    example: 'Enrollment could not be created or found.',
  })
  @IsString()
  message: string;
}

export class EnrollmentStatisticsResponse {
  @IsNumber()
  totalEnrollments: number;

  @IsNumber()
  completedCount: number;

  @IsNumber()
  averageProgressPercent: number;

  @IsNumber()
  averageWatchHoursPerUser: number; // newly added to support watch hours stats
}

export const ENROLLMENT_VALIDATORS = [
  EnrollUserResponseData,
  EnrolledUserResponseData,
  EnrollmentBody,
  EnrollmentParams,
  EnrollmentDataResponse,
  EnrollmentResponse,
  EnrollmentNotFoundErrorResponse,
  UpdateEnrollmentProgressResponse,
  BulkUnenrollBody,
  BulkUnenrollResponse,
  ChangeEnrollmentStatusBody,
  BulkChangeEnrollmentStatusBody,
];
