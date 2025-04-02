import 'reflect-metadata';
import {
  IsEmpty,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsMongoId,
} from 'class-validator';
import {IModule, ISection} from 'shared/interfaces/IUser';

/**
 * @category Courses/Validators/ModuleValidators
 */
class CreateModulePayloadValidator implements IModule {
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

export {CreateModulePayloadValidator};
