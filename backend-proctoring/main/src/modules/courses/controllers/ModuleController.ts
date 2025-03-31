import { instanceToPlain } from "class-transformer";
import "reflect-metadata";
import {
  Authorized,
  Body,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Params,
  Post,
  Put,
} from "routing-controllers";
import { CourseRepository } from "shared/database/providers/mongo/repositories/CourseRepository";
import { ReadError, UpdateError } from "shared/errors/errors";
import { HTTPError } from "shared/middleware/ErrorHandler";
import { Inject, Service } from "typedi";
import { Module } from "../classes/transformers/Module";
import { CreateModulePayloadValidator } from "../classes/validators/ModuleValidators";
import { calculateNewOrder } from "../utils/calculateNewOrder";
import { IsMongoId, IsString } from "class-validator";

class CreateParams {
  @IsMongoId()
  @IsString()
  versionId: string;
}

@JsonController("/courses")
@Service()
export class ModuleController {
  constructor(
    @Inject("NewCourseRepo") private readonly courseRepo: CourseRepository
  ) {
    if (!this.courseRepo) {
      throw new Error("CourseRepository is not properly injected");
    }
  }
  @Authorized(["admin"])
  @Post("/versions/:versionId/modules")
  async create(
    @Params({validate: true}) params: CreateParams,
    @Body({ validate: true }) payload: CreateModulePayloadValidator
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(params.versionId);

      //Create Module
      const module = new Module(payload, version.modules);

      //Add Module to Version
      version.modules.push(module);

      //Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        params.versionId,
        version
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      throw new InternalServerError(error.message);
    }
  }

  @Authorized(["admin"])
  @Put("/versions/:versionId/modules/:moduleId")
  async update(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Body({ validate: true }) payload: Partial<CreateModulePayloadValidator>
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);
      if (!module) throw new ReadError("Module not found");

      //Update Module
      Object.assign(module, payload.name ? { name: payload.name } : {});
      Object.assign(
        module,
        payload.description ? { description: payload.description } : {}
      );
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof ReadError) {
        throw new HTTPError(404, error);
      }
    }
  }

  @Authorized(["admin"])
  @Put("/versions/:versionId/modules/:moduleId/move")
  async move(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Body() body: { afterModuleId?: string; beforeModuleId?: string }
  ) {
    try {
      const { afterModuleId, beforeModuleId } = body;

      if (!afterModuleId && !beforeModuleId) {
        throw new UpdateError(
          "Either afterModuleId or beforeModuleId is required"
        );
      }

      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Sort Modules based on order
      const sortedModules = version.modules.sort((a, b) =>
        a.order.localeCompare(b.order)
      );

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);
      if (!module) throw new ReadError("Module not found");

      //Calculate New Order
      const newOrder = calculateNewOrder(
        sortedModules,
        "moduleId",
        afterModuleId,
        beforeModuleId
      );

      //Update Module Order
      module.order = newOrder;
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }
}
