/**
 * @file CourseController.ts
 * @description Controller managing course-version related routes.
 * @module courses
 *
 * @license MIT
 * @created 2025-03-08
 */

import "reflect-metadata";
import {
  JsonController,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Authorized,
  HttpError,
} from "routing-controllers";
import { Inject, Service } from "typedi";
import { instanceToPlain } from "class-transformer";
import {
  DTOCourseVersionPayload,
  DTOModulePayload,
} from "../dtos/DTOCoursePayload";
import { IVersionService } from "../interfaces/IVersionService";

@JsonController("/courses")
@Service()
export class VersionController {
  constructor(
    @Inject("IVersionService") private readonly versionService: IVersionService
  ) {
    console.log("IVersionService injected:", this.versionService !== undefined); // ✅ Debugging line
    if (!this.versionService) {
      throw new Error("VersionService is not properly injected");
    }
  }

  @Authorized(["admin"])
  @Post("/:courseId/versions")
  async createVersion(
    @Param("courseId") courseId: string,
    @Body({ validate: true }) payload: DTOCourseVersionPayload
  ) {
    return await this.versionService.create(courseId, payload);
  }

  @Authorized(["admin"])
  @Put("/:courseId/versions/:versionId")
  async updateVersion(
    @Param("courseId") courseId: string,
    @Param("versionId") versionId: string,
    @Body({ validate: true }) payload: DTOCourseVersionPayload
  ) {
    try {
      const updatedVersion = await this.versionService.update(
        courseId,
        versionId,
        payload
      );
      if (!updatedVersion) throw new HttpError(404, "Course version not found");
      return instanceToPlain(updatedVersion);
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(
          500,
          error.message || "Failed to update course version"
        );
      }
    }
  }
  
  @Authorized(["admin"])
  @Post("/:courseId/versions/:versionId/modules")
  async createModule(
    @Param("courseId") courseId: string,
    @Param("versionId") versionId: string,
    @Body({ validate: true }) payload: DTOModulePayload
  ) {
    try {
      const updatedVersion = await this.versionService.createModule(
        courseId,
        versionId,
        payload
      );
      if (!updatedVersion) throw new HttpError(404, "Course version not found");
      return instanceToPlain(updatedVersion);
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message || "Failed to create module");
      }
    }
  }

  /**
   * Updates an existing module (name, description).
   */
  @Authorized(["admin"])
  @Put("/:courseId/versions/:versionId/modules/:moduleId")
  async updateModule(
    @Param("courseId") courseId: string,
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Body({ validate: true }) payload: Partial<DTOModulePayload>
  ) {
    try {
      const updatedVersion = await this.versionService.updateModule(
        courseId,
        versionId,
        moduleId,
        payload
      );
      if (!updatedVersion) throw new HttpError(404, "Module not found");
      return instanceToPlain(updatedVersion);
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message || "Failed to update module");
      }
    }
  }

  /**
   * Moves a module to a new position in the order.
   */
  @Authorized(["admin"])
  @Put("/:courseId/versions/:versionId/modules/:moduleId/move")
  async moveModule(
    @Param("courseId") courseId: string,
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Body() body: { afterModuleId?: string; beforeModuleId?: string }
  ) {
    try {
      const { afterModuleId, beforeModuleId } = body;

      if (!afterModuleId && !beforeModuleId) {
        throw new HttpError(
          400,
          "Either afterModuleId or beforeModuleId is required"
        );
      }

      const updatedVersion = await this.versionService.moveModule(
        courseId,
        versionId,
        moduleId,
        afterModuleId,
        beforeModuleId
      );
      if (!updatedVersion) throw new HttpError(404, "Module not found");
      return instanceToPlain(updatedVersion);
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message || "Failed to move module");
      }
    }
  }

  @Authorized(["admin"])
  @Post("/:courseId/versions/:versionId/modules/:moduleId/sections")
  async createSection(
    @Param("courseId") courseId: string,
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Body({ validate: true }) payload: DTOModulePayload
  ) {
    try {
      const updatedVersion = await this.versionService.createSection(
        courseId,
        versionId,
        moduleId,
        payload
      );
      if (!updatedVersion) throw new HttpError(404, "Course version not found");
      return instanceToPlain(updatedVersion);
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message || "Failed to create section");
      }
    }
  }

  @Authorized(["admin"])
  @Put("/:courseId/versions/:versionId/modules/:moduleId/sections/:sectionId")
  async updateSection(
    @Param("courseId") courseId: string,
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Param("sectionId") sectionId: string,
    @Body({ validate: true }) payload: Partial<DTOModulePayload>
  ) {
    try {
      const updatedVersion = await this.versionService.updateSection(
        courseId,
        versionId,
        moduleId,
        sectionId,
        payload
      );
      if (!updatedVersion) throw new HttpError(404, "Section not found");
      return instanceToPlain(updatedVersion);
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message || "Failed to update section");
      }
    }
  }

  @Authorized(["admin"])
  @Put(
    "/:courseId/versions/:versionId/modules/:moduleId/sections/:sectionId/move"
  )
  async moveSection(
    @Param("courseId") courseId: string,
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Param("sectionId") sectionId: string,
    @Body() body: { afterSectionId?: string; beforeSectionId?: string }
  ) {
    try {
      const updatedVersion = await this.versionService.moveSection(
        courseId,
        versionId,
        moduleId,
        sectionId,
        body.afterSectionId,
        body.beforeSectionId
      );
      if (!updatedVersion) throw new HttpError(404, "Section not found");
      return instanceToPlain(updatedVersion);
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message || "Failed to move section");
      }
    }
  }
}
