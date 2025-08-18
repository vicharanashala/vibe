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
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {ProgressDataResponse} from './ProgressValidators.js';
import {
  EnrollmentRole,
  EnrollmentStatus,
  ID,
} from '#root/shared/interfaces/models.js';
import { User } from '#root/modules/auth/classes/index.js';

export class EnrollmentParams {
  @JSONSchema({
    description: 'User ID of the student to enroll',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @JSONSchema({
    description: 'ID of the course to enroll in',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'ID of the specific course version to enroll in',
    type: 'string',
    format: 'Mongo Object ID',
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
  
export class EnrollmentDataResponse {
  @JSONSchema({
    description: 'Unique identifier for the enrollment record',
    example: '60d5ec49b3f1c8e4a8f8b8d2',
    type: 'string',
    format: 'Mongo Object ID',
    readOnly: true,
  })
  @IsString()
  @IsMongoId()
  _id?: ID;


  @JSONSchema({
    description: 'Course ID associated with this enrollment',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseId: ID;

  @JSONSchema({
    description: 'Course version ID associated with this enrollment',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
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
}

export class EnrollUserResponseData {
  @JSONSchema({
    description: 'Enrollment data for the user',
    type: 'object',
    items: { $ref: '#/components/schemas/EnrollmentDataResponse' },
  })
  @ValidateNested()
  @Type(() => EnrollmentDataResponse)
  @IsNotEmpty()
  enrollment: EnrollmentDataResponse;

  @JSONSchema({
    description: 'Progress data for the user',
    type: 'object',
    items: { $ref: '#/components/schemas/ProgressDataResponse' },
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProgressDataResponse)
  progress: ProgressDataResponse;
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
    format: 'Mongo Object ID',
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
    format: 'email',
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
    description: 'User data associated with the enrollment',
    type: 'object',
    items: { $ref: '#/components/schemas/EnrolledUserResponseData' },
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UserResponse)
  user: UserResponse;

  @JSONSchema({
    description: 'Progress data for the user in the course',
    type: 'object',
    items: { $ref: '#/components/schemas/ProgressDataResponse' },
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
    items: { $ref: '#/components/schemas/EnrollmentDataResponse' },
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
}

export class CourseVersionEnrollmentResponse {
  @JSONSchema({
    description: 'Array of enrollment data for the course version',
    type: 'array',
    items: { $ref: '#/components/schemas/AllEnrollmentsResponse' },
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => AllEnrollmentsResponse)
  enrollments: AllEnrollmentsResponse[];
}

export class EnrollmentNotFoundErrorResponse {
  @JSONSchema({
    description: 'Error message indicating the enrollment was not found',
    example: 'Enrollment could not be created or found.',
  })
  @IsString()
  message: string;
}

export const ENROLLMENT_VALIDATORS = [
  EnrollUserResponseData,
  EnrolledUserResponseData,
  EnrollmentBody,
  EnrollmentParams,
  EnrollmentDataResponse,
  EnrollmentResponse,
  EnrollmentNotFoundErrorResponse
]