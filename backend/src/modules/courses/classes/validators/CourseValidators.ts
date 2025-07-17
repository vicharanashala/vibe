import {ICourse, ID} from '#root/shared/interfaces/models.js';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  ValidateIf,
  IsMongoId,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

class CourseBody implements Partial<ICourse> {
  @JSONSchema({
    title: 'Course Name',
    description: 'Name of the course',
    example: 'Introduction to Programming',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  @JSONSchema({
    title: 'Course Description',
    description: 'Description of the course',
    example: 'This course covers the basics of programming.',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;
}

class CourseIdParams {
  @JSONSchema({
    description: 'Object ID of the course',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  courseId: string;
}

class CourseDataResponse implements ICourse {
  @JSONSchema({
    description: 'Unique identifier for the course',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  _id?: ID;

  @JSONSchema({
    description: 'Name of the course',
    example: 'Introduction to Programming',
    type: 'string',
  })
  @IsNotEmpty()
  name: string;

  @JSONSchema({
    description: 'Description of the course',
    example: 'This course covers the basics of programming.',
    type: 'string',
  })
  @IsNotEmpty()
  description: string;

  @JSONSchema({
    description: 'List of course version IDs',
    example: ['60d5ec49b3f1c8e4a8f8b8c2', '60d5ec49b3f1c8e4a8f8b8c3'],
    type: 'array',
    readOnly: true,
    items: {
      type: 'string',
    },
  })
  @IsNotEmpty()
  versions: ID[];

  @JSONSchema({
    description: 'List of instructor IDs associated with the course',
    example: ['60d5ec49b3f1c8e4a8f8b8c4', '60d5ec49b3f1c8e4a8f8b8c5'],
    type: 'array',
    readOnly: true,
    items: {
      type: 'string',
    },
  })
  @IsNotEmpty()
  instructors: ID[];

  @JSONSchema({
    title: 'Course Created At',
    description: 'Timestamp when the course was created',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  @IsNotEmpty()
  createdAt?: Date | null;

  @JSONSchema({
    title: 'Course Updated At',
    description: 'Timestamp when the course was last updated',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  @IsNotEmpty()
  updatedAt?: Date | null;
}

class CourseNotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message.',
    example:
      'No course found with the specified ID. Please verify the ID and try again.',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  message: string;
}

export {
  CourseBody,
  CourseIdParams,
  CourseDataResponse,
  CourseNotFoundErrorResponse,
};

export const COURSE_VALIDATORS = [
  CourseBody,
  CourseIdParams,
  CourseDataResponse,
  CourseNotFoundErrorResponse,
]