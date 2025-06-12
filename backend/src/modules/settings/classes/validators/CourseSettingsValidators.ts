import 'reflect-metadata';
import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  ValidateNested,
  IsEnum,
  IsBoolean,
  IsArray,
} from 'class-validator';
import {Type} from 'class-transformer';
import {
  ICourseSettings,
  IDetectorOptions,
  IDetectorSettings,
  ISettings,
  IUserSettings,
} from '#shared/interfaces/models.js';
import {JSONSchema} from 'class-validator-jsonschema';
import {ProctoringComponent} from '#shared/database/interfaces/ISettingsRepository.js';

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
  @ValidateNested({each: true})
  @Type(() => DetectorSettingsDto)
  detectors: DetectorSettingsDto[];
}

export class SettingsDto {
  @ValidateNested()
  @Type(() => ProctoringSettingsDto)
  proctors: ProctoringSettingsDto;
}

// This class represents the validation schema for creating course settings.
export class CreateCourseSettingsBody implements Partial<ICourseSettings> {
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
export class ReadCourseSettingsParams {
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
  courseVersionId: string;
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
  @ValidateNested({each: true})
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
export class CreateUserSettingsBody implements Partial<IUserSettings> {
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

export class ReadUserSettingsParams {
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
  courseVersionId: string;
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
  @ValidateNested({each: true})
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
