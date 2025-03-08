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
import { ICourse } from "shared/interfaces/IUser";

@Service()
export class CourseService implements ICourseService {
  constructor(@Inject("ICourseRepository") private courseRepository: ICourseRepository) {}

  /**
   * Creates a new course.
   */
  async create(payload: CoursePayload): Promise<ICourse> {
    const course: ICourse = {
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return await this.courseRepository.create(course);
  }

  /**
   * Retrieves a course by ID.
   */
  async read(id: string): Promise<ICourse | null> {
    return await this.courseRepository.read(id);
  }

  /**
   * Updates a course by ID.
   */
  async update(id: string, payload: CoursePayload): Promise<ICourse | null> {
    const updatedCourse: Partial<ICourse> = {
      ...payload,
      updatedAt: new Date(),
    };
    return await this.courseRepository.update(id, updatedCourse as ICourse);
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
