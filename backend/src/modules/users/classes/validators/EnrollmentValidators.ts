import 'reflect-metadata';
import {
  IsBoolean,
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {ID} from 'shared/types';
import {Type} from 'class-transformer';
import {ProgressDataResponse} from './ProgressValidators';

export class EnrollmentParams {
  @JSONSchema({
    description: 'User ID of the student to enroll',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @JSONSchema({
    description: 'ID of the course to enroll in',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'ID of the specific course version to enroll in',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  courseVersionId: string;
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
    description: 'User ID associated with this enrollment',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  userId: ID;

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
    description: 'Status of the enrollment',
    example: 'active',
    type: 'string',
    enum: ['active', 'inactive'],
  })
  @IsNotEmpty()
  @IsString()
  status: 'active' | 'inactive';

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
  })
  @IsNotEmpty()
  enrollment: EnrollmentDataResponse;

  @JSONSchema({
    description: 'Progress data for the user',
    type: 'object',
  })
  @IsNotEmpty()
  progress: ProgressDataResponse;
}
export class EnrollmentNotFoundErrorResponse {
  @JSONSchema({
    description: 'Error message indicating the enrollment was not found',
    example: 'Enrollment could not be created or found.',
  })
  @IsString()
  message: string;
}
