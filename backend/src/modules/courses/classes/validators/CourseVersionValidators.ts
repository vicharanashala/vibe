import {ICourseVersion} from '#root/shared/interfaces/models.js';
import {IsEmpty, IsNotEmpty, IsString, IsMongoId} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

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

  @JSONSchema({
    description: 'Version name/label',
    example: 'v1.0',
    type: 'string',
    readOnly: true,
  })
  name: string;

  @JSONSchema({
    description: 'Description of the version',
    example: 'First release of the course',
    type: 'string',
    readOnly: true,
  })
  description: string;

  @JSONSchema({
    description: 'ID of the course this version belongs to',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    readOnly: true,
  })
  courseId: string;

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
  statusCode: number;

  @JSONSchema({
    description: 'Error message',
    example: 'Course version not found',
    type: 'string',
    readOnly: true,
  })
  message: string;

  @JSONSchema({
    description: 'Error type',
    example: 'Not Found',
    type: 'string',
    readOnly: true,
  })
  error: string;
}

class CreateCourseVersionResponse {
  @JSONSchema({
    description: 'The updated course object',
    type: 'object',
    readOnly: true,
  })
  course: Record<string, any>;

  @JSONSchema({
    description: 'The created version object',
    type: 'object',
    readOnly: true,
  })
  version: Record<string, any>;
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
}
class CopyCourseVersionParams {
  @IsString()
  @JSONSchema({description: 'The ID of the course'})
  courseId!: string;

  @IsString()
  @JSONSchema({description: 'The ID of the version to copy'})
  versionId!: string;
}
class CopyCourseVersionResponse {
  @IsString()
  @JSONSchema({description: 'Success message'})
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
