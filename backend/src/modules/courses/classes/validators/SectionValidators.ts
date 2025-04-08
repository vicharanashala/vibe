import 'reflect-metadata';
import {
  IsEmpty,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsMongoId,
  Validate,
  ValidateIf,
} from 'class-validator';
import {ISection} from 'shared/interfaces/IUser';
import {ID} from 'shared/types';

/**
 * @category Courses/Validators/ModuleValidators
 */
class CreateSectionBody implements ISection {
  @IsEmpty()
  sectionId?: string | undefined;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @IsEmpty()
  order: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  afterSectionId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeSectionId?: string;

  @IsEmpty()
  itemsGroupId?: ID;

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;
}

class UpdateSectionBody implements Partial<ISection> {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description: string;

  @ValidateIf(o => !o.name && !o.description)
  @IsNotEmpty({
    message: 'At least one of "name" or "description" must be provided',
  })
  nameOrDescription: string;
}

class MoveSectionBody {
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterSectionId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeSectionId?: string;

  @ValidateIf(o => !o.afterSectionId && !o.beforeSectionId)
  @IsNotEmpty({
    message:
      'At least one of "afterSectionId" or "beforeSectionId" must be provided',
  })
  onlyOneAllowed: string;

  @ValidateIf(o => o.afterSectionId && o.beforeSectionId)
  @IsNotEmpty({
    message:
      'Only one of "afterSectionId" or "beforeSectionId" must be provided',
  })
  bothNotAllowed: string;
}

class CreateSectionParams {
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;
}

class MoveSectionParams {
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  sectionId: string;
}

class UpdateSectionParams {
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

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
