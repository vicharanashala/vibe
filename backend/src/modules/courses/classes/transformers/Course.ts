import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {
  ObjectIdArrayToStringArray,
  StringArrayToObjectIdArray,
  ObjectIdToString,
  StringToObjectId,
} from 'shared/constants/transformerConstants';
import {ICourse} from 'shared/interfaces/Models';
import {ID} from 'shared/types';
import {CreateCourseBody} from '../validators';
import {JSONSchema} from 'class-validator-jsonschema';

/**
 * Course data transformation.
 *
 * @category Courses/Transformers
 */
class Course implements ICourse {
  @Expose()
  @JSONSchema({
    title: 'Course ID',
    description: 'Unique identifier for the course',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true}) // Convert ObjectId -> string when serializing
  @Transform(StringToObjectId.transformer, {toClassOnly: true}) // Convert string -> ObjectId when deserializing
  _id?: ID;

  @Expose()
  @JSONSchema({
    title: 'Course Name',
    description: 'Name of the course',
    example: 'Introduction to Programming',
    type: 'string',
  })
  name: string;

  @Expose()
  @JSONSchema({
    title: 'Course Description',
    description: 'Description of the course',
    example: 'This course covers the basics of programming.',
    type: 'string',
  })
  description: string;

  @Expose()
  @Transform(ObjectIdArrayToStringArray.transformer, {toPlainOnly: true}) // Convert ObjectId[] -> string[] when serializing
  @Transform(StringArrayToObjectIdArray.transformer, {toClassOnly: true}) // Convert string[] -> ObjectId[] when deserializing
  @JSONSchema({
    title: 'Course Versions',
    description: 'List of course version IDs',
    example: ['60d5ec49b3f1c8e4a8f8b8c2', '60d5ec49b3f1c8e4a8f8b8c3'],
    type: 'array',
    items: {
      type: 'string',
      format: 'Mongo Object ID',
    },
  })
  versions: ID[];

  @Expose()
  @Transform(ObjectIdArrayToStringArray.transformer, {toPlainOnly: true}) // Convert ObjectId[] -> string[] when serializing
  @Transform(StringArrayToObjectIdArray.transformer, {toClassOnly: true}) // Convert string[] -> ObjectId[] when deserializing
  @JSONSchema({
    title: 'Course Instructors',
    description: 'List of instructor IDs associated with the course',
    example: ['60d5ec49b3f1c8e4a8f8b8c4', '60d5ec49b3f1c8e4a8f8b8c5'],
    type: 'array',
    items: {
      type: 'string',
      format: 'Mongo Object ID',
    },
  })
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
  updatedAt?: Date | null;

  constructor(courseBody?: CreateCourseBody) {
    if (courseBody) {
      this.name = courseBody.name;
      this.description = courseBody.description;
    }

    this.versions = [];
    this.instructors = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export {Course};
