import {calculateNewOrder} from '#courses/utils/calculateNewOrder.js';

import {Expose, Transform, Type} from 'class-transformer';
import {ObjectId} from 'mongodb';
import {CreateSectionBody} from '../validators/SectionValidators.js';
import {
  ObjectIdToString,
  StringToObjectId,
} from '#root/shared/constants/transformerConstants.js';
import {ISection, ID} from '#root/shared/interfaces/models.js';

/**
 * Section data transformation.
 *
 * @category Courses/Transformers
 */
class Section implements ISection {
  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  sectionId?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  order: string;

  @Expose()
  itemsGroupId: ID;

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  constructor(sectionBody: CreateSectionBody, existingSections: ISection[]) {
    if (sectionBody) {
      this.name = sectionBody.name;
      this.description = sectionBody.description;
    }
    const sortedSections = existingSections.sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    this.sectionId = new ObjectId();
    this.order = calculateNewOrder(
      sortedSections,
      'sectionId',
      sectionBody.afterSectionId,
      sectionBody.beforeSectionId,
    );
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export {Section};
