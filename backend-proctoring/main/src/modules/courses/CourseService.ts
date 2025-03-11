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
import { ICourse, ICourseVersion } from "shared/interfaces/IUser";
import { DTOCourseVersionPayload } from "./DTOCoursePayload";


export class CreateCourseError extends Error {
  constructor(message: string){
    super(message);
    this.name = "CreateCourseError";
  }
}

export class UpdateCourseError extends Error {
  constructor(message: string){
    super(message);
    this.name = "UpdateCourseError";
  }
}

export class FetchCourseError extends Error {
  constructor(message: string){
    super(message);
    this.name = "FetchCourseError";
  } 
}


@Service()
export class CourseService implements ICourseService {
  constructor(@Inject("ICourseRepository") private courseRepository: ICourseRepository) {}

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

    if (createdCourse){
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
    const result = await this.courseRepository.update(id, updatedCourse as ICourse);

    if (result){
      return result;
    }

    throw new UpdateCourseError("Course Update Failed in Database.");
  }

async addVersion(courseId: string, payload: DTOCourseVersionPayload): Promise<unknown | null> {
    const course = await this.courseRepository.read(courseId);
    if (!course) {
        throw new FetchCourseError(`Course with ID ${courseId} not found`);
    }

    const { modules, ...versionDetails } = payload;

    // Process modules and sections before creating the version
    const processedModules = modules.map(module => {
        const { sections, ...moduleDetails } = module;
        const processedSections = sections.map(section => ({
            ...section,
            itemIds: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        }));

        return {
            ...moduleDetails,
            sections: processedSections,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    });

    const newVersion: ICourseVersion = {
        ...versionDetails,
        modules: processedModules,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const createdVersion = await this.courseRepository.createVersion(newVersion);
    if (!createdVersion) {
        throw new CreateCourseError("Failed to create course version in database.");
    }

    // Update course to include new version
    course.versions.push(createdVersion.id as string);
    const updatedCourse = await this.courseRepository.update(courseId, course);

    if (!updatedCourse) {
        throw new UpdateCourseError(`Failed to update course with new version`);
    }

    return {
      ...updatedCourse,
      version: createdVersion,
    };

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
