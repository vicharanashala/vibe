/**
 * @file ICourseService.ts
 * @description Interfaces for the course service.
 * @module courses
 * 
 * @license MIT
 * @created 2025-03-08
 */

import "reflect-metadata";
import { ICourse } from "shared/interfaces/IUser";
import { DTOCourseVersionPayload } from "./DTOCoursePayload";

/**
 * Payload for creating or updating a course.
 */
export interface CoursePayload {
  /**
   * The name of the course.
   */
  name: string;

  /**
   * The description of the course.
   */
  description: string;

  /**
   * The IDs of instructors associated with the course.
   */
  instructors: string[];

  /**
   *  The IDs of versions of the course.
   */

  versions: string[];
}

/**
 * Interface representing the course service.
 */
export interface ICourseService {
  /**
   * Creates a new course.
   *
   * @param payload - The payload containing the course information.
   * @returns A promise that resolves to the created course.
   */
  createCourse(payload: CoursePayload): Promise<ICourse>;

  /**
   * Retrieves a course by ID.
   *
   * @param id - The ID of the course.
   * @returns A promise that resolves to the course if found, otherwise null.
   */
  read(id: string): Promise<ICourse | null>;

  /**
   * Updates a course by ID.
   *
   * @param id - The ID of the course.
   * @param payload - The updated course information.
   * @returns A promise that resolves to the updated course if successful, otherwise null.
   */
  update(id: string, payload: CoursePayload): Promise<ICourse | null>;

  /**
   * Deletes a course by ID.
   *
   * @param id - The ID of the course to delete.
   * @returns A promise that resolves to a boolean indicating whether the course was successfully deleted.
   */
  delete(id: string): Promise<boolean>;

  /**
   * Retrieves all courses.
   *
   * @returns A promise that resolves to an array of all courses.
   */
  getAll(): Promise<ICourse[]>;

  addVersion(courseId: string, versionDetails: DTOCourseVersionPayload): Promise<unknown>;

  updateVersion(courseId: string, versionId: string, payload: Partial<DTOCourseVersionPayload>): Promise<unknown>;
}
