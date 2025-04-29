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

/**
 * Course data transformation.
 *
 * @category Courses/Transformers
 */
class Course implements ICourse {
  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true}) // Convert ObjectId -> string when serializing
  @Transform(StringToObjectId.transformer, {toClassOnly: true}) // Convert string -> ObjectId when deserializing
  _id?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  @Transform(ObjectIdArrayToStringArray.transformer, {toPlainOnly: true}) // Convert ObjectId[] -> string[] when serializing
  @Transform(StringArrayToObjectIdArray.transformer, {toClassOnly: true}) // Convert string[] -> ObjectId[] when deserializing
  versions: ID[];

  @Expose()
  @Transform(ObjectIdArrayToStringArray.transformer, {toPlainOnly: true}) // Convert ObjectId[] -> string[] when serializing
  @Transform(StringArrayToObjectIdArray.transformer, {toClassOnly: true}) // Convert string[] -> ObjectId[] when deserializing
  instructors: ID[];

  @Expose()
  @Type(() => Date)
  createdAt?: Date | null;

  @Expose()
  @Type(() => Date)
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
