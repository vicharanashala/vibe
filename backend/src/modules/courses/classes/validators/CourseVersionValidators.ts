import 'reflect-metadata';
import {IsEmpty, IsNotEmpty, IsString} from 'class-validator';
import {ICourseVersion, IModule} from 'shared/interfaces/IUser';

/**
 * Validation for course version payloads.
 *
 * @category Courses/Validators/CourseVersionValidators
 */
class CreateCourseVersionPayloadValidator implements ICourseVersion {
  @IsEmpty()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  version: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsEmpty()
  modules: IModule[];

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;
}

export {CreateCourseVersionPayloadValidator};
