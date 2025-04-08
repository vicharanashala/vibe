import 'reflect-metadata';
import {
  IsEmpty,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsMongoId,
  ValidateIf,
} from 'class-validator';
import {IModule, ISection} from 'shared/interfaces/IUser';

/**
 * @category Courses/Validators/ModuleValidators
 */
class CreateModuleBody implements IModule {
  @IsEmpty()
  moduleId?: string | undefined;

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
  afterModuleId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeModuleId?: string;

  @IsEmpty()
  sections: ISection[];

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;
}

class UpdateModuleBody implements Partial<IModule> {
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

class MoveModuleBody {
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterModuleId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeModuleId?: string;

  @ValidateIf(o => !o.afterModuleId && !o.beforeModuleId)
  @IsNotEmpty({
    message:
      'At least one of "afterModuleId" or "beforeModuleId" must be provided',
  })
  onlyOneAllowed: string;

  @ValidateIf(o => o.afterModuleId && o.beforeModuleId)
  @IsNotEmpty({
    message: 'Only one of "afterModuleId" or "beforeModuleId" must be provided',
  })
  bothNotAllowed: string;
}

class CreateModuleParams {
  @IsMongoId()
  @IsString()
  versionId: string;
}

class UpdateModuleParams {
  @IsMongoId()
  @IsString()
  versionId: string;

  @IsMongoId()
  @IsString()
  moduleId: string;
}

class MoveModuleParams {
  @IsMongoId()
  @IsString()
  versionId: string;

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
};
