// // import 'reflect-metadata';
// // import {Expose, Transform} from 'class-transformer';
// // import {
// //   ObjectIdToString,
// //   StringToObjectId,
// // } from '#shared/constants/transformerConstants.js';
// // import {ID} from '#shared/index.js';
// // import {ProctoringComponent} from '#shared/database/index.js';

// // import {ICourseSetting, IDetectorSettings} from '#shared/interfaces/models.js';
// // import {JSONSchema} from 'class-validator-jsonschema';
// // import {CreateCourseSettingBody} from '../index.js';
// // import {ObjectId} from 'mongodb';
// // import {IsBoolean, IsDefined, IsNotEmpty, IsOptional} from 'class-validator';

// // /**
// //  * This class represents the settings for a course, including proctoring configurations.
// //  * It implements the ICourseSettings interface and provides a structure for course settings.
// //  * The settings include proctoring detectors, which can be enabled or disabled.
// //  * Each detector has a name that must be a valid ProctoringComponent enum value,
// //  * and a settings object that contains an enabled boolean.
// //  *  */

// // class CourseSetting implements ICourseSetting {
// //   @Expose()
// //   @JSONSchema({
// //     title: 'Course Settings ID',
// //     description: 'Unique identifier for the course settings',
// //     example: '60d5ec49b3f1c8e4a8f8b8c1',
// //     type: 'string',
// //   })
// //   @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
// //   @Transform(StringToObjectId.transformer, {toClassOnly: true})
// //   @IsOptional()
// //   _id?: ID;

// //   @Expose()
// //   @JSONSchema({
// //     title: 'Course Version ID',
// //     description: 'ID of the course version',
// //     example: '60d5ec49b3f1c8e4a8f8b8c1',
// //     type: 'string',
// //   })
// //   @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
// //   @Transform(StringToObjectId.transformer, {toClassOnly: true})
// //   @IsNotEmpty()
// //   courseVersionId: ID;

// //   @Expose()
// //   @JSONSchema({
// //     title: 'Course ID',
// //     description: 'Id of the course',
// //     example: '60d5ec49b3f1c8e4a8f8b8c3',
// //     type: 'string',
// //   })
// //   @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
// //   @Transform(StringToObjectId.transformer, {toClassOnly: true})
// //   @IsNotEmpty()
// //   courseId: ID;

// //   @Expose()
// //   @JSONSchema({
// //     title: 'Settings',
// //     description: 'Settings for the course',
// //     type: 'object',
// //     properties: {
// //       proctors: {
// //         type: 'object',
// //         properties: {
// //           detectors: {
// //             type: 'array',
// //             items: {
// //               type: 'object',
// //               properties: {
// //                 detectorName: {
// //                   type: 'string',
// //                   enum: Object.values(ProctoringComponent),
// //                 },
// //                 settings: {
// //                   type: 'object',
// //                   properties: {
// //                     enabled: {
// //                       type: 'boolean',
// //                     },
// //                     // Additional settings can be added here as needed
// //                   },
// //                 },
// //               },
// //             },
// //           },
// //         },
// //       },
// //     },
// //   })
// //   @IsNotEmpty()
// //   settings: {
// //     proctors: {
// //       detectors: IDetectorSettings[];
// //     };

// //   linearProgressionEnabled: boolean;
// //   jsonSchema?: any; // Optional
// //   uiSchema?: any;
// //   };

// //   constructor(courseSettingsBody?: CreateCourseSettingBody) {
// //     if (courseSettingsBody) {
// //       this.courseVersionId = new ObjectId(courseSettingsBody.courseVersionId);
// //       this.courseId = new ObjectId(courseSettingsBody.courseId);
// //     }

// //     let existingDetectors = courseSettingsBody?.settings?.proctors?.detectors;

// //     if (!Array.isArray(existingDetectors) || existingDetectors.length === 0) {
// //       existingDetectors = Object.values(ProctoringComponent).map(component => ({
// //         detectorName: component,
// //         settings: {enabled: true},
// //       }));
// //     }

// //     this.settings = {
// //       proctors: {
// //         detectors: existingDetectors,
// //       },
// //       linearProgressionEnabled: courseSettingsBody?.settings?.linearProgressionEnabled ?? false,
// //       jsonSchema: courseSettingsBody?.settings.jsonSchema,
// //       uiSchema: courseSettingsBody?.settings?.uiSchema,
// //     };

