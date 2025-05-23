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
import {JSONSchema} from 'class-validator-jsonschema';

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
  @IsOptional()
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
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description: string;

  @JSONSchema({
    deprecated: true,
    description:
      '[READONLY] This is a virtual field used only for validation. Do not include this field in requests.\nEither "name" or "description" must be provided.',
    readOnly: true,
    writeOnly: false,
    type: 'string',
  })
  @ValidateIf(o => !o.name && !o.description)
  @IsNotEmpty({
    message: 'At least one of "name" or "description" must be provided',
  })
  nameOrDescription: string;
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

  @JSONSchema({
    deprecated: true,
    description:
      '[READONLY] Validation helper. Either afterSectionId or beforeSectionId must be provided.',
    readOnly: true,
    type: 'string',
  })
  @ValidateIf(o => !o.afterSectionId && !o.beforeSectionId)
  @IsNotEmpty({
    message:
      'At least one of "afterSectionId" or "beforeSectionId" must be provided',
  })
  onlyOneAllowed: string;

  @JSONSchema({
    deprecated: true,
    description:
      '[READONLY] Validation helper. Both afterSectionId and beforeSectionId should not be provided together.',
    readOnly: true,
    type: 'string',
  })
  @ValidateIf(o => o.afterSectionId && o.beforeSectionId)
  @IsNotEmpty({
    message:
      'Only one of "afterSectionId" or "beforeSectionId" must be provided',
  })
  bothNotAllowed: string;
}

class CreateSectionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to which the module belongs',
    example: '60d5ec49b3f1c8e4a8f8b8d5',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module where the new section will be added',
    example: '60d5ec49b3f1c8e4a8f8b8e6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;
}

class MoveSectionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version containing the module',
    example: '60d5ec49b3f1c8e4a8f8b8d5',
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
    example: '60d5ec49b3f1c8e4a8f8b8e6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section to be moved',
    example: '60d5ec49b3f1c8e4a8f8b8f7',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  sectionId: string;
}

class UpdateSectionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version containing the module',
    example: '60d5ec49b3f1c8e4a8f8b8d5',
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
    example: '60d5ec49b3f1c8e4a8f8b8e6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section to be updated',
    example: '60d5ec49b3f1c8e4a8f8b8f7',
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
  version: Record<string, any>;
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

class DeleteSectionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version containing the module',
    example: '60d5ec49b3f1c8e4a8f8b8d5',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module to delete',
    example: '60d5ec49b3f1c8e4a8f8b8e6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  moduleId: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section to delete',
    example: '60d5ec49b3f1c8e4a8f8b8e6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  sectionId: string;
}

export {
  CreateSectionBody,
  UpdateSectionBody,
  MoveSectionBody,
  CreateSectionParams,
  MoveSectionParams,
  UpdateSectionParams,
  SectionDataResponse,
  SectionNotFoundErrorResponse,
  SectionDeletedResponse,
  DeleteSectionParams,
};
