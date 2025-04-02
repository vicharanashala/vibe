import { instanceToPlain } from "class-transformer";
import "reflect-metadata";
import {
  Authorized,
  Body,
  JsonController,
  Param,
  Post,
  Put,
} from "routing-controllers";
import { CourseRepository } from "shared/database/providers/mongo/repositories/CourseRepository";
import { ReadError, UpdateError } from "shared/errors/errors";
import { HTTPError } from "shared/middleware/ErrorHandler";
import { Inject, Service } from "typedi";
import { ItemsGroup } from "../classes/transformers/Item";
import { Section } from "../classes/transformers/Section";
import { CreateSectionPayloadValidator } from "../classes/validators/SectionValidators";
import { calculateNewOrder } from "../utils/calculateNewOrder";

@JsonController()
@Service()
export class SectionController {
  constructor(
    @Inject("NewCourseRepo") private readonly courseRepo: CourseRepository
  ) {
    if (!this.courseRepo) {
      throw new Error("CourseRepository is not properly injected");
    }
  }

  @Authorized(["admin"])
  @Post("/versions/:versionId/modules/:moduleId/sections")
  async create(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Body({ validate: true }) payload: CreateSectionPayloadValidator
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);

      //Create Section
      const section = new Section(payload, module.sections);

      //Create ItemsGroup
      let itemsGroup = new ItemsGroup(section.sectionId);
      itemsGroup = await this.courseRepo.createItemsGroup(itemsGroup);

      //Assign ItemsGroup to Section
      section.itemsGroupId = itemsGroup._id;

      //Add Section to Module
      module.sections.push(section);

      //Update Module Update Date
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

  @Authorized(["admin"])
  @Put("/versions/:versionId/modules/:moduleId/sections/:sectionId")
  async update(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Param("sectionId") sectionId: string,
    @Body({ validate: true }) payload: Partial<CreateSectionPayloadValidator>
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);
      if (!module) throw new ReadError("Module not found");

      //Find Section
      const section = module.sections.find((s) => s.sectionId === sectionId);
      if (!section) throw new ReadError("Section not found");

      //Update Section
      Object.assign(section, payload.name ? { name: payload.name } : {});
      Object.assign(
        section,
        payload.description ? { description: payload.description } : {}
      );
      section.updatedAt = new Date();

      //Update Module Update Date
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

  @Authorized(["admin"])
  @Put("/versions/:versionId/modules/:moduleId/sections/:sectionId/move")
  async move(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Param("sectionId") sectionId: string,
    @Body() body: { afterSectionId?: string; beforeSectionId?: string }
  ) {
    try {
      const { afterSectionId, beforeSectionId } = body;

      if (!afterSectionId && !beforeSectionId) {
        throw new UpdateError(
          "Either afterModuleId or beforeModuleId is required"
        );
      }

      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find((s) => s.sectionId === sectionId);

      //Sort Sections based on order
      const sortedSections = module.sections.sort((a, b) =>
        a.order.localeCompare(b.order)
      );

      //Calculate New Order
      const newOrder = calculateNewOrder(
        sortedSections,
        "sectionId",
        afterSectionId,
        beforeSectionId
      );

      //Update Section Order
      section.order = newOrder;
      section.updatedAt = new Date();

      //Update Module Update Date
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
