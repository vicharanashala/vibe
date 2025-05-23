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

class CreateCourseBody implements Partial<ICourse> {
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

class UpdateCourseBody implements Partial<ICourse> {
  @JSONSchema({
    description: 'Name of the course',
    example: 'Introduction to Programming',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  @JSONSchema({
    description: 'Description of the course',
    example: 'This course covers the basics of programming.',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @MinLength(3)
  description: string;

  @JSONSchema({
    deprecated: true,
    description:
      '[READONLY] This is a virtual field used only for validation. Do not include this field in requests.\nEither "name" or "description" must be provided.',
    readOnly: true,
    writeOnly: false,
    type: 'string',
  })
  @ValidateIf(o => !o.name && !o.description)
  @IsNotEmpty({
    message: 'At least one of "name" or "description" must be provided',
  })
  nameOrDescription: string;
}

class ReadCourseParams {
  @JSONSchema({
    description: 'Object ID of the course to read',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  id: string;
}

class UpdateCourseParams {
  @JSONSchema({
    description: 'Object ID of the course to update',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  id: string;
}

class CourseDataResponse implements ICourse {
  @JSONSchema({
    description: 'Unique identifier for the course',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
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
      format: 'Mongo Object ID',
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
      format: 'Mongo Object ID',
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
  CreateCourseBody,
  UpdateCourseBody,
  ReadCourseParams,
  UpdateCourseParams,
  CourseDataResponse,
  CourseNotFoundErrorResponse,
};
