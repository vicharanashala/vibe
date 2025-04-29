import {
  IsEmpty,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {ISection} from 'shared/interfaces/Models';
import {ID} from 'shared/types';

/**
 * Payload for creating a section inside a module.
 *
 * @category Courses/Validators/SectionValidators
 */
class CreateSectionBody implements Partial<ISection> {
  /**
   * Name/title of the section.
   * Maximum 255 characters.
   */
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  /**
   * Description or purpose of the section.
   * Maximum 1000 characters.
   */
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  /**
   * Optional: place the section after this section ID.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterSectionId?: string;

  /**
   * Optional: place the section before this section ID.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeSectionId?: string;
}

/**
 * Payload for updating a section.
 * Allows partial updates to name or description.
 *
 * @category Courses/Validators/SectionValidators
 */
class UpdateSectionBody implements Partial<ISection> {
  /**
   * New name of the section (optional).
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name: string;

  /**
   * New description of the section (optional).
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description: string;

  /**
   * At least one of name or description must be provided.
   */
  @ValidateIf(o => !o.name && !o.description)
  @IsNotEmpty({
    message: 'At least one of "name" or "description" must be provided',
  })
  nameOrDescription: string;
}

/**
 * Payload for reordering a section within a module.
 *
 * @category Courses/Validators/SectionValidators
 */
class MoveSectionBody {
  /**
   * Optional: move after this section ID.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterSectionId?: string;

  /**
   * Optional: move before this section ID.
   */
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeSectionId?: string;

  /**
   * Validation helper — at least one position ID must be provided.
   */
  @ValidateIf(o => !o.afterSectionId && !o.beforeSectionId)
  @IsNotEmpty({
    message:
      'At least one of "afterSectionId" or "beforeSectionId" must be provided',
  })
  onlyOneAllowed: string;

  /**
   * Validation helper — only one of before/after should be used.
   */
  @ValidateIf(o => o.afterSectionId && o.beforeSectionId)
  @IsNotEmpty({
    message:
      'Only one of "afterSectionId" or "beforeSectionId" must be provided',
  })
  bothNotAllowed: string;
}

/**
 * Route parameters for creating a section in a module.
 *
 * @category Courses/Validators/SectionValidators
 */
class CreateSectionParams {
  /**
   * Version ID of the course the module belongs to.
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;

  /**
   * Module ID where the new section will be added.
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;
}

/**
 * Route parameters for moving a section within a module.
 *
 * @category Courses/Validators/SectionValidators
 */
class MoveSectionParams {
  /**
   * Version ID of the course.
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;

  /**
   * Module ID within the version.
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  /**
   * Section ID that needs to be moved.
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  sectionId: string;
}

/**
 * Route parameters for updating a section.
 *
 * @category Courses/Validators/SectionValidators
 */
class UpdateSectionParams {
  /**
   * Version ID of the course.
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;

  /**
   * Module ID where the section exists.
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  /**
   * Section ID to be updated.
   */
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  sectionId: string;
}

export {
  CreateSectionBody,
  UpdateSectionBody,
  MoveSectionBody,
  CreateSectionParams,
  MoveSectionParams,
  UpdateSectionParams,
};
