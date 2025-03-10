/**
 * @file CourseController.ts
 * @description Controller managing course-related routes.
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
import { CoursePayload, ICourseService } from "./ICourseService";
import { DTOCoursePayload } from "./DTOCoursePayload";

@JsonController("/courses")
@Service()
export class CourseController {
  constructor(@Inject("ICourseService") private readonly courseService: ICourseService) {
    console.log("ICourseService injected:", this.courseService !== undefined); // ✅ Debugging line
    if (!this.courseService) {
        throw new Error("CourseService is not properly injected");
    }
  }

  /**
   * Handles course creation requests.
   * 
   * @param payload - Course details validated via DTO.
   * @returns Plain object representation of the created course.
   */
  @Authorized(["admin", "instructor"])
  @Post("/")
  async createCourse(@Body({ validate: true }) payload: DTOCoursePayload) {
    const course = await this.courseService.createCourse(payload);
    return instanceToPlain(course);
  }

  /**
   * Retrieves a specific course by ID.
   * 
   * @param id - The ID of the course to retrieve.
   * @returns The requested course.
   */
  @Get("/:id")
  async read(@Param("id") id: string) {
    const course = await this.courseService.read(id);
    if (!course) throw new HttpError(404, "Course not found");
    return instanceToPlain(course);
  }

  /**
   * Updates an existing course.
   * 
   * @param id - The ID of the course to update.
   * @param payload - The updated course details.
   * @returns The updated course.
   */
  @Authorized(["admin", "instructor"])
  @Put("/:id")
  async update(@Param("id") id: string, @Body({ validate: true }) payload: CoursePayload) {
    const updatedCourse = await this.courseService.update(id, payload);
    if (!updatedCourse) throw new HttpError(404, "Course not found");
    return instanceToPlain(updatedCourse);
  }

  /**
   * Deletes a course by ID.
   * 
   * @param id - The ID of the course to delete.
   * @returns Success confirmation.
   */
  @Authorized(["admin"])
  @Delete("/:id")
  async delete(@Param("id") id: string) {
    const success = await this.courseService.delete(id);
    if (!success) throw new HttpError(404, "Course not found");
    return { success: true, message: "Course deleted successfully" };
  }

  /**
   * Retrieves all courses.
   * 
   * @returns List of all courses.
   */
  @Get("/")
  async getAll() {
    const courses = await this.courseService.getAll();
    return instanceToPlain(courses);
  }
}
