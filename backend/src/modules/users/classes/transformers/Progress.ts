import {
  ObjectIdToString,
  StringToObjectId,
} from '#root/shared/constants/transformerConstants.js';
import {ID, IProgress} from '#root/shared/interfaces/models.js';
import {Expose, Transform} from 'class-transformer';
import {ObjectId} from 'mongodb';

@Expose()
export class Progress implements IProgress {
  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  userId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  courseId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  courseVersionId: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  currentModule: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  currentSection: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  currentItem: ID;

  @Expose()
  completed: boolean;

  constructor(
    userId?: string,
    courseId?: string,
    courseVersionId?: string,
    currentModule?: string,
    currentSection?: string,
    currentItem?: string,
    completed = false,
  ) {
    if (
      userId &&
      courseId &&
      courseVersionId &&
      currentModule &&
      currentSection &&
      currentItem
    ) {
      this.userId = new ObjectId(userId);
      this.courseId = new ObjectId(courseId);
      this.courseVersionId = new ObjectId(courseVersionId);
      this.currentModule = new ObjectId(currentModule);
      this.currentSection = new ObjectId(currentSection);
      this.currentItem = new ObjectId(currentItem);
      this.completed = completed;
    }
  }
}
