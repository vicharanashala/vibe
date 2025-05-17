import 'reflect-metadata';
import {IsEmpty, IsNotEmpty, IsString, IsMongoId} from 'class-validator';
import {ICourseVersion} from 'shared/interfaces/Models';
import {JSONSchema} from 'class-validator-jsonschema';

class CreateCourseVersionBody implements Partial<ICourseVersion> {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course this version belongs to (auto-managed)',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
    readOnly: true,
  })
  @IsEmpty()
  courseId?: string;

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
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  id: string;
}

class ReadCourseVersionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to retrieve',
    example: '60d5ec49b3f1c8e4a8f8b8d2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  id: string;
}

class DeleteCourseVersionParams {
  @JSONSchema({
    title: 'Version ID',
    description: 'ID of the course version to delete',
    example: '60d5ec49b3f1c8e4a8f8b8d2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course to which the version belongs',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
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
    format: 'Mongo Object ID',
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
    format: 'Mongo Object ID',
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

export {
  CreateCourseVersionBody,
  CreateCourseVersionParams,
  ReadCourseVersionParams,
  DeleteCourseVersionParams,
  CourseVersionDataResponse,
  CourseVersionNotFoundErrorResponse,
  CreateCourseVersionResponse,
};
