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
import { CoursePayload, ICourseService } from "../interfaces/ICourseService";
import { ICourse, ICourseVersion, IModule } from "shared/interfaces/IUser";
import { DTOCourseVersionPayload } from "../dtos/DTOCoursePayload";

import {
  CreateCourseError,
  FetchCourseError,
  UpdateCourseError,
} from "../errors/CourseErrors";


@Service()
export class CourseService implements ICourseService {
  constructor(
    @Inject("ICourseRepository") private courseRepository: ICourseRepository
  ) {}

  /**
   * Creates a new course.
   */
  async create(payload: CoursePayload): Promise<ICourse> {
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
      updatedCourse
    );

    if (result) {
      return result;
    }

    throw new UpdateCourseError("Course Update Failed in Database.");
  }

}

