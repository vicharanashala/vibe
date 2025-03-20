import { ICourseRepository } from "shared/database";
import { ICourseVersion, IModule, ISection } from "shared/interfaces/IUser";
import { Inject, Service } from "typedi";
import {
  DTOCourseVersionPayload,
  DTOModulePayload,
} from "../dtos/DTOCoursePayload";
import {
  CreateVersionError,
  FetchVersionError,
  UpdateVersionError,
} from "../errors/VersionErros";
import { processModulesAndSections } from "../utils/processModulesAndSections";
import { IVersionService } from "../interfaces/IVersionService";
import c from "config";

import { LexoRank } from "lexorank";

@Service()
export class VersionService implements IVersionService {
  constructor(
    @Inject("ICourseRepository")
    private readonly courseRepository: ICourseRepository
  ) {
    console.log("VersionService instantiated"); // ✅ Debugging line
  }

  async createModule(
    courseId: string,
    versionId: string,
    module: DTOModulePayload
  ): Promise<ICourseVersion | null> {
    let mod: IModule = {
      name: module.name,
      description: module.description,
      order: "",
      isLast: false,
      sections: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  
    const course = await this.courseRepository.read(courseId);
    const version = await this.courseRepository.readVersion(versionId);
  
    if (!course || !version) {
      throw new FetchVersionError("Course or version not found.");
    }
  
    const sortedModules = version.modules.sort((a, b) =>
      a.order.localeCompare(b.order)
    );
  
    mod.order = calculateNewOrder(sortedModules, "moduleId", module.afterModuleId, module.beforeModuleId);
    sortedModules.push(mod);
    version.modules = updateLastEntityStatus(sortedModules, "moduleId", mod, module.afterModuleId);
    version.updatedAt = new Date();
  
    const savedVersion = await this.courseRepository.updateVersion(versionId, version);
    if (!savedVersion) {
      throw new UpdateVersionError("Failed to update course version in the database.");
    }
  
    return savedVersion;
  }
  
  async updateModule(
    courseId: string,
    versionId: string,
    moduleId: string,
    module: Partial<DTOModulePayload>
  ): Promise<ICourseVersion | null> {
    const course = await this.courseRepository.read(courseId);
    const version = await this.courseRepository.readVersion(versionId);
  
    if (!course || !version) {
      throw new FetchVersionError("Course or version not found.");
    }
  
    const existingModule = version.modules.find((m) => m.moduleId === moduleId);
    if (!existingModule) {
      throw new FetchVersionError(`Module with ID ${moduleId} not found.`);
    }
  
    // Only update name and description, order will be changed via another endpoint
    if (module.name) existingModule.name = module.name;
    if (module.description) existingModule.description = module.description;
  
    existingModule.updatedAt = new Date();
    version.updatedAt = new Date();
  
    const savedVersion = await this.courseRepository.updateVersion(versionId, version);
    if (!savedVersion) {
      throw new UpdateVersionError("Failed to update course version in the database.");
    }
  
    return savedVersion;
  }

  async moveModule(
    courseId: string,
    versionId: string,
    moduleId: string,
    afterModuleId?: string,
    beforeModuleId?: string
  ): Promise<ICourseVersion | null> {
    if (!afterModuleId && !beforeModuleId) {
      throw new Error("Either afterModuleId or beforeModuleId must be provided.");
    }
  
    const course = await this.courseRepository.read(courseId);
    const version = await this.courseRepository.readVersion(versionId);
  
    if (!course || !version) {
      throw new FetchVersionError("Course or version not found.");
    }
  
    const sortedModules = version.modules.sort((a, b) =>
      a.order.localeCompare(b.order)
    );
  
    const movingModule = sortedModules.find((m) => m.moduleId === moduleId);
    if (!movingModule) {
      throw new FetchVersionError(`Module with ID ${moduleId} not found.`);
    }
  
    // Recalculate the new order
    movingModule.order = calculateNewOrder(sortedModules, "moduleId", afterModuleId, beforeModuleId);
    
    // Sort modules and update `isLast` flag
    version.modules = updateLastEntityStatus(sortedModules, "moduleId", movingModule, afterModuleId);
    version.updatedAt = new Date();
  
    const savedVersion = await this.courseRepository.updateVersion(versionId, version);
    if (!savedVersion) {
      throw new UpdateVersionError("Failed to update course version in the database.");
    }
  
    return savedVersion;
  }

  async createSection(
    courseId: string,
    versionId: string,
    moduleId: string,
    section: DTOModulePayload
  ): Promise<ICourseVersion | null> {
    let sec: ISection = {
      name: section.name,
      description: section.description,
      order: "",
      itemIds: [],
      isLast: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  
    const course = await this.courseRepository.read(courseId);
    const version = await this.courseRepository.readVersion(versionId);
  
    if (!course || !version) {
      throw new FetchVersionError("Course or version not found.");
    }
  
    const module = version.modules.find((m) => m.moduleId === moduleId);
    if (!module) {
      throw new FetchVersionError("Module not found.");
    }
  
    const sortedSections = module.sections.sort((a, b) => a.order.localeCompare(b.order));
    sec.order = calculateNewOrder(sortedSections, "sectionId", section.afterModuleId, section.beforeModuleId);
  
    sortedSections.push(sec);
    module.sections = updateLastEntityStatus(sortedSections, "sectionId", sec, section.afterModuleId);
    version.updatedAt = new Date();
  
    const savedVersion = await this.courseRepository.updateVersion(versionId, version);
    if (!savedVersion) {
      throw new UpdateVersionError("Failed to update course version in the database.");
    }
  
    return savedVersion;
  }
  
  async updateSection(
    courseId: string,
    versionId: string,
    moduleId: string,
    sectionId: string,
    section: Partial<DTOModulePayload>
  ): Promise<ICourseVersion | null> {
    const course = await this.courseRepository.read(courseId);
    const version = await this.courseRepository.readVersion(versionId);
  
    if (!course || !version) {
      throw new FetchVersionError("Course or version not found.");
    }
  
    const module = version.modules.find((m) => m.moduleId === moduleId);
    if (!module) {
      throw new FetchVersionError("Module not found.");
    }
  
    const existingSection = module.sections.find((s) => s.sectionId === sectionId);
    if (!existingSection) {
      throw new FetchVersionError(`Section with ID ${sectionId} not found.`);
    }
  
    if (section.name) existingSection.name = section.name;
    if (section.description) existingSection.description = section.description;
  
    existingSection.updatedAt = new Date();
    version.updatedAt = new Date();
  
    const savedVersion = await this.courseRepository.updateVersion(versionId, version);
    if (!savedVersion) {
      throw new UpdateVersionError("Failed to update course version in the database.");
    }
  
    return savedVersion;
  }
  
  async moveSection(
    courseId: string,
    versionId: string,
    moduleId: string,
    sectionId: string,
    afterSectionId?: string,
    beforeSectionId?: string
  ): Promise<ICourseVersion | null> {
    if (!afterSectionId && !beforeSectionId) {
      throw new Error("Either afterSectionId or beforeSectionId must be provided.");
    }
  
    const course = await this.courseRepository.read(courseId);
    const version = await this.courseRepository.readVersion(versionId);
  
    if (!course || !version) {
      throw new FetchVersionError("Course or version not found.");
    }
  
    const module = version.modules.find((m) => m.moduleId === moduleId);
    if (!module) {
      throw new FetchVersionError("Module not found.");
    }
  
    const sortedSections = module.sections.sort((a, b) => a.order.localeCompare(b.order));
    const movingSection = sortedSections.find((s) => s.sectionId === sectionId);
    if (!movingSection) {
      throw new FetchVersionError(`Section with ID ${sectionId} not found.`);
    }
  
    movingSection.order = calculateNewOrder(sortedSections, "sectionId", afterSectionId, beforeSectionId);
    module.sections = updateLastEntityStatus(sortedSections, "sectionId", movingSection, afterSectionId);
    version.updatedAt = new Date();
  
    const savedVersion = await this.courseRepository.updateVersion(versionId, version);
    if (!savedVersion) {
      throw new UpdateVersionError("Failed to update course version in the database.");
    }
  
    return savedVersion;
  }
  
  

  async create(
    courseId: string,
    payload: DTOCourseVersionPayload
  ): Promise<ICourseVersion | null> {
    const course = await this.courseRepository.read(courseId);
    if (!course) {
      throw new FetchVersionError(`Course with ID ${courseId} not found.`);
    }

    try {
      // Process and validate module/section order, set `isLast`
      // const processedModules: IModule[] = processModulesAndSections(
      //   payload.modules
      // );

      // Prepare version details
      const versionDetails = {
        ...payload,
        modules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create the course version in the repository
      const createdVersion = await this.courseRepository.createVersion(
        versionDetails
      );
      if (!createdVersion) {
        throw new CreateVersionError(
          "Failed to create course version in the database."
        );
      }

      // Update course to include the new version
      course.versions.push(createdVersion._id as string);
      const updatedCourse = await this.courseRepository.update(
        courseId,
        course
      );
      if (!updatedCourse) {
        throw new UpdateVersionError(
          "Failed to update course with the new version."
        );
      }

      return createdVersion;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Course version creation failed: ${error.message}`);
      }
    }
    return null;
  }

  async update(
    courseId: string,
    versionId: string,
    payload: Partial<DTOCourseVersionPayload>
  ): Promise<ICourseVersion | null> {
    const course = await this.courseRepository.read(courseId);
    if (!course) {
      throw new FetchVersionError(`Course with ID ${courseId} not found.`);
    }

    const existingVersion = await this.courseRepository.readVersion(versionId);
    if (!existingVersion) {
      throw new FetchVersionError(
        `Course version with ID ${versionId} not found.`
      );
    }

    try {
      const updatedVersion = {
        ...existingVersion,
        ...payload,
        // createdAt: existingVersion.createdAt, // Preserve `createdAt`
        createdAt: existingVersion.createdAt, // Preserve `createdAt`
        updatedAt: new Date(), // Update `updatedAt` only if changed
      };

      // Save the updated version
      const savedVersion = await this.courseRepository.updateVersion(
        versionId,
        updatedVersion
      );
      if (!savedVersion) {
        throw new UpdateVersionError(
          "Failed to update course version in the database."
        );
      }

      return savedVersion;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Course version update failed: ${error.message}`);
      }
    }
    return null;
  }
}

