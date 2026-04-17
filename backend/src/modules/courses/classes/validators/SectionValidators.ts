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
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @JSONSchema({
    title: 'Module ID',
    description: 'ID of the module containing the section',
    type: 'string', 
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @JSONSchema({
    title: 'Section ID',
    description: 'ID of the section',
    type: 'string',
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
    example:{
      versionId: '68ee228f76e2f6346d54de1a',
      moduleId: '68ee263f7f26e0acc3dff1b',
      sectionId: '68ee26447f26e0acc3dff1c',
    "version": {
        "_id": "68ee228f76e2f63vbo9bf54de1e",
        "courseId": "68d0f72fb90d23755949e01b5",
        "version": "version title",
        "description": " version description",
        "modules": [
            {
                "moduleId": "68ee263f7ff94rg0acc3dff108",
                "name": "Untitled Module",
                "description": "Module description",
                "order": "0|hzzzzz:",
                "sections": [
                    {
                        "sectionId": "68ee26447f2bg02cc3dff109",
                        "name": "New Section",
                        "description": "Section description",
                        "order": "0|hzzzzz:",
                        "itemsGroupId": "68ee26447f23343acc3dff10a",
                        "createdAt": "2025-10-14T10:30:28.496Z",
                        "updatedAt": "2025-10-14T10:30:28.496Z"
                    },
                ],
                "createdAt": "2025-10-14T10:30:23.780Z",
                "updatedAt": "2025-10-14T10:30:45.000Z"
            }
        ],
        "totalItems": null,
        "createdAt": "2025-10-14T10:14:39.363Z",
        "updatedAt": "2025-10-14T10:30:45.000Z"
    }
}
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

export const SECTION_VALIDATORS = [
  CreateSectionBody,
  UpdateSectionBody,
  MoveSectionBody,
  VersionModuleSectionParams,
  SectionDataResponse,
  SectionNotFoundErrorResponse,
  SectionDeletedResponse,
]