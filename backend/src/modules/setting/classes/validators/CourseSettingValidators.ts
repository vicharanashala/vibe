import 'reflect-metadata';
import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  ValidateNested,
  IsEnum,
  IsBoolean,
  IsArray,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  IsDefined,
  IsOptional,
  IsObject,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ICourseSetting,
  ID,
  IDetectorOptions,
  IDetectorSettings,
  ISettings,
  IUserSetting,
} from '#shared/interfaces/models.js';
import { JSONSchema } from 'class-validator-jsonschema';
import { ProctoringComponent } from '#root/shared/database/interfaces/ISettingRepository.js';

/**
 * This file contains classes and DTOs for validating course and user settings related to proctoring.
 *
 */

export class DetectorOptionsDto implements IDetectorOptions {
  @IsBoolean()
  enabled: boolean;
}

export class DetectorSettingsDto implements IDetectorSettings {
  @IsNotEmpty()
  @IsEnum(ProctoringComponent)
  detectorName: ProctoringComponent;
  @IsNotEmpty()
  @Type(() => DetectorOptionsDto)
  settings: DetectorOptionsDto;
}

export class ProctoringSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetectorSettingsDto)
  detectors: DetectorSettingsDto[];
}

export class RegistrationSchema {
  @IsOptional()
  @JSONSchema({
    description: 'Json Schema for Registrstion form',
    type: 'object',
  })
  jsonSchema?: any;

  @IsOptional()
  @IsBoolean()
  @JSONSchema({
    description: 'Indicates whether the registration form is active',
  })
  isActive?: boolean;

  @JSONSchema({
    description: 'UI schema for Registration form',
    type: 'object',
  })
  uiSchema?: any;
}

export class AuditingChangeDto {
  @JSONSchema({
    description: 'State before modification',
    type: 'object',
  })
  before: Record<string, any>;

  @JSONSchema({
    description: 'State after modification',
    type: 'object',
  })
  after: Record<string, any>;
}

export class AuditingDto {
  @JSONSchema({
    description: 'User who modified the settings',
    example: 'user_123',
  })
  userId: ID;

  @JSONSchema({
    description: 'Modification timestamp',
    example: '2026-01-24T10:30:00.000Z',
  })
  @Type(() => Date)
  modifiedAt: Date;

  @ValidateNested()
  @Type(() => AuditingChangeDto)
  changes: AuditingChangeDto;

  @IsString()
  @IsOptional()
  timestamp: string;
}

export class SettingsDto {
  @ValidateNested()
  @Type(() => ProctoringSettingsDto)
  proctors: ProctoringSettingsDto;

  @JSONSchema({
    description: 'Indicates whether linear progression is enabled',
    examples: [true, false],
  })
  @IsBoolean()
  linearProgressionEnabled: boolean;

  @JSONSchema({
    description: 'Indicates whether seek forward is enabled for all videos',
    examples: [true, false],
  })
  @IsBoolean()
  seekForwardEnabled: boolean;
  // jsonSchema?:any
  // uiSchema?:any
  @IsOptional()
  @ValidateNested()
  @Type(() => RegistrationSchema)
  @JSONSchema({
    description: 'Schema Information of the registration form',
    type: 'object',
  })
  registration?: RegistrationSchema;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AuditingDto)
  @JSONSchema({
    description: 'Auditing information for settings modification',
    type: 'object',
  })
  audit?: AuditingDto[];
}

@ValidatorConstraint({ async: false })
export class containsAllDetectorsConstraint
  implements ValidatorConstraintInterface {
  validate(value: Array<any>, args: ValidationArguments) {
    if (!Array.isArray(value)) {
      return false;
    }

    const requiredDetectors = Object.values(ProctoringComponent);
    const detectorNames = value.map(detector => detector.detectorName);
    return requiredDetectors.every(detectorName =>
      detectorNames.includes(detectorName),
    );
  }

  defaultMessage(validationArguments?: ValidationArguments): string {
    return `Array must contain all Proctoring Components. Available components: ${Object.values(
      ProctoringComponent,
    ).join(', ')}`;
  }
}

export function containsAllDetectors(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: containsAllDetectorsConstraint,
    });
  };
}

export class UpdateCourseSettingResponse {
  @JSONSchema({
    description: 'Indicates whether the update was successful',
    type: 'boolean',
    readOnly: true,
  })
  @IsBoolean()
  success: boolean;
}


export class SettingNotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message',
    example:
      'No Setting found with the specified Course. Please verify the course and try again.',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  message: string;
}

// This class represents the validation schema for creating course settings.
export class CreateCourseSettingBody implements Partial<ICourseSetting> {
  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseVersionId: string;

