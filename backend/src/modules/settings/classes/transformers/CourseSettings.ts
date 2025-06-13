import 'reflect-metadata';
import {Expose, Transform} from 'class-transformer';
import {
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {ID} from '#shared/index.js';
import {ProctoringComponent} from '#shared/database/index.js';

import {ICourseSettings, IDetectorSettings} from '#shared/interfaces/models.js';
import {JSONSchema} from 'class-validator-jsonschema';
import {CreateCourseSettingsBody} from '../index.js';

/**
 * This class represents the settings for a course, including proctoring configurations.
 * It implements the ICourseSettings interface and provides a structure for course settings.
 * The settings include proctoring detectors, which can be enabled or disabled.
 * Each detector has a name that must be a valid ProctoringComponent enum value,
 * and a settings object that contains an enabled boolean.
 *  */

class CourseSettings implements ICourseSettings {
  @Expose()
  @JSONSchema({
    title: 'Course Settings ID',
    description: 'Unique identifier for the course settings',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id?: ID;

  @Expose()
  @JSONSchema({
    title: 'Course Version ID',
    description: 'ID of the course version',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
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
  settings: {
    proctors: {
      detectors: IDetectorSettings[];
    };
  };

  constructor(courseSettingsBody?: CreateCourseSettingsBody) {
    if (courseSettingsBody) {
      this.courseVersionId = courseSettingsBody.courseVersionId;
      this.courseId = courseSettingsBody.courseId;
    }

    let existingDetectors = courseSettingsBody?.settings?.proctors?.detectors;

    if (!Array.isArray(existingDetectors) || existingDetectors.length === 0) {
      existingDetectors = Object.values(ProctoringComponent).map(component => ({
        detectorName: component,
        settings: {enabled: true},
      }));
    }

    this.settings = {
      proctors: {
        detectors: existingDetectors,
      },
    };
  }
}

export {CourseSettings};
