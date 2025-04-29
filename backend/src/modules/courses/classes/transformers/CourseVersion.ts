import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {
  ObjectIdToString,
  StringToObjectId,
} from 'shared/constants/transformerConstants';
import {ICourseVersion} from 'shared/interfaces/Models';
import {ID} from 'shared/types';
import {Module} from './Module';
import {CreateCourseVersionBody} from '../validators';

/**
 * Course version data transformation.
 *
 * @category Courses/Transformers
 */
class CourseVersion implements ICourseVersion {
  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  courseId: ID;

  @Expose()
  version: string;

  @Expose()
  description: string;

  @Expose()
  @Type(() => Module)
  modules: Module[];

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  constructor(courseVersionBody?: CreateCourseVersionBody) {
    if (courseVersionBody) {
      this.courseId = courseVersionBody.courseId;
      this.version = courseVersionBody.version;
      this.description = courseVersionBody.description;
    }
    this.modules = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export {CourseVersion};
