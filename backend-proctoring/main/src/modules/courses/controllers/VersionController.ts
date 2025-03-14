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
import { DTOCourseVersionPayload, DTOModulePayload } from "../dtos/DTOCoursePayload";
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
                throw new HttpError(
                    500,
                    error.message || "Failed to create module"
                );
            }
        }
    }
    
}


