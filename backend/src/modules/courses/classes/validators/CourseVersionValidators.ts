import 'reflect-metadata';
import {IsEmpty, IsMongoId, IsNotEmpty, IsString} from 'class-validator';
import {ICourseVersion, IModule} from 'shared/interfaces/IUser';

/**
 * Validation for course version payloads.
 *
 * @category Courses/Validators/CourseVersionValidators
 */
class CreateCourseVersionBody implements ICourseVersion {
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

class CreateCourseVersionParams {
  @IsMongoId()
  @IsString()
  id: string;
}
class ReadCourseVersionParams {
  @IsMongoId()
  @IsString()
  id: string;
}

export {
  CreateCourseVersionBody,
  CreateCourseVersionParams,
  ReadCourseVersionParams,
};
