import { ICourse, ID } from '#root/shared/interfaces/models.js';
import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  ValidateIf,
  IsMongoId,
  IsEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ObjectId } from 'mongodb';

class EditCourseBody implements Partial<ICourse> {
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

  @JSONSchema({
    title: 'Course Version Name',
    description: 'Name of the course Version',
    example: 'Introduction to Programming V1.0',
    type: 'string',
  })
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  versionName?: string;

  @JSONSchema({
    title: 'Course Version Description',
    description: 'Description of the course version',
    example: 'This is an intial version.',
    type: 'string',
  })
  @IsString()
  @MaxLength(1000)
  versionDescription?: string;

  // @JSONSchema({
  //   title: 'Course Versions',
  //   description: 'Array of course version IDs to associate with this course',
  //   example: ['64b7f1f9e4d2f91b7c9a1e23', '64b7f201e4d2f91b7c9a1e24'],
  //   type: 'array',
  //   items: {type: 'string', format: 'objectId'},
  // })
  // @IsArray()
  // @Transform(({value}) =>
  //   Array.isArray(value) ? value.map(v => new ObjectId(v)) : value,
  // )
  // versions?: ID[];
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

export class CourseVersionQuery {
  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  courseVersionId?: string;
}

export class ActiveUserDto {
  @IsString()
  firstName: string;

  @IsString()
  email: string;

  @IsString()
  lastActiveTime: string;
}

export class ActiveUsersResponseDto {
  @ValidateNested({ each: true })
  @Type(() => ActiveUserDto)
  activeUsers: ActiveUserDto[];
}

export class CourseVersionQueryWithTime extends CourseVersionQuery {
  @IsOptional()
  @IsString()
  startTimeStamp: string;


  @IsOptional()
  @IsString()
  endTimeStamp: string;
}

export class PublicCoursesQuery {
  @JSONSchema({
    description: 'Page number for pagination',
    example: 1,
    type: 'number',
  })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @JSONSchema({
    description: 'Number of items per page',
    example: 10,
    type: 'number',
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @JSONSchema({
    description: 'Search term for course name or description',
    example: 'programming',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CourseVersionParams {
  @IsMongoId()
  @JSONSchema({
    title: 'Course ID',
    description: 'Object ID of the course',
  })
  courseId: string;

  @IsMongoId()
  @JSONSchema({
    description: 'Object ID of the course version',
    type: 'string',
  })
  courseVersionId: string;
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
  EditCourseBody,
  CourseIdParams,
  CourseDataResponse,
  CourseNotFoundErrorResponse,
};

export const COURSE_VALIDATORS = [
  CourseBody,
  CourseIdParams,
  CourseDataResponse,
  CourseNotFoundErrorResponse,
];
