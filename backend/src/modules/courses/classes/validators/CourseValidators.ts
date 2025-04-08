import 'reflect-metadata';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsEmpty,
  IsOptional,
  ValidateIf,
  IsMongoId,
} from 'class-validator';
import {ICourse} from 'shared/interfaces/IUser';

/**
 * Validation for course payloads.
 *
 * @category Courses/Validators/CourseValidators
 */
class CreateCourseBody implements ICourse {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @IsEmpty()
  instructors: string[];

  @IsEmpty()
  versions: string[];

  @IsEmpty()
  createdAt?: Date;

  @IsEmpty()
  updatedAt?: Date;
}

/**
 * Validation for course payloads.
 *
 * @category Courses/Validators/CourseValidators
 */
class UpdateCourseBody implements Partial<ICourse> {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @MinLength(3)
  description: string;

  @ValidateIf(o => !o.name && !o.description)
  @IsNotEmpty({
    message: 'At least one of "name" or "description" must be provided',
  })
  nameOrDescription: string;
}

class ReadCourseParams {
  @IsMongoId()
  @IsString()
  id: string;
}
class UpdateCourseParams {
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
