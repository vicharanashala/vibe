import 'reflect-metadata';
import {
  IsFirebasePushId,
  IsMongoId,
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Route parameters for enrolling a student in a course version.
 *
 * @category Users/Validators/EnrollmentValidators
 */
export class EnrollmentParams {
  /**
   * User ID of the student to enroll
   */

  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  userId: string;

  /**
   * ID of the course to enroll in
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  courseId: string;

  /**
   * ID of the specific course version to enroll in
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  courseVersionId: string;
}
