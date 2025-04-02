/**
 * @file CourseController.ts
 * @description Controller managing course-related routes.
 * @module courses
 *
 * @license MIT
 * @created 2025-03-08
 */

import { instanceToPlain } from "class-transformer";
import "reflect-metadata";
import {
  JsonController,
  Authorized,
  Post,
  Body,
  HttpError,
  Get,
  Param,
  NotFoundError,
  Put,
} from "routing-controllers";
import { CourseRepository } from "shared/database/providers/mongo/repositories/CourseRepository";
import { HTTPError } from "shared/middleware/ErrorHandler";
import { Service, Inject } from "typedi";
import { Course } from "../classes/transformers/Course";
import { ItemNotFoundError } from "shared/errors/errors";
import {
  CreateCoursePayloadValidator,
  UpdateCoursePayloadValidator,
} from "../classes/validators/CourseValidators";

@JsonController("/courses")
@Service()
export class CourseController {
  constructor(
    @Inject("NewCourseRepo") private readonly courseRepo: CourseRepository
  ) {
  }

  @Authorized(["admin", "instructor"])
  @Post("/")
  async create(
    @Body({ validate: true }) payload: CreateCoursePayloadValidator
  ) {
    let course = new Course(payload);
    try {
      course = await this.courseRepo.create(course);
      return instanceToPlain(course);
    } catch (error) {
      throw new HttpError(500, error.message);
    }
  }

  @Authorized(["admin", "instructor"])
  @Get("/:id")
  async read(@Param("id") id: string) {
    try {
      const courses = await this.courseRepo.read(id);
      return instanceToPlain(courses);
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw new HttpError(404, error.message);
      }
      throw new HttpError(500, error.message);
    }
  }

  @Authorized(["admin", "instructor"])
  @Put("/:id")
  async update(
    @Param("id") id: string,
    @Body({ validate: true }) payload: UpdateCoursePayloadValidator
  ) {
    try {

      const course = await this.courseRepo.update(id, payload);
      return instanceToPlain(course);
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw new HttpError(404, error.message);
      }
      throw new HttpError(500, error.message);
    }
  }
}
