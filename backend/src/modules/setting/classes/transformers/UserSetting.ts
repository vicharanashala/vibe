import 'reflect-metadata';
import {Expose, Transform} from 'class-transformer';
import {
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {ID} from '#shared/index.js';
import {ProctoringComponent} from '#shared/database/index.js';

import {IDetectorSettings, IUserSetting} from '#shared/interfaces/models.js';
import {JSONSchema} from 'class-validator-jsonschema';
import {CreateUserSettingBody} from '../index.js';
import {ObjectId} from 'mongodb';
import { IsNotEmpty, IsOptional } from 'class-validator';

/**
 * This class represents the settings for a user in a course, including proctoring configurations.
 * It implements the IUserSettings interface and provides a structure for user settings.
 * The settings include proctoring detectors, which can be enabled or disabled.
 * Each detector has a name that must be a valid ProctoringComponent enum value,
 * and a settings object that contains an enabled boolean.
 */

class UserSetting implements IUserSetting {
  @Expose()
  @JSONSchema({
    title: 'User Settings ID',
    description: 'Unique identifier for the user settings',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  @IsOptional()
  _id?: ID;

  @Expose()
  @JSONSchema({
    title: 'Student ID',
    description: 'ID of the student',
    example: '60d5ec49b3f1c8e4a8f8b8c5',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  @IsNotEmpty()
  studentId: ID;

  @Expose()
  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  @IsNotEmpty()
  courseVersionId: ID;

  @Expose()
  @JSONSchema({
    title: 'Course ID',
    description: 'Id of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  @IsNotEmpty()
  courseId: ID;

  @Expose()
  @JSONSchema({
    title: 'Settings',
    description: 'Settings for the course',
    type: 'object',
    properties: {
      proctors: {
        type: 'object',
        properties: {
          detectors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                detectorName: {
                  type: 'string',
                  enum: Object.values(ProctoringComponent),
                },
                settings: {
                  type: 'object',
                  properties: {
                    enabled: {
                      type: 'boolean',
                    },
                    // Additional settings can be added here as needed
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @IsNotEmpty()
  settings: {
    proctors: {
      detectors: IDetectorSettings[];
    };
  };

  constructor(userSettingsBody?: CreateUserSettingBody) {
    if (userSettingsBody) {
      this.studentId = new ObjectId(userSettingsBody.studentId);
      this.courseVersionId = new ObjectId(userSettingsBody.courseVersionId);
      this.courseId = new ObjectId(userSettingsBody.courseId);
    }

    let existingDetectors = userSettingsBody?.settings?.proctors?.detectors;

    if (!Array.isArray(existingDetectors) || existingDetectors.length === 0) {
      existingDetectors = Object.values(ProctoringComponent).map(component => ({
        detectorName: component,
        settings: {
          enabled: true, // Default setting
        },
      }));
    }

    this.settings = {
      proctors: {
        detectors: existingDetectors,
      },
    };
  }
}

export {UserSetting};