  /**
   * Calculates the order for a new entity (Module, Section, or Item)
   */
  function calculateNewOrder<T extends Record<string, any>>(
    sortedEntities: T[],
    idField: keyof T,
    afterId?: string,
    beforeId?: string
  ): string {
    if (sortedEntities.length === 0) {
      return LexoRank.middle().toString();
    }
  
    if (!afterId && !beforeId) {
      return LexoRank.parse(sortedEntities[sortedEntities.length - 1].order).genNext().toString();
    }
  
    if (afterId) {
      const afterIndex = sortedEntities.findIndex((m) => m[idField] === afterId);
      if (afterIndex === sortedEntities.length - 1) {
        return LexoRank.parse(sortedEntities[afterIndex].order).genNext().toString();
      }
      return LexoRank.parse(sortedEntities[afterIndex].order)
        .between(LexoRank.parse(sortedEntities[afterIndex + 1].order))
        .toString();
    }
  
    if (beforeId) {
      const beforeIndex = sortedEntities.findIndex((m) => m[idField] === beforeId);
      if (beforeIndex === 0) {
        return LexoRank.parse(sortedEntities[beforeIndex].order).genPrev().toString();
      }
      return LexoRank.parse(sortedEntities[beforeIndex - 1].order)
        .between(LexoRank.parse(sortedEntities[beforeIndex].order))
        .toString();
    }
  
    return LexoRank.middle().toString();
  }
  
  /**
   * Updates the `isLast` status of entities to maintain proper ordering.
   */
  function updateLastEntityStatus<T extends { isLast: boolean, order:string }>(
    sortedEntities: T[],
    idField: keyof T,
    newEntity: T,
    afterId?: string
  ): T[] {
    // Sort items based on order
    let finalSorted = sortedEntities.sort((a, b) => a.order.localeCompare(b.order));

    // for all items except last set isLast = false
    finalSorted.forEach((item, index, items) => {
      if (index != items.length-1){
        item.isLast = false;
      }
      else {
        item.isLast = true;
      }
    });

    return finalSorted;
  }


