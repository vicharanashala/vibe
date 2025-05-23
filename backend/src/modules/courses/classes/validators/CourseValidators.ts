import 'reflect-metadata';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  ValidateIf,
  IsMongoId,
} from 'class-validator';
import {ICourse} from 'shared/interfaces/Models';

/**
 * DTO for creating a course.
 *
 * @category Courses/Validators/CourseValidators
 */
class CreateCourseBody implements Partial<ICourse> {
  /**
   * The name of the course.
   * Must be between 3 and 255 characters.
   */
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  /**
   * A brief description of the course.
   * Max length is 1000 characters.
   */
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;
}

/**
 * DTO for updating a course.
 * Allows partial updates.
 *
 * @category Courses/Validators/CourseValidators
 */
class UpdateCourseBody implements Partial<ICourse> {
  /**
   * New name for the course (optional).
   * Must be between 3 and 255 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  /**
   * New course description (optional).
   * Must be between 3 and 1000 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @MinLength(3)
  description: string;

  /**
   * At least one of `name` or `description` must be present.
   * This virtual field is used for validation purposes only.
   */
  @ValidateIf(o => !o.name && !o.description)
  @IsNotEmpty({
    message: 'At least one of "name" or "description" must be provided',
  })
  nameOrDescription: string;
}

/**
 * Route parameters for reading a course by ID.
 *
 * @category Courses/Validators/CourseValidators
 */
class ReadCourseParams {
  /**
   * MongoDB ObjectId of the course to fetch.
   */
  @IsMongoId()
  @IsString()
  id: string;
}

/**
 * Route parameters for updating a course by ID.
 *
 * @category Courses/Validators/CourseValidators
 */
class UpdateCourseParams {
  /**
   * MongoDB ObjectId of the course to update.
   */
  @IsMongoId()
  @IsString()
  id: string;
}

export {
  CreateCourseBody,
  UpdateCourseBody,
  ReadCourseParams,
  UpdateCourseParams,
};
