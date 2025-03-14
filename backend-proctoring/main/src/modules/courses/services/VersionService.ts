import { ICourseRepository } from "shared/database";
import { ICourseVersion, IModule } from "shared/interfaces/IUser";
import { Inject, Service } from "typedi";
import { DTOCourseVersionPayload } from "../dtos/DTOCoursePayload";
import {
  CreateVersionError,
  FetchVersionError,
  UpdateVersionError,
} from "../errors/VersionErros";
import { processModulesAndSections } from "../utils/processModulesAndSections";
import { IVersionService } from "../interfaces/IVersionService";

@Service()
export class VersionService implements IVersionService{
  constructor(
    @Inject("ICourseRepository")
    private readonly courseRepository: ICourseRepository
  ) {
    console.log("VersionService instantiated"); // ✅ Debugging line
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
      const processedModules: IModule[] = processModulesAndSections(
        payload.modules
      );

      // Prepare version details
      const versionDetails = {
        ...payload,
        modules: processedModules.map((module) => ({
          ...module,
          createdAt: new Date(),
          updatedAt: new Date(),
          sections: module.sections.map((section) => ({
            ...section,
            createdAt: new Date(),
            updatedAt: new Date(),
            itemIds: [], // Ensure `itemIds` is initialized as an empty array
          })),
        })),
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
      course.versions.push(createdVersion.id as string);
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
      // Validate and process modules and sections, ensuring order integrity
      const updatedModules = processModulesAndSections(
        payload.modules || existingVersion.modules
      );

      // Ensure `updatedAt` is updated only for changed modules/sections
      updatedModules.forEach((module) => {
        const existingModule = existingVersion.modules.find(
          (m) => m.moduleId === module.moduleId
        );
        let moduleUpdated = false;

        const updatedSections = module.sections.map((section) => {
          const existingSection = existingModule?.sections.find(
            (s) => s.sectionId === section.sectionId
          );

          if (!existingSection) {
            moduleUpdated = true; // A new section was added
            return {
              ...section,
              updatedAt: new Date(),
            };
          }

          const sectionUpdated = Object.keys(section).some(
            (key) =>
              key !== "itemIds" &&
              section[key as keyof IModule] !==
                existingSection[key as keyof IModule]
          );

          return {
            ...existingSection,
            ...section,
            itemIds: existingSection.itemIds, // Preserve itemIds
            updatedAt: sectionUpdated ? new Date() : existingSection.updatedAt,
          };
        });

        if (
          moduleUpdated ||
          updatedSections.some((s, idx) => s !== module.sections[idx])
        ) {
          module.updatedAt = new Date();
        }

        module.sections = updatedSections;
      });

      // Update course version `updatedAt` only if modules changed
      const versionUpdated = updatedModules.some(
        (m, idx) => m !== existingVersion.modules[idx]
      );

      const updatedVersion = {
        ...existingVersion,
        ...payload,
        modules: updatedModules,
        updatedAt: versionUpdated ? new Date() : existingVersion.updatedAt, // Update `updatedAt` only if changed
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
