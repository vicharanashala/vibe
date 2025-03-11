/**
 * @file CourseService.ts
 * @description Service implementation for handling course operations.
 * @module courses
 *
 * @license MIT
 * @created 2025-03-08
 */

import { Service, Inject } from "typedi";

import { ICourseRepository } from "shared/database/interfaces/ICourseRepository";
import { CoursePayload, ICourseService } from "./ICourseService";
import { ICourse, ICourseVersion, IModule } from "shared/interfaces/IUser";
import { DTOCourseVersionPayload } from "./DTOCoursePayload";

export class CreateCourseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateCourseError";
  }
}

export class UpdateCourseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateCourseError";
  }
}

export class FetchCourseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchCourseError";
  }
}

@Service()
export class CourseService implements ICourseService {
  constructor(
    @Inject("ICourseRepository") private courseRepository: ICourseRepository
  ) {}

  /**
   * Creates a new course.
   */
  async createCourse(payload: CoursePayload): Promise<ICourse> {
    const course: ICourse = {
      ...payload,
      versions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const createdCourse = await this.courseRepository.create(course);

    if (createdCourse) {
      return createdCourse;
    }

    throw new CreateCourseError("Course Creation Failed in Database.");
  }

  /**
   * Retrieves a course by ID.
   */
  async read(id: string): Promise<ICourse | null> {
    const course = await this.courseRepository.read(id);

    if (course) {
      return course;
    }

    throw new FetchCourseError("Unable to fetch course from database");
  }

  /**
   * Updates a course by ID.
   */
  async update(id: string, payload: CoursePayload): Promise<ICourse | null> {
    const updatedCourse: Partial<ICourse> = {
      ...payload,
      updatedAt: new Date(),
    };
    const result = await this.courseRepository.update(
      id,
      updatedCourse as ICourse
    );

    if (result) {
      return result;
    }

    throw new UpdateCourseError("Course Update Failed in Database.");
  }

  async addVersion(
    courseId: string,
    payload: DTOCourseVersionPayload
  ): Promise<ICourseVersion | null> {
    const course = await this.courseRepository.read(courseId);
    if (!course) {
      throw new FetchCourseError(`Course with ID ${courseId} not found.`);
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
        throw new CreateCourseError(
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
        throw new UpdateCourseError(
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

  /**
   * Deletes a course by ID.
   */
  async delete(id: string): Promise<boolean> {
    return await this.courseRepository.delete(id);
  }

  /**
   * Retrieves all courses.
   */
  async getAll(): Promise<ICourse[]> {
    return await this.courseRepository.getAll();
  }
}

/**
 * Validates and ensures correct ordering of modules and sections.
 * Sets `isLast` to `true` for the last module and section within each module.
 *
 * @param modules - List of modules to process.
 * @throws Error if module or section order is incorrect.
 */
function processModulesAndSections(
  modules: DTOCourseVersionPayload["modules"]
): IModule[] {
  if (!modules.length) throw new Error("Course must have at least one module.");

  // Sort modules by order and validate sequence
  modules.sort((a, b) => a.order - b.order);
  for (let i = 0; i < modules.length; i++) {
    if (modules[i].order !== i + 1) {
      throw new Error(
        `Module order is incorrect. Expected ${i + 1} but found ${
          modules[i].order
        }.`
      );
    }

    // Process sections inside the module
    modules[i].sections.sort((a, b) => a.order - b.order);
    for (let j = 0; j < modules[i].sections.length; j++) {
      if (modules[i].sections[j].order !== j + 1) {
        throw new Error(
          `Section order in module '${
            modules[i].name
          }' is incorrect. Expected ${j + 1} but found ${
            modules[i].sections[j].order
          }.`
        );
      }

      // Set `isLast` correctly
      modules[i].sections[j].isLast = j === modules[i].sections.length - 1;
    }

    // Set `isLast` correctly for the module
    modules[i].isLast = i === modules.length - 1;
  }

  return modules;
}