// //   }
// // }

// // export {CourseSetting};

// import 'reflect-metadata';
// import { Expose, Transform } from 'class-transformer';
// import {
//   ObjectIdToString,
//   StringToObjectId,
// } from '#shared/constants/transformerConstants.js';
// import { ID } from '#shared/index.js';
// import { ProctoringComponent } from '#shared/database/index.js';

// import { ICourseSetting, IDetectorSettings } from '#shared/interfaces/models.js';
// import { JSONSchema } from 'class-validator-jsonschema';
// import { CreateCourseSettingBody } from '../index.js';
// import { ObjectId } from 'mongodb';
// import { IsBoolean, IsDefined, IsNotEmpty, IsOptional } from 'class-validator';

// /**
//  * This class represents the settings for a course, including proctoring configurations.
//  * It implements the ICourseSettings interface and provides a structure for course settings.
//  * The settings include proctoring detectors, which can be enabled or disabled.
//  * Each detector has a name that must be a valid ProctoringComponent enum value,
//  * and a settings object that contains an enabled boolean.
//  *
//  * Updated to include jsonSchema and uiSchema for registration form configuration.
//  */

// class CourseSetting implements ICourseSetting {
//   @Expose()
//   @JSONSchema({
//     title: 'Course Settings ID',
//     description: 'Unique identifier for the course settings',
//     example: '60d5ec49b3f1c8e4a8f8b8c1',
//     type: 'string',
//   })
//   @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
//   @Transform(StringToObjectId.transformer, { toClassOnly: true })
//   @IsOptional()
//   _id?: ID;

//   @Expose()
//   @JSONSchema({
//     title: 'Course Version ID',
//     description: 'ID of the course version',
//     example: '60d5ec49b3f1c8e4a8f8b8c1',
//     type: 'string',
//   })
//   @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
//   @Transform(StringToObjectId.transformer, { toClassOnly: true })
//   @IsNotEmpty()
//   courseVersionId: ID;

//   @Expose()
//   @JSONSchema({
//     title: 'Course ID',
//     description: 'Id of the course',
//     example: '60d5ec49b3f1c8e4a8f8b8c3',
//     type: 'string',
//   })
//   @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
//   @Transform(StringToObjectId.transformer, { toClassOnly: true })
//   @IsNotEmpty()
//   courseId: ID;

//   @Expose()
//   @JSONSchema({
//     title: 'Settings',
//     description: 'Settings for the course',
//     type: 'object',
//     properties: {
//       proctors: {
//         type: 'object',
//         properties: {
//           detectors: {
//             type: 'array',
//             items: {
//               type: 'object',
//               properties: {
//                 detectorName: {
//                   type: 'string',
//                   enum: Object.values(ProctoringComponent),
//                 },
//                 settings: {
//                   type: 'object',
//                   properties: {
//                     enabled: {
//                       type: 'boolean',
//                     },
//                     // Additional settings can be added here as needed
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//       linearProgressionEnabled: {
//         type: 'boolean',
//       },
//       // Added JSONSchema for jsonSchema (example structure for a basic registration form)
//       jsonSchema: {
//         type: 'object',
//         description: 'JSON Schema for registration form',
//         example: {
//           type: 'object',
//           properties: {
//             name: { type: 'string', title: 'Full Name' },
//             email: { type: 'string', format: 'email', title: 'Email' },
//             phone: { type: 'string', title: 'Phone' },
//           },
//           required: ['name', 'email'],
//         },
//       },
//       // Added JSONSchema for uiSchema (example for JSON Forms layout)
//       uiSchema: {
//         type: 'object',
//         description: 'UI Schema for registration form layout',
//         example: {
//           type: 'VerticalLayout',
//           elements: [
//             { type: 'Control', scope: '#/properties/name' },
//             { type: 'Control', scope: '#/properties/email' },
//             { type: 'Control', scope: '#/properties/phone' },
//           ],
//         },
//       },
//     },
//   })
//   @IsNotEmpty()
//   settings: {
//     proctors: {
//       detectors: IDetectorSettings[];
//     };
//     linearProgressionEnabled: boolean;
//     jsonSchema?: any; // Optional JSON Schema for the registration form
//     uiSchema?: any;   // Optional UI Schema for the registration form layout
//   };

