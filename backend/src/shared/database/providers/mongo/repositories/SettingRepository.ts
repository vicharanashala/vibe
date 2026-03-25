import 'reflect-metadata';
import {Collection, ObjectId, UpdateResult, ClientSession} from 'mongodb';
import {injectable, inject} from 'inversify';
import {MongoDatabase} from '../MongoDatabase.js';
import {
  ICourseSetting,
  IRegistrationSettings,
  ISettings,
  IUserSetting,
  ITimeSlot,
  ICohort,
} from '#shared/interfaces/models.js';
import {
  ISettingRepository,
  ProctoringComponent,
} from '#shared/database/index.js';
import {
  AuditingDto,
  CourseSetting,
  DetectorOptionsDto,
  DetectorSettingsDto,
  ProctoringSettingsDto,
  UserSetting,
} from '#root/modules/setting/classes/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {NotFoundError} from 'routing-controllers';

/**
 * Implementation of the Settings Repository for MongoDB.
 * Handles operations on course and user settings collections.
 */

@injectable()
export class SettingRepository implements ISettingRepository {
  // Define types for the collections later.
  private courseSettingsCollection: Collection<CourseSetting>;
  private userSettingsCollection: Collection<UserSetting>;
  private cohortsCollection: Collection<ICohort>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}
  private initialized = false;

  private async init() {
    if (!this.initialized) {
      this.courseSettingsCollection =
        await this.db.getCollection<CourseSetting>('courseSettings');
      this.userSettingsCollection =
        await this.db.getCollection<UserSetting>('userSettings');
      this.cohortsCollection = await this.db.getCollection<ICohort>('cohorts');
      this.initialized = true;

      this.userSettingsCollection.createIndex({
        studentId: 1,
        courseId: 1,
        courseVersionId: 1,
      });

      this.courseSettingsCollection.createIndex({
        courseId: 1,
        courseVersionId: 1,
      });
    }
  }

  async createUserSettings(
    userSettings: IUserSetting,
    session?: ClientSession,
  ): Promise<IUserSetting | null> {
    await this.init();

    const result = await this.userSettingsCollection.insertOne(userSettings, {
      session,
    });

    if (result.acknowledged) {
      const createdSettings = await this.userSettingsCollection.findOne(
        {_id: result.insertedId},
        {session},
      );

      return Object.assign(new UserSetting(), createdSettings) as UserSetting;
    }
  }

  async readUserSettings(
    studentId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IUserSetting | null> {
    await this.init();

    // Check if user settings exist for the student in the course version.
    const userSettings = await this.userSettingsCollection.findOne(
      {
        studentId: new ObjectId(studentId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {session},
    );

    if (!userSettings) {
      return null;
    }

    // If user settings exist, we will return them.
    return Object.assign(new UserSetting(), userSettings) as UserSetting;
  }

  /**
   * Updates user settings for a specific detector.
   * If the detector doesn't exist in the settings, it will be added.
   * @param studentId - ID of the student
   * @param courseId - ID of the course
   * @param courseVersionId - ID of the course version
   * @param detectorName - Name of the detector to update
   * @param detectorSettings - New settings for the detector
   * @param session - Optional MongoDB session for transactions
   * @returns UpdateResult object
   */
  async updateUserSettings(
    studentId: string,
    courseId: string,
    courseVersionId: string,
    detectors: DetectorSettingsDto[],
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();

    // We need to do Upsert operation here.

    // Try updating the existing detector settings
    const result = await this.userSettingsCollection.updateOne(
      {
        studentId: new ObjectId(studentId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {
        $set: {
          'settings.proctors.detectors': detectors,
        },
      },
      {
        session,
      },
    );

    // If no document was updated, it means the detector does not exist, so we need to add it.

    if (result.matchedCount === 0) {
      const addResult = await this.userSettingsCollection.updateOne(
        {
          studentId: new ObjectId(studentId),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
        },
        {
          $addToSet: {
            'settings.proctors.detectors': detectors,
          },
        },
        {
          session,
        },
      );

      return addResult;
    }

    return result;
  }

  // async removeUserProctoring(
  //   studentId: string,
  //   courseId: string,
  //   courseVersionId: string,
  //   detectorName: ProctoringComponent,
  //   session?: ClientSession,
  // ): Promise<boolean | null> {
  //   await this.init();

  //   const result = await this.userSettingsCollection.updateOne(
  //     {
  //       studentId: studentId,
  //       courseId: courseId,
  //       courseVersionId: courseVersionId,
  //       'settings.proctors.detectors.detectorName': detectorName,
  //     },
  //     {
  //       $set: {
  //         'settings.proctors.detectors.$.settings.enabled': false,
  //       },
  //     },
  //     {
  //       session,
  //     },
  //   );

  //   if (result.acknowledged) {
  //     return true;
  //   } else {
  //     return false;
  //   }
  // }

  async createCourseSettings(
    courseSettings: CourseSetting,
    session?: ClientSession,
  ): Promise<ICourseSetting | null> {
    await this.init();
    const result = await this.courseSettingsCollection.insertOne(
      courseSettings,
      {session},
    );
    if (result.acknowledged) {
      const createdSettings = await this.courseSettingsCollection.findOne(
        {
          _id: result.insertedId,
        },
        {session},
      );

      // Create a proper CourseSetting instance without Object.assign
      return new CourseSetting({
        courseId: createdSettings.courseId.toString(),
        courseVersionId: createdSettings.courseVersionId.toString(),
        settings: createdSettings.settings,
      });
    } else {
      return null;
    }
  }

  async readCourseSettings(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<ICourseSetting | null> {
    await this.init();
    const courseSettings = await this.courseSettingsCollection.findOne(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {session},
    );

    if (!courseSettings) {
      return null;
    }
    return Object.assign(new CourseSetting(), courseSettings) as CourseSetting;
  }

  // Rename this method (previously addCourseProctoring)
  /**
   * Updates course settings for a specific detector.
   * If the detector doesn't exist in the settings, it will be added.
   * @param courseId - ID of the course
   * @param courseVersionId - ID of the course version
   * @param detectorName - Name of the detector to update
   * @param detectorSettings - New settings for the detector
   * @param linearProgressionEnabled - Linear progression
   * @param session - Optional MongoDB session for transactions
   * @returns True if update succeeded, false otherwise
   */
  async updateCourseSettings(
    courseId: string,
    courseVersionId: string,
    detectors: DetectorSettingsDto[],
    linearProgressionEnabled: boolean,
    seekForwardEnabled: boolean,
    hpSystem: boolean,
    isPublic: boolean,
    baseHp: number,
    audit: AuditingDto,
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();

    // We need to do Upsert operation here.

    // Try updating the existing detector settings

    // const result = await this.courseSettingsCollection.updateOne(
    //   {
    //     courseId: new ObjectId(courseId),
    //     courseVersionId: new ObjectId(courseVersionId),
    //   },
    //   {
    //     $set: {
    //       'settings.proctors.detectors': detectors,
    //       'settings.linearProgressionEnabled': linearProgressionEnabled,
    //     },
    //   },
    //   {
    //     session,
    //   },
    // );

    // // If no document was updated, it means the detector does not exist, so we need to add it.
    // if (result.matchedCount === 0) {
    //   const addResult = await this.courseSettingsCollection.updateOne(
    //     {
    //       courseId: new ObjectId(courseId),
    //       courseVersionId: new ObjectId(courseVersionId),
    //     },
    //     {
    //       $addToSet: {
    //         'settings.proctors.detectors': detectors,
    //       },
    //     },
    //     {
    //       session,
    //     },
    //   );

    //   return addResult;
    // }

    const result = await this.courseSettingsCollection.updateOne(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {
        $set: {
          'settings.proctors.detectors': detectors,
          'settings.linearProgressionEnabled': linearProgressionEnabled,
          'settings.seekForwardEnabled': seekForwardEnabled,
          'settings.hpSystem': hpSystem,
          'settings.isPublic': isPublic,
          'settings.baseHp': baseHp,
        },
        $push: {
          'settings.audit': audit,
        },
      },
      {
        upsert: true,
        session,
      },
    );

    return result;
  }

  // async removeCourseProctoring(
  //   courseId: string,
  //   courseVersionId: string,
  //   detectorName: ProctoringComponent,
  //   session?: ClientSession,
  // ): Promise<boolean | null> {
  //   this.init();

  //   const result = await this.courseSettingsCollection.updateOne(
  //     {
  //       courseId: courseId,
  //       courseVersionId: courseVersionId,
  //       'settings.proctors.detectors.detectorName': detectorName,
  //     },
  //     {
  //       $set: {
  //         'settings.proctors.detectors.$.settings.enabled': false,
  //       },
  //     },
  //   );

  //   if (result.acknowledged) {
  //     return true;
  //   } else {
  //     return false;
  //   }
  // }

  async addDefaultRegistrationSettings(
    courseId: string,
    courseVersionId: string,
    settings: IRegistrationSettings[],
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();

    const result = await this.courseSettingsCollection.updateOne(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {
        $set: {
          'settings.registration_settings': settings,
        },
      },
      {session},
    );
    return result;
  }

  async updateRegistrationSettings(
    courseId: string,
    versionId: string,
    schemas: {
      jsonSchema: any;
      uiSchema: any;
      isActive: boolean;
      registrationsAutoApproved?: boolean;
      autoapproval_emails?: string[];
    },
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();

    const result = await this.courseSettingsCollection.updateOne(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(versionId),
      },
      {
        $set: {
          'settings.registration.jsonSchema': schemas.jsonSchema,
          'settings.registration.uiSchema': schemas.uiSchema,
          'settings.registration.isActive': schemas.isActive,
          'settings.registration.registrationsAutoApproved':
            schemas.registrationsAutoApproved,
          'settings.registration.autoapproval_emails':
            schemas.autoapproval_emails,
        },
      },
      {session},
    );
    return result;
  }

  async updateCohortSettings(
    courseId: string,
    versionId: string,
    schemas: {cohortSettings: ObjectId[]},
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();

    const result = await this.courseSettingsCollection.updateOne(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(versionId),
      },
      {
        $set: {
          'settings.registration.cohortSettings': schemas.cohortSettings,
        },
      },
      {session},
    );
    return result;
  }

  async updateRegistrationSchemas(
    courseId: string,
    versionId: string,
    schemas: {jsonSchema?: any; uiSchema?: any; isActive?: boolean}, // Partial update for schemas only
    session?: ClientSession,
  ): Promise<UpdateResult> {
    await this.init();

    const updateFields: any = {};
    if (schemas.jsonSchema !== undefined) {
      updateFields['settings.registration.jsonSchema'] = schemas.jsonSchema;
    }
    if (schemas.uiSchema !== undefined) {
      updateFields['settings.registration.uiSchema'] = schemas.uiSchema;
    }
    if (schemas.isActive !== undefined) {
      updateFields['settings.registration.isActive'] = schemas.isActive;
    }

    const result = await this.courseSettingsCollection.updateOne(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(versionId),
      },
      {
        $set: updateFields,
      },
      {session},
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError(
        `Course settings for course ID ${courseId} and version ID ${versionId} not found.`,
      );
    }

    return result;
  }

  async readSettingsSchema(versionId: string, session?: ClientSession) {
    await this.init();
    const result = await this.courseSettingsCollection.findOne(
      {courseVersionId: new ObjectId(versionId)},
      {session},
    );
    const registration = result.settings.registration || {};
    const jsonSchema = registration.jsonSchema;
    const uiSchema = registration.uiSchema;
    const isActive = registration.isActive;
    return {jsonSchema, uiSchema, isActive};
  }

  async deleteCourseSettingsbyVersionId(
    versionId: string,
    session?: ClientSession,
  ) {
    await this.init();
    const result = await this.courseSettingsCollection.deleteOne(
      {courseVersionId: new ObjectId(versionId)},
      {session},
    );
    return result.deletedCount > 0;
  }

  /**
   * Checks if linear progression is enabled for a specific course and version.
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param session - Optional MongoDB session for transactions
   * @returns False if linear progression field is false, true otherwise
   */
  async isLinearProgressionEnabled(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const courseSettings = await this.courseSettingsCollection.findOne(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {
        projection: {
          'settings.linearProgressionEnabled': 1,
          _id: 0,
        },
        session,
      },
    );

    if (courseSettings?.settings?.linearProgressionEnabled == null) {
      return true;
    }

    return courseSettings.settings.linearProgressionEnabled;
  }

  async getPublicCourses(
    enrolledCourseVersionIds: string[],
    skip: number,
    limit: number,
    search: string,
    session?: ClientSession,
  ): Promise<any[]> {
    await this.init();

    const pipeline: any[] = [
      {
        $match: {
          'settings.isPublic': true,
        },
      },

      {
        $lookup: {
          from: 'newCourse',
          localField: 'courseId',
          foreignField: '_id',
          as: 'courseData',
        },
      },

      {
        $unwind: {
          path: '$courseData',
          preserveNullAndEmptyArrays: false,
        },
      },

      {
        $match: {
          'courseData.isDeleted': {$ne: true},
        },
      },

      // lookup version
      {
        $lookup: {
          from: 'newCourseVersion',
          localField: 'courseVersionId',
          foreignField: '_id',
          as: 'courseVersionData',
        },
      },

      {
        $unwind: {
          path: '$courseVersionData',
          preserveNullAndEmptyArrays: false,
        },
      },

      // remove archived versions
      {
        $match: {
          'courseVersionData.versionStatus': {$ne: 'archived'},
        },
      },
    ];

    if (enrolledCourseVersionIds.length > 0) {
      pipeline.push({
        $match: {
          courseVersionId: {
            $nin: enrolledCourseVersionIds.map(id => new ObjectId(id)),
          },
        },
      });
    }

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            {'courseData.name': {$regex: search, $options: 'i'}},
            {'courseData.description': {$regex: search, $options: 'i'}},
          ],
        },
      });
    }

    pipeline.push({
      $project: {
        _id: 0,
        courseId: {$toString: '$courseId'},
        courseVersionId: {$toString: '$courseVersionId'},
        courseName: '$courseData.name',
        courseDescription: '$courseData.description',
        isPublic: '$settings.isPublic',
      },
    });

    pipeline.push({$skip: skip});
    pipeline.push({$limit: limit});

    const result = await this.courseSettingsCollection
      .aggregate(pipeline, {session})
      .toArray();

    return result;
  }

  async countPublicCourses(
    enrolledCourseVersionIds: string[],
    search: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    const pipeline: any[] = [
      {
        $match: {
          'settings.isPublic': true,
        },
      },

      {
        $lookup: {
          from: 'newCourse',
          localField: 'courseId',
          foreignField: '_id',
          as: 'courseData',
        },
      },

      {
        $unwind: {
          path: '$courseData',
          preserveNullAndEmptyArrays: false,
        },
      },

      {
        $match: {
          'courseData.isDeleted': {$ne: true},
        },
      },

      {
        $lookup: {
          from: 'newCourseVersion',
          localField: 'courseVersionId',
          foreignField: '_id',
          as: 'courseVersionData',
        },
      },

      {
        $unwind: {
          path: '$courseVersionData',
          preserveNullAndEmptyArrays: false,
        },
      },

      {
        $match: {
          'courseVersionData.versionStatus': {$ne: 'archived'},
        },
      },
    ];

    if (enrolledCourseVersionIds.length > 0) {
      pipeline.push({
        $match: {
          courseVersionId: {
            $nin: enrolledCourseVersionIds.map(id => new ObjectId(id)),
          },
        },
      });
    }

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            {'courseData.name': {$regex: search, $options: 'i'}},
            {'courseData.description': {$regex: search, $options: 'i'}},
          ],
        },
      });
    }

    pipeline.push({
      $count: 'total',
    });

    const result = await this.courseSettingsCollection
      .aggregate(pipeline, {session})
      .toArray();

    return result.length > 0 ? result[0].total : 0;
  }

  async updateTimeslotsSettings(
    courseId: string,
    courseVersionId: string,
    timeslots: {isActive: boolean; slots: ITimeSlot[]},
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();

    const result = await this.courseSettingsCollection.updateOne(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {
        $set: {
          // Use type assertion to bypass TypeScript error
          'settings.timeslots': timeslots as any,
        },
      },
      {session},
    );
    return result;
  }

  async readTimeslotsSettings(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<{isActive: boolean; slots: ITimeSlot[]} | null> {
    await this.init();

    const courseSettings = await this.courseSettingsCollection.findOne(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {session},
    );

    // Use type assertion to access timeslots property
    const settings = courseSettings?.settings as any;
    const result = settings?.timeslots || null;

    return result;
  }

  async getPublicCatalog(
    enrolledVersionIds: string[],
    enrolledCohortIds: string[],
    skip: number,
    limit: number,
    search: string,
    session?: ClientSession,
  ) {
    await this.init();

    const pipeline: any[] = [
      /*
      -------------------------
      PART 1: PUBLIC COHORTS
      -------------------------
      */

      {
        $match: {
          isPublic: true,
          isDeleted: {$ne: true},
          _id: {$nin: enrolledCohortIds.map(id => new ObjectId(id))},
        },
      },

      {
        $lookup: {
          from: 'newCourseVersion',
          localField: 'courseVersionId',
          foreignField: '_id',
          as: 'version',
        },
      },

      {$unwind: '$version'},

      {
        $lookup: {
          from: 'newCourse',
          localField: 'version.courseId',
          foreignField: '_id',
          as: 'course',
        },
      },

      {$unwind: '$course'},

      {
        $match: {
          'course.isDeleted': {$ne: true},
        },
      },

      {
        $project: {
          type: {$literal: 'COHORT'},

          cohortId: {$toString: '$_id'},
          cohortName: '$name',

          courseId: {$toString: '$course._id'},
          courseName: '$course.name',
          courseDescription: '$course.description',

          courseVersionId: {$toString: '$version._id'},
          versionName: '$version.version',
          versionDescription: '$version.description',
        },
      },

      /*
      -------------------------
      PART 2: PUBLIC COURSES
      -------------------------
      */

      {
        $unionWith: {
          coll: 'courseSettings',
          pipeline: [
            {
              $match: {
                'settings.isPublic': true,
                courseVersionId: {
                  $nin: enrolledVersionIds.map(id => new ObjectId(id)),
                },
              },
            },

            {
              $lookup: {
                from: 'newCourse',
                localField: 'courseId',
                foreignField: '_id',
                as: 'course',
              },
            },

            {$unwind: '$course'},

            {
              $lookup: {
                from: 'newCourseVersion',
                localField: 'courseVersionId',
                foreignField: '_id',
                as: 'version',
              },
            },

            {$unwind: '$version'},

            {
              $match: {
                'course.isDeleted': {$ne: true},
              },
            },

            {
              $project: {
                type: {$literal: 'COURSE'},

                cohortId: null,
                cohortName: null,

                courseId: {$toString: '$course._id'},
                courseName: '$course.name',
                courseDescription: '$course.description',

                courseVersionId: {$toString: '$version._id'},
                versionName: '$version.version',
                versionDescription: '$version.description',
              },
            },
          ],
        },
      },
    ];

    /*
    -------------------------
    SEARCH
    -------------------------
    */

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            {courseName: {$regex: search, $options: 'i'}},
            {versionName: {$regex: search, $options: 'i'}},
            {cohortName: {$regex: search, $options: 'i'}},
          ],
        },
      });
    }

    /*
    -------------------------
    PAGINATION
    -------------------------
    */

    pipeline.push({$skip: skip}, {$limit: limit});

    return await this.cohortsCollection
      .aggregate(pipeline, {session})
      .toArray();
  }

  async getSettingsByVersionIds(
    courseVersionIds: ObjectId[],
    session?: ClientSession,
  ): Promise<ICourseSetting[] | null> {
    await this.init();
    return this.courseSettingsCollection
      .find({courseVersionId: {$in: courseVersionIds}}, {session})
      .toArray();
  }

  async getisHpSystemEnabled(courseVersionId: ObjectId): Promise<boolean> {
    await this.init();
    const result=await this.courseSettingsCollection.findOne({courseVersionId:courseVersionId});
    return result.settings?.hpSystem ?? false;
  }
}
