import { ID, IUser } from '#root/shared/index.js';
import {
  IsString,
  IsUrl,
  IsOptional,
  IsDate,
  IsNotEmpty,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

export class SubmitProjectBody {
  @JSONSchema({
    description: 'Submitted URL from student'
  })
  @IsNotEmpty({ message: 'Submission URL is required' })
  @IsUrl({}, { message: 'Submission URL must be a valid URL' })
  submissionURL!: string;

  @IsOptional()
  @JSONSchema({
    description: 'Comment submitted by student from project'
  })
  comment?: string;

  @IsNotEmpty({ message: 'sectionId is required' })
  @IsString()
  sectionId!: string;

  @IsNotEmpty({ message: 'moduleId is required' })
  @IsString()
  moduleId!: string;

  @IsOptional()
  @IsNotEmpty({ message: 'watchItemId is required' })
  @IsString()
  watchItemId!: string;

  @IsNotEmpty({ message: 'courseId is required' })
  @IsString()
  courseId!: string;

  @IsNotEmpty({ message: 'versionId is required' })
  @IsString()
  versionId!: string;

  @IsNotEmpty({ message: 'projectId is required' })
  @IsString()
  projectId!: string;
}
export class SuccessResponse {
  @IsString()
  message!: string;
}
export class CourseVersionParams {
  @IsString()
  courseId!: string;

  @IsString()
  versionId!: string;
}
export class SubmissionResponse {
  @IsString()
  course!: { name: string };

  @IsString()
  courseVersion!: { name: string };

  @IsArray()
  userInfo!: Array<{
    firstName?: string;
    lastName?: string;
    email?: string;
    submissionURL: string;
    comment?: string;
  }>;
}

export const PROJECT_VALIDATORS = [
  SubmitProjectBody,
  SubmissionResponse,
  SuccessResponse,
  CourseVersionParams,
];
