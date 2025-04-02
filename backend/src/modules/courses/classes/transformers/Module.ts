import 'reflect-metadata';
import { Expose, Transform, Type } from "class-transformer";
import { calculateNewOrder } from "modules/courses/utils/calculateNewOrder";
import { ObjectId } from "mongodb";
import { ObjectIdToString, StringToObjectId } from "shared/constants/transformerConstants";
import { IModule } from "shared/interfaces/IUser";
import { ID } from "shared/types";
import { CreateModulePayloadValidator } from "../validators/ModuleValidators";
import { Section } from "./Section";

class Module implements IModule {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
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

  constructor(modulePayload: CreateModulePayloadValidator, existingModules: IModule[]) {
    if (modulePayload) {
      this.name = modulePayload.name;
      this.description = modulePayload.description;
    }
    const sortedModules = existingModules.sort((a, b) =>
      a.order.localeCompare(b.order)
    );
    this.moduleId = new ObjectId();
    this.order = calculateNewOrder(
      sortedModules,
      "moduleId",
      modulePayload.afterModuleId,
      modulePayload.beforeModuleId
    );
    this.sections = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export { Module };