import {Expose, Transform, Type} from 'class-transformer';
import {CreateCourseVersionBody} from '../validators/CourseVersionValidators.js';
import {
  ObjectIdArrayToStringArray,
  ObjectIdToString,
  StringArrayToObjectIdArray,
  StringToObjectId,
} from '#root/shared/constants/transformerConstants.js';
import {courseVersionStatus, ICohort, ICourseVersion, ID} from '#root/shared/interfaces/models.js';
import {Module} from './Module.js';
import { ObjectId } from 'mongodb';

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
  @Transform(({ value }) => value ?? 'active', {toClassOnly: true})
  versionStatus: courseVersionStatus;

  @Expose()
  @Type(() => Module)
  modules: Module[];

  @Expose()
  @Type(() => Number)
  totalItems?: number;

  @Expose()
  itemCounts?:{
    VIDEO?: number;
    QUIZ?: number;
    BLOG?: number;
    PROJECT?: number;
    FEEDBACK?: number;
  }

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  @Expose()
  @Transform(ObjectIdArrayToStringArray.transformer, {toPlainOnly: true})
  @Transform(StringArrayToObjectIdArray.transformer, {toClassOnly: true})
  cohorts?: ID[];

  @Expose()
  @Type(() => Cohort)
  cohortDetails?: Cohort[];

  constructor(courseVersionBody?: CreateCourseVersionBody) {
    if (courseVersionBody) {
      this.version = courseVersionBody.version;
      this.description = courseVersionBody.description;
      // this.cohorts = courseVersionBody.cohorts ?? [];
    }
    this.versionStatus='active';
    this.modules = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export class Cohort {
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  _id?: ObjectId;

  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  courseVersionId: ObjectId;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;
}

export {CourseVersion};
