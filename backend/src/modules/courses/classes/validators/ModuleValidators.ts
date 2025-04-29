import {
  IsEmpty,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {IModule, ISection} from 'shared/interfaces/Models';

/**
 * Payload for creating a new module inside a course version.
 *
 * @category Courses/Validators/ModuleValidators
 */
class CreateModuleBody implements Partial<IModule> {
  /**
   * Name/title of the module.
   * Maximum 255 characters.
   */
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  /**
   * Detailed description of the module.
   * Maximum 1000 characters.
   */
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  /**
   * Optional: Move the module after this ID.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterModuleId?: string;

  /**
   * Optional: Move the module before this ID.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeModuleId?: string;
}

/**
 * Payload for updating an existing module.
 * Supports partial updates.
 *
 * @category Courses/Validators/ModuleValidators
 */
class UpdateModuleBody implements Partial<IModule> {
  /**
   * New name of the module (optional).
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name: string;

  /**
   * New description of the module (optional).
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description: string;

  /**
   * At least one of `name` or `description` must be provided.
   */
  @ValidateIf(o => !o.name && !o.description)
  @IsNotEmpty({
    message: 'At least one of "name" or "description" must be provided',
  })
  nameOrDescription: string;
}

/**
 * Payload for moving a module within its version.
 *
 * @category Courses/Validators/ModuleValidators
 */
class MoveModuleBody {
  /**
   * Optional: Move the module after this ID.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterModuleId?: string;

  /**
   * Optional: Move the module before this ID.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeModuleId?: string;

  /**
   * Validation helper: at least one of afterModuleId or beforeModuleId is required.
   */
  @ValidateIf(o => !o.afterModuleId && !o.beforeModuleId)
  @IsNotEmpty({
    message:
      'At least one of "afterModuleId" or "beforeModuleId" must be provided',
  })
  onlyOneAllowed: string;

  /**
   * Validation helper: both afterModuleId and beforeModuleId should not be used together.
   */
  @ValidateIf(o => o.afterModuleId && o.beforeModuleId)
  @IsNotEmpty({
    message: 'Only one of "afterModuleId" or "beforeModuleId" must be provided',
  })
  bothNotAllowed: string;
}

/**
 * Route parameters for creating a module.
 *
 * @category Courses/Validators/ModuleValidators
 */
class CreateModuleParams {
  /**
   * ID of the course version to which the module will be added.
   */
  @IsMongoId()
  @IsString()
  versionId: string;
}

/**
 * Route parameters for updating a module.
 *
 * @category Courses/Validators/ModuleValidators
 */
class UpdateModuleParams {
  /**
   * ID of the course version.
   */
  @IsMongoId()
  @IsString()
  versionId: string;

  /**
   * ID of the module to be updated.
   */
  @IsMongoId()
  @IsString()
  moduleId: string;
}

/**
 * Route parameters for moving a module.
 *
 * @category Courses/Validators/ModuleValidators
 */
class MoveModuleParams {
  /**
   * ID of the course version.
   */
  @IsMongoId()
  @IsString()
  versionId: string;

  /**
   * ID of the module to move.
   */
  @IsMongoId()
  @IsString()
  moduleId: string;
}

/**
 * Route parameters for deleting a module from a course version.
 *
 * @category Courses/Validators/CourseVersionValidators
 */
class DeleteModuleParams {
  /**
   * ID of the course version.
   */
  @IsMongoId()
  @IsString()
  versionId: string;

  /**
   * ID of the module to delete.
   */
  @IsMongoId()
  @IsString()
  moduleId: string;
}

export {
  CreateModuleBody,
  UpdateModuleBody,
  CreateModuleParams,
  UpdateModuleParams,
  MoveModuleParams,
  MoveModuleBody,
  DeleteModuleParams,
};
