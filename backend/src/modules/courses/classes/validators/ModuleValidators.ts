import {IModule, ICourseVersion} from '#root/shared/interfaces/models.js';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsMongoId,
  ValidateIf,
  IsBoolean,
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
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module to be updated',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  moduleId: string;
}

class HideModuleParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version containing the module',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module to be updated',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  moduleId: string;
}

class HideModuleBody {
  @JSONSchema({
    title: 'Hide Module',
    description: 'Flag to hide (true) or unhide (false) the module',
    type: 'boolean',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  hide: boolean;
}

class ModuleDataResponse {
  @JSONSchema({
    description: 'The updated course version data containing modules',
    type: 'object',
    readOnly: true,
    example: {
      version: {
        _id: '68ee228f76e2e45t4t5t4de1e',
        courseId: '68d0f72fioy45r01b5',
        version: 'Version title',
        description: 'version description ',
        modules: [
          {
            moduleId: '68ee2409020303gncb24736e5e',
            name: 'Untitled Module',
            description: 'Module description',
            order: '0|hzzxcx:',
            sections: [],
            createdAt: '2025-10-14T10:20:57.770Z',
            updatedAt: '2025-10-14T10:20:57.770Z',
          },
        ],
        totalItems: null,
        createdAt: '2025-10-14T10:14:39.363Z',
        updatedAt: '2025-10-14T10:20:57.770Z',
      },
    },
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
    example: 'Module {moduleId} deleted in version {versionId}',
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
  HideModuleParams,
  HideModuleBody,
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
  HideModuleParams,
  HideModuleBody,
];
