import 'reflect-metadata';
import {Collection, ObjectId, UpdateResult, ClientSession} from 'mongodb';
import {injectable, inject} from 'inversify';
import {MongoDatabase} from '../MongoDatabase.js';
import {ICourseSetting, IUserSetting} from '#shared/interfaces/models.js';
import {
  ISettingRepository,
  ProctoringComponent,
} from '#shared/database/index.js';
import {
  CourseSetting,
  DetectorOptionsDto,
  DetectorSettingsDto,
  ProctoringSettingsDto,
  UserSetting,
} from '#root/modules/setting/classes/index.js';
import {GLOBAL_TYPES} from '#root/types.js';

/**
 * Implementation of the Settings Repository for MongoDB.
 * Handles operations on course and user settings collections.
 */

@injectable()
export class SettingRepository implements ISettingRepository {
  // Define types for the collections later.
  private courseSettingsCollection: Collection<CourseSetting>;
  private userSettingsCollection: Collection<UserSetting>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}
  private initialized = false;

  private async init() {
    if (!this.initialized) {
      this.courseSettingsCollection =
        await this.db.getCollection<CourseSetting>('courseSettings');
      this.userSettingsCollection =
        await this.db.getCollection<UserSetting>('userSettings');
      this.initialized = true;
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

      return Object.assign(
        new CourseSetting(),
        createdSettings,
      ) as CourseSetting;
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
    return Object.assign(
      new CourseSetting(),
      courseSettings,
    ) as CourseSetting;
  }

  // Rename this method (previously addCourseProctoring)
  /**
   * Updates course settings for a specific detector.
   * If the detector doesn't exist in the settings, it will be added.
   * @param courseId - ID of the course
   * @param courseVersionId - ID of the course version
   * @param detectorName - Name of the detector to update
   * @param detectorSettings - New settings for the detector
   * @param session - Optional MongoDB session for transactions
   * @returns True if update succeeded, false otherwise
   */
  async updateCourseSettings(
    courseId: string,
    courseVersionId: string,
    detectors: DetectorSettingsDto[],
    session?: ClientSession,
  ): Promise<UpdateResult | null> {
    await this.init();

    // We need to do Upsert operation here.

    // Try updating the existing detector settings

    const result = await this.courseSettingsCollection.updateOne(
      {
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
      const addResult = await this.courseSettingsCollection.updateOne(
        {
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
}
