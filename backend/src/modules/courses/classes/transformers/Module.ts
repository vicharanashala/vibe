import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {calculateNewOrder} from 'modules/courses/utils/calculateNewOrder';
import {ObjectId} from 'mongodb';
import {
  ObjectIdToString,
  StringToObjectId,
} from 'shared/constants/transformerConstants';
import {IModule} from 'shared/interfaces/Models';
import {ID} from 'shared/types';
import {CreateModuleBody} from '../validators/ModuleValidators';
import {Section} from './Section';

/**
 * Module data transformation.
 *
 * @category Courses/Transformers
 */
class Module implements IModule {
  @Expose()
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  moduleId?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  order: string;

  @Expose()
  @Type(() => Section)
  sections: Section[];

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  constructor(moduleBody: CreateModuleBody, existingModules: IModule[]) {
    if (moduleBody) {
      this.name = moduleBody.name;
      this.description = moduleBody.description;
    }
    const sortedModules = existingModules.sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    this.moduleId = new ObjectId();
    this.order = calculateNewOrder(
      sortedModules,
      'moduleId',
      moduleBody.afterModuleId,
      moduleBody.beforeModuleId,
    );
    this.sections = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export {Module};
