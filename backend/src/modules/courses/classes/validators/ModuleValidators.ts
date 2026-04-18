import {IModule, ICourseVersion} from '#root/shared/interfaces/models.js';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsMongoId,
  ValidateIf,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {OnlyOneId} from './customValidators.js';

class CreateModuleBody implements Partial<IModule> {
  @JSONSchema({
    title: 'Module Name',
    description: 'Name/title of the module',
    example: 'Introduction to Data Structures',
    type: 'string',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @JSONSchema({
    title: 'Module Description',
    description: 'Detailed description of the module content',
    example:
      'This module covers fundamental data structures including arrays, linked lists, stacks, and queues.',
    type: 'string',
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @JSONSchema({
    title: 'After Module ID',
    description: 'Position the new module after this module ID',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  @OnlyOneId({
    afterIdPropertyName: 'afterModuleId',
    beforeIdPropertyName: 'beforeModuleId',
  })
  afterModuleId?: string;

  @JSONSchema({
    title: 'Before Module ID',
    description: 'Position the new module before this module ID',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeModuleId?: string;
}

class UpdateModuleBody implements Partial<IModule> {
  @JSONSchema({
    title: 'Module Name',
    description: 'Updated name of the module',
    example: 'Advanced Data Structures',
    type: 'string',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @JSONSchema({
    title: 'Module Description',
    description: 'Updated description of the module content',
    example:
      'This module covers advanced data structures including trees, graphs, and hash tables.',
    type: 'string',
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;
}

class MoveModuleBody {
  @JSONSchema({
    title: 'After Module ID',
    description: 'Move the module after this module ID',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  @OnlyOneId({
    afterIdPropertyName: 'afterModuleId',
    beforeIdPropertyName: 'beforeModuleId',
  })
  afterModuleId?: string;

  @JSONSchema({
    title: 'Before Module ID',
    description: 'Move the module before this module ID',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeModuleId?: string;
}

class CreateModuleParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to which the module will be added',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  versionId: string;
}

class VersionModuleParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version containing the module',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module to be updated',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  moduleId: string;
}

class ModuleDataResponse {
  @JSONSchema({
    description: 'The updated course version data containing modules',
    type: 'object',
    readOnly: true,
  })
  @IsNotEmpty()
  version: ICourseVersion;
}

class ModuleNotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  message: string;
}

class ModuleDeletedResponse {
  @JSONSchema({
    description: 'Deletion confirmation message',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  message: string;
}

export {
  CreateModuleBody,
  UpdateModuleBody,
  CreateModuleParams,
  VersionModuleParams,
  MoveModuleBody,
  ModuleDataResponse,
  ModuleNotFoundErrorResponse,
  ModuleDeletedResponse,
};

export const MODULE_VALIDATORS = [
  CreateModuleBody,
  UpdateModuleBody,
  CreateModuleParams,
  VersionModuleParams,
  MoveModuleBody,
  ModuleDataResponse,
  ModuleNotFoundErrorResponse,
  ModuleDeletedResponse,
]