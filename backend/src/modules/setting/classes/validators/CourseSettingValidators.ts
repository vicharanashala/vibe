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
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ICourseSetting,
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

export class SettingsDto {
  @ValidateNested()
  @Type(() => ProctoringSettingsDto)
  proctors: ProctoringSettingsDto;
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
    example: true,
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
  @JSONSchema({
    title: 'Proctoring Component',
    description: 'Component to add to course proctoring',
    enum: Object.values(ProctoringComponent),
    example: ProctoringComponent.CAMERAMICRO,
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @containsAllDetectors()
  @Type(() => DetectorSettingsDto)
  detectors: DetectorSettingsDto[];
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
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @containsAllDetectors()
  @Type(() => DetectorSettingsDto)
  detectors: DetectorSettingsDto[];
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