//   constructor(courseSettingsBody?: CreateCourseSettingBody) {
//     if (courseSettingsBody) {
//       this.courseVersionId = new ObjectId(courseSettingsBody.courseVersionId);
//       this.courseId = new ObjectId(courseSettingsBody.courseId);
//     }

//     let existingDetectors = courseSettingsBody?.settings?.proctors?.detectors;

//     if (!Array.isArray(existingDetectors) || existingDetectors.length === 0) {
//       existingDetectors = Object.values(ProctoringComponent).map(component => ({
//         detectorName: component,
//         settings: { enabled: true },
//       }));
//     }

//     this.settings = {
//       proctors: {
//         detectors: existingDetectors,
//       },
//       linearProgressionEnabled: courseSettingsBody?.settings?.linearProgressionEnabled ?? false,
//       // Preserve jsonSchema and uiSchema from input body if provided
//       jsonSchema: courseSettingsBody?.settings?.jsonSchema,
//       uiSchema: courseSettingsBody?.settings?.uiSchema,
//     };
//   }
// }

// export { CourseSetting };

import 'reflect-metadata';
import {Expose, Transform} from 'class-transformer';
import {
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {ID} from '#shared/index.js';
import {ProctoringComponent} from '#shared/database/index.js';
import {ICourseSetting, IDetectorSettings} from '#shared/interfaces/models.js';
import {JSONSchema} from 'class-validator-jsonschema';
import {CreateCourseSettingBody} from '../index.js';
import {ObjectId} from 'mongodb';
import {IsNotEmpty, IsOptional} from 'class-validator';

/**
 * Updated CourseSetting class
 * Includes registration object (jsonSchema + uiSchema)
 */
class CourseSetting implements ICourseSetting {
  @Expose()
  @JSONSchema({
    title: 'Course Settings ID',
    description: 'Unique identifier for the course settings',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
  })
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  @IsOptional()
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
  @IsNotEmpty()
  courseVersionId: ID;

  @Expose()
  @JSONSchema({
    title: 'Course ID',
    description: 'ID of the course',
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
                    enabled: {type: 'boolean'},
                  },
                },
              },
            },
          },
        },
      },
      linearProgressionEnabled: {type: 'boolean'},
      seekForwardEnabled: {type: 'boolean'},
      registration: {
        type: 'object',
        description: 'Registration configuration schemas',
        properties: {
          jsonSchema: {
            type: 'object',
            description: 'JSON Schema for registration form',
            example: {
              type: 'object',
              properties: {
                name: {type: 'string', title: 'Full Name'},
                email: {type: 'string', format: 'email', title: 'Email'},
              },
              required: ['name', 'email'],
            },
          },
          uiSchema: {
            type: 'object',
            description: 'UI Schema for registration form layout',
            example: {
              type: 'VerticalLayout',
              elements: [
                {type: 'Control', scope: '#/properties/name'},
                {type: 'Control', scope: '#/properties/email'},
              ],
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
    linearProgressionEnabled: boolean;
    seekForwardEnabled: boolean;
    hpSystem?: boolean;
    isPublic?: boolean;
    baseHp?: number;
    registration?: {
      jsonSchema?: any;
      uiSchema?: any;
      isActive?: boolean;
    };
  };

  constructor(courseSettingsBody?: CreateCourseSettingBody) {
    if (courseSettingsBody) {
      this.courseVersionId = new ObjectId(courseSettingsBody.courseVersionId);
      this.courseId = new ObjectId(courseSettingsBody.courseId);
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
      linearProgressionEnabled:
        courseSettingsBody?.settings?.linearProgressionEnabled ?? true,
      seekForwardEnabled:
        courseSettingsBody?.settings?.seekForwardEnabled ?? false,
      hpSystem: courseSettingsBody?.settings?.hpSystem ?? false,
      isPublic: courseSettingsBody?.settings?.isPublic ?? false,
      baseHp: courseSettingsBody?.settings?.baseHp ?? 0,
      registration: {
        jsonSchema: courseSettingsBody?.settings?.registration?.jsonSchema,
        uiSchema: courseSettingsBody?.settings?.registration?.uiSchema,
        isActive: courseSettingsBody?.settings?.registration?.isActive ?? true,
      },
    };
  }
}

export {CourseSetting};