  @JSONSchema({
    title: 'Course Id',
    description: 'Id of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @ValidateNested()
  @Type(() => SettingsDto)
  settings: SettingsDto;

}

// This class represents the validation schema for reading course settings.
export class ReadCourseSettingParams {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  versionId: string;
}

// This class represents the validation schema of Prameters for adding proctoring to a course.
export class AddCourseProctoringParams {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  versionId: string;
}

// This class represents the validation schema of body for adding proctoring to a course.
export class AddCourseProctoringBody {

  @IsNotEmpty()
  @ValidateNested({ each: true })
  @containsAllDetectors()
  @JSONSchema({
    title: 'Proctoring Component',
    description: 'Component to add to course proctoring',
    enum: Object.values(ProctoringComponent),
  })
  @Type(() => DetectorSettingsDto)
  detectors: IDetectorSettings[];


  @IsDefined()
  @IsBoolean()
  @JSONSchema({
    description: 'Student should follow the cours linearly if this is enabled'
  })
  linearProgressionEnabled: boolean;

  @IsDefined()
  @IsBoolean()
  @JSONSchema({
    description: 'Allow students to seek forward in all videos if this is enabled'
  })
  seekForwardEnabled: boolean;

}

// This class represents the validation schema of Parameters for removing proctoring from a course.
export class RemoveCourseProctoringParams {
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseVersionId: string;
}

// This class represents the validation schema of body for removing proctoring from a course.
export class RemoveCourseProctoringBody {
  @JSONSchema({
    title: 'Proctoring Component',
    description: 'Component to remove from course proctoring',
    enum: Object.values(ProctoringComponent),
    example: ProctoringComponent.CAMERAMICRO,
  })
  @IsNotEmpty()
  @IsEnum(ProctoringComponent)
  detectorName: ProctoringComponent;
}

// This class represents the validation schema for creating user settings.
export class CreateUserSettingBody implements Partial<IUserSetting> {
  @JSONSchema({
    title: 'Student ID',
    description: 'ID of the student',
    example: '60d5ec49b3f1c8e4a8f8b8c5',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  studentId: string;

  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseVersionId: string;

  @ValidateNested()
  @Type(() => SettingsDto)
  settings: SettingsDto;
}

export class ReadUserSettingParams {
  @JSONSchema({
    title: 'Student ID',
    description: 'ID of the student',
    example: '60d5ec49b3f1c8e4a8f8b8c5',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  studentId: string;

  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  versionId: string;
}

// This class represents the validation schema of Parameters for adding proctoring to a user Setting.
export class AddUserProctoringParams {
  @JSONSchema({
    title: 'Student ID',
    description: 'ID of the student',
    example: '60d5ec49b3f1c8e4a8f8b8c5',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  studentId: string;

  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  versionId: string;
}

// This class represents the validation schema of body for adding proctoring to a user Setting.
export class AddUserProctoringBody {
  @JSONSchema({
    title: 'Proctoring Component',
    description: 'Component to add to user proctoring',
    enum: Object.values(ProctoringComponent),
    example: ProctoringComponent.CAMERAMICRO,
  })

  @IsNotEmpty()
  @ValidateNested({ each: true })
  @containsAllDetectors()
  @Type(() => DetectorSettingsDto)
  detectors: IDetectorSettings[];
}

// This class represents the validation schema of Parameters for removing proctoring from a user Setting.
export class RemoveUserProctoringParams {
  @JSONSchema({
    title: 'Student ID',
    description: 'ID of the student',
    example: '60d5ec49b3f1c8e4a8f8b8c5',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  studentId: string;

  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseVersionId: string;
}

export class RemoveUserProctoringBody {
  @JSONSchema({
    title: 'Proctoring Component',
    description: 'Component to remove from user proctoring',
    enum: Object.values(ProctoringComponent),
    example: ProctoringComponent.CAMERAMICRO,
  })
  @IsNotEmpty()
  @IsEnum(ProctoringComponent)
  detectorName: ProctoringComponent;
}

export class UpdateSettingResponse {

  @JSONSchema({
    description: 'Indicates whether the update was successful',
    type: 'boolean',
    readOnly: true,
  })
  @IsBoolean()
  acknowledged: boolean;

  @JSONSchema({
    description: 'Number of documents modified',
    type: 'number',
    readOnly: true,
  })
  @IsNumber()
  modifiedCount: number;

  @JSONSchema({
    description: 'Number of documents upserted',
    type: 'number',
    readOnly: true,
  })
  @IsNumber()
  upsertedCount: number;

  @JSONSchema({
    description: 'Number of documents matched',
    type: 'number',
    readOnly: true,
  })
  @IsNumber()
  matchedCount: number;
}