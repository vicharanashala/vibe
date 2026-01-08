import { ICourseVersion } from '#root/shared/interfaces/models.js';
import { IsEmpty, IsNotEmpty, IsString, IsMongoId, IsInt, IsOptional, IsUrl } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

class CreateCourseVersionBody implements Partial<ICourseVersion> {
  @JSONSchema({
    title: 'Version Label',
    description: 'The version label or identifier (e.g., v1.0, Fall 2025)',
    example: 'v1.0',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  version: string;

  @JSONSchema({
    title: 'Version Description',
    description: 'A brief description of the course version',
    example: 'First release of the course',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @JSONSchema({
    title: 'Support Link',
    description: 'Support link for students (Discord, email, forum, etc.)',
    example: 'https://discord.gg/abc123',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  supportLink?: string;
}

class CreateCourseVersionParams {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to attach the new version to',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  courseId: string;
}

class ReadCourseVersionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to retrieve',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  versionId: string;
}

class DeleteCourseVersionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to delete',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to which the version belongs',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  courseId: string;
}

class CourseVersionDataResponse {
  @JSONSchema({
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8d2',
    type: 'string',
    readOnly: true,
  })
  id: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Version name/label',
    example: 'v1.0',
    type: 'string',
    readOnly: true,
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Description of the version',
    example: 'First release of the course',
    type: 'string',
    readOnly: true,
  })
  description: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the course this version belongs to',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    readOnly: true,
  })
  courseId: string;

  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Support link for students (Discord, email, forum, etc.)',
    example: 'https://discord.gg/abc123',
    type: 'string',
    readOnly: true,
  })
  supportLink?: string;

  @JSONSchema({
    description: 'Creation timestamp',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  createdAt: Date;

  @JSONSchema({
    description: 'Last update timestamp',
    example: '2023-10-01T12:00:00Z',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  updatedAt: Date;
}

class CourseVersionNotFoundErrorResponse {
  @JSONSchema({
    description: 'HTTP status code',
    example: 404,
    type: 'integer',
    readOnly: true,
  })
  @IsInt()
  statusCode: number;

  @JSONSchema({
    description: 'Error message',
    example: 'Course version not found',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  message: string;

  @JSONSchema({
    description: 'Error type',
    example: 'Not Found',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  error: string;
}

class CreateCourseVersionResponse {

  @IsNotEmpty()
  @JSONSchema({
    description: 'The updated course object',
    type: 'object',
    example:
    {
      "_id": "68ee228f54e2f6908d54de1r",
      "courseId": "68d0f72fd802390872101b5",
      "version": "Version title",
      "description": "Version description",
      "modules": [],
      "totalItems": null,
      "createdAt": "2025-10-14T10:14:39.363Z",
      "updatedAt": "2025-10-14T10:14:39.363Z"
    }
    ,
    readOnly: true,
  })
  course: Record<string, any>;

}

class UpdateCourseVersionParams {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to which the version belongs',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to update',
    type: 'string',
  })
  @IsMongoId()
  @IsString()
  versionId: string;
}

class UpdateCourseVersionBody implements Partial<ICourseVersion> {
  @JSONSchema({
    title: 'Version Label',
    description: 'The version label or identifier (e.g., v1.0, Fall 2025)',
    example: 'v1.0',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  version: string;

  @JSONSchema({
    title: 'Version Description',
    description: 'A brief description of the course version',
    example: 'First release of the course',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @JSONSchema({
    title: 'Support Link',
    description: 'Support link for students (Discord, email, forum, etc.)',
    example: 'https://discord.gg/abc123',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  supportLink?: string;
}
class CopyCourseVersionParams {
  @IsString()
  @JSONSchema({ description: 'The ID of the course' })
  courseId!: string;

  @IsString()
  @JSONSchema({ description: 'The ID of the version to copy' })
  versionId!: string;
}
class CopyCourseVersionResponse {
  @IsString()
  @JSONSchema({ description: 'Success message', example: 'Course version copied successfully' })
  message!: string;
}
export {
  CreateCourseVersionBody,
  CopyCourseVersionResponse,
  CopyCourseVersionParams,
  CreateCourseVersionParams,
  ReadCourseVersionParams,
  DeleteCourseVersionParams,
  UpdateCourseVersionParams,
  UpdateCourseVersionBody,
  CourseVersionDataResponse,
  CourseVersionNotFoundErrorResponse,
  CreateCourseVersionResponse,
};

export const COURSEVERSION_VALIDATORS = [
  CreateCourseVersionBody,
  CopyCourseVersionResponse,
  CopyCourseVersionParams,
  CreateCourseVersionParams,
  ReadCourseVersionParams,
  DeleteCourseVersionParams,
  UpdateCourseVersionParams,
  UpdateCourseVersionBody,
  CourseVersionDataResponse,
  CourseVersionNotFoundErrorResponse,
  CreateCourseVersionResponse,
];
