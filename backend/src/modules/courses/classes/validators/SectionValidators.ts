import {ICourseVersion, ISection} from '#root/shared/interfaces/models.js';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsMongoId,
  ValidateIf,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {AtLeastOne, OnlyOneId} from './customValidators.js';

class CreateSectionBody implements Partial<ISection> {
  @JSONSchema({
    title: 'Section Name',
    description: 'Name/title of the section',
    example: 'Introduction to Algorithms',
    type: 'string',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @JSONSchema({
    title: 'Section Description',
    description: 'Description or purpose of the section',
    example:
      'This section covers fundamental algorithmic concepts including time complexity and space complexity.',
    type: 'string',
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @JSONSchema({
    title: 'After Section ID',
    description: 'Optional: Place the new section after this section ID',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  @OnlyOneId({
    afterIdPropertyName: 'afterSectionId',
    beforeIdPropertyName: 'beforeSectionId',
  })
  afterSectionId?: string;

  @JSONSchema({
    title: 'Before Section ID',
    description: 'Optional: Place the new section before this section ID',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeSectionId?: string;
}

class UpdateSectionBody implements Partial<ISection> {
  @JSONSchema({
    title: 'Section Name',
    description: 'Updated name of the section',
    example: 'Advanced Algorithms',
    type: 'string',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @JSONSchema({
    title: 'Section Description',
    description: 'Updated description of the section',
    example:
      'This section covers advanced algorithmic concepts including dynamic programming and greedy algorithms.',
    type: 'string',
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;
}

class MoveSectionBody {
  @JSONSchema({
    title: 'After Section ID',
    description: 'Move the section after this section ID',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  @OnlyOneId({
    afterIdPropertyName: 'afterSectionId',
    beforeIdPropertyName: 'beforeSectionId',
  })
  afterSectionId?: string;

  @JSONSchema({
    title: 'Before Section ID',
    description: 'Move the section before this section ID',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeSectionId?: string;
}

class VersionModuleSectionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version containing the module',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module containing the section',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  sectionId: string;
}

class SectionDataResponse {
  @JSONSchema({
    description: 'The updated course version data containing the section',
    type: 'object',
    readOnly: true,
  })
  @IsNotEmpty()
  version: ICourseVersion;
}

class SectionNotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message',
    example:
      'No section found with the specified ID. Please verify the ID and try again.',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  message: string;
}

class SectionDeletedResponse {
  @JSONSchema({
    description: 'Deletion confirmation message',
    example:
      'Section with the ID 60d5ec49b3f1c8e4a8f8b8e6 in Version 60d5ec49b3f1c8e4a8f8b8d5 has been deleted successfully.',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  message: string;
}

export {
  CreateSectionBody,
  UpdateSectionBody,
  MoveSectionBody,
  VersionModuleSectionParams,
  SectionDataResponse,
  SectionNotFoundErrorResponse,
  SectionDeletedResponse,
};
