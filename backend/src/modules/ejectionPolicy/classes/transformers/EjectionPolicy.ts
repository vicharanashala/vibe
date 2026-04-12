import {Transform, Type, Expose} from 'class-transformer';
import {ObjectId} from 'mongodb';
import {PolicyTriggers, PolicyActions} from '../../types.js';

export class EjectionPolicy {
  @Transform(({value}) => value?.toString(), {toPlainOnly: true})
  @Transform(({value}) => (value ? new ObjectId(value) : value), {
    toClassOnly: true,
  })
  _id?: ObjectId | string;

  name: string;
  description?: string;

  @Transform(({value}) => value?.toString(), {toPlainOnly: true})
  @Transform(({value}) => (value ? new ObjectId(value) : value), {
    toClassOnly: true,
  })
  courseId?: ObjectId | string | null;

  @Transform(({value}) => value?.toString(), {toPlainOnly: true})
  @Transform(({value}) => (value ? new ObjectId(value) : value), {
    toClassOnly: true,
  })
  courseVersionId?: ObjectId | string | null;

  isActive: boolean;
  @Transform(({value}) => value?.toString(), {toPlainOnly: true})
  @Transform(({value}) => (value ? new ObjectId(value) : value), {
    toClassOnly: true,
  })
  cohortId?: ObjectId | string | null;

  triggers: PolicyTriggers;
  actions: PolicyActions;

  @Transform(({value}) => value?.toString(), {toPlainOnly: true})
  @Transform(({value}) => (value ? new ObjectId(value) : value), {
    toClassOnly: true,
  })
  createdBy: ObjectId | string;

  @Type(() => Date)
  createdAt: Date;

  @Type(() => Date)
  updatedAt: Date;

  @Type(() => Date)
  deletedAt?: Date;

  constructor(data: Partial<EjectionPolicy>) {
    Object.assign(this, data);
  }
}
