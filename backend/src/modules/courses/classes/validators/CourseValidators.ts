import 'reflect-metadata';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  ValidateIf,
  IsMongoId,
} from 'class-validator';
import {ICourse} from 'shared/interfaces/Models';
import {JSONSchema} from 'class-validator-jsonschema';
import {Exclude, Expose, Transform, Type} from 'class-transformer';
import {
  ObjectIdToString,
  StringToObjectId,
  ObjectIdArrayToStringArray,
  StringArrayToObjectIdArray,
} from 'shared/constants/transformerConstants';
import {ID} from 'shared/types';

/**
 * DTO for creating a course.
 *
 * @category Courses/Validators/CourseValidators
 */
class CreateCourseBody implements Partial<ICourse> {
  /**
   * The name of the course.
   * Must be between 3 and 255 characters.
   */
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  @JSONSchema({
    title: 'Course Name',
    description: 'Name of the course',
    example: 'Introduction to Programming',
    type: 'string',
  })
  name: string;

  /**
   * A brief description of the course.
   * Max length is 1000 characters.
   */
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  @JSONSchema({
    title: 'Course Description',
    description: 'Description of the course',
    example: 'This course covers the basics of programming.',
    type: 'string',
  })
  description: string;
}

/**
 * DTO for updating a course.
 * Allows partial updates.
 *
 * @category Courses/Validators/CourseValidators
 */
class UpdateCourseBody implements Partial<ICourse> {
  /**
   * New name for the course (optional).
   * Must be between 3 and 255 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  @JSONSchema({
    title: 'Course Name',
    description: 'Name of the course',
    example: 'Introduction to Programming',
    type: 'string',
  })
  name: string;

  /**
   * New course description (optional).
   * Must be between 3 and 1000 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @MinLength(3)
  @JSONSchema({
    title: 'Course Description',
    description: 'Description of the course',
    example: 'This course covers the basics of programming.',
    type: 'string',
  })
  description: string;

  /**
   * At least one of `name` or `description` must be present.
   * This virtual field is used for validation purposes only.
   */
  @ValidateIf(o => !o.name && !o.description)
  @IsNotEmpty({
    message: 'At least one of "name" or "description" must be provided',
  })
  @Exclude()
  nameOrDescription: string;
}

/**
 * Route parameters for reading a course by ID.
 *
 * @category Courses/Validators/CourseValidators
 */
class ReadCourseParams {
  /**
   * MongoDB ObjectId of the course to fetch.
   */
  @IsMongoId()
  @IsString()
  id: string;
}

/**
 * Route parameters for updating a course by ID.
 *
 * @category Courses/Validators/CourseValidators
 */
class UpdateCourseParams {
  /**
   * MongoDB ObjectId of the course to update.
   */
  @IsMongoId()
  @IsString()
  id: string;
}

class CourseDataResponse implements ICourse {
  @Expose()
  @JSONSchema({
    title: 'Course ID',
    description: 'Unique identifier for the course',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'mongo-uid',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true}) // Convert ObjectId -> string when serializing
  @IsNotEmpty()
  _id?: ID;

  @Expose()
  @JSONSchema({
    title: 'Course Name',
    description: 'Name of the course',
    example: 'Introduction to Programming',
    type: 'string',
  })
  @IsNotEmpty()
  name: string;

  @Expose()
  @JSONSchema({
    title: 'Course Description',
    description: 'Description of the course',
    example: 'This course covers the basics of programming.',
    type: 'string',
  })
  @IsNotEmpty()
  description: string;

  @Expose()
  @Transform(ObjectIdArrayToStringArray.transformer, {toPlainOnly: true}) // Convert ObjectId[] -> string[] when serializing
  @JSONSchema({
    title: 'Course Versions',
    description: 'List of course version IDs',
    example: ['60d5ec49b3f1c8e4a8f8b8c2', '60d5ec49b3f1c8e4a8f8b8c3'],
    type: 'array',
    items: {
      type: 'string',
      format: 'mongo-uid',
    },
  })
  @IsNotEmpty()
  versions: ID[];

  @Expose()
  @Transform(ObjectIdArrayToStringArray.transformer, {toPlainOnly: true}) // Convert ObjectId[] -> string[] when serializing
  @JSONSchema({
    title: 'Course Instructors',
    description: 'List of instructor IDs associated with the course',
    example: ['60d5ec49b3f1c8e4a8f8b8c4', '60d5ec49b3f1c8e4a8f8b8c5'],
    type: 'array',
    items: {
      type: 'string',
      format: 'mongo-uid',
    },
  })
  @IsNotEmpty()
  instructors: ID[];

  @Expose()
  @Type(() => Date)
  @JSONSchema({
    title: 'Course Created At',
    description: 'Timestamp when the course was created',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsNotEmpty()
  createdAt?: Date | null;

  @Expose()
  @Type(() => Date)
  @JSONSchema({
    title: 'Course Updated At',
    description: 'Timestamp when the course was last updated',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsNotEmpty()
  updatedAt?: Date | null;
}

class CourseNotFoundErrorResponse {
  @Expose()
  @JSONSchema({
    description: 'The error message.',
    example:
      '"No course found with the specified ID. Please verify the ID and try again."',
    type: 'string',
  })
  message: string;
}

export {
  CreateCourseBody,
  UpdateCourseBody,
  ReadCourseParams,
  UpdateCourseParams,
  CourseDataResponse,
  CourseNotFoundErrorResponse,
};
