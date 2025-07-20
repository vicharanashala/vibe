import {injectable, inject} from 'inversify';
import {BaseService} from '#shared/classes/BaseService.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {ISettingRepository} from '#root/shared/database/interfaces/ISettingRepository.js';
import {UserSetting} from '../../setting/classes/transformers/UserSetting.js';
import {ProctoringComponent} from '#root/shared/database/interfaces/ISettingRepository.js';
import {NotFoundError, InternalServerError} from 'routing-controllers';
import {
  ICourseRepository,
  IUserRepository,
  MongoDatabase,
} from '#root/shared/index.js';
import {
  DetectorOptionsDto,
  DetectorSettingsDto,
} from '#root/modules/setting/classes/index.js';

@injectable()
class UserSettingService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.SettingRepo)
    private readonly settingsRepo: ISettingRepository,

    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepo: IUserRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  async createUserSettings(userSettings: UserSetting): Promise<UserSetting> {
    return this._withTransaction(async session => {
      // Check if the user is valid

      const studentId = await this.userRepo.findById(
        userSettings.studentId.toString(),
      );

      if (!studentId) {
        throw new NotFoundError(
          `Student with ID ${userSettings.studentId} not found.`,
        );
      }

      // Check if the course exists
      const course = await this.courseRepo.read(
        userSettings.courseId.toString(),
        session,
      );

      if (!course) {
        throw new NotFoundError(
          `Course with ID ${userSettings.courseId} not found.`,
        );
      }

      // Check if the course version is valid
      const courseVersion = await this.courseRepo.readVersion(
        userSettings.courseVersionId.toString(),
        session,
      );

      if (!courseVersion) {
        throw new NotFoundError(
          `Course version for course ID ${userSettings.courseId} not found.`,
        );
      }

      // Check if user settings already exist for the student in the course version.

      const existingSettings = await this.settingsRepo.readUserSettings(
        userSettings.studentId.toString(),
        userSettings.courseId.toString(),
        userSettings.courseVersionId.toString(),
        session,
      );

      if (existingSettings) {
        throw new InternalServerError(
          `User settings for student ID ${userSettings.studentId}, course ID ${userSettings.courseId} and version ID ${userSettings.courseVersionId} already exist.`,
        );
      }

      const createdSettings = await this.settingsRepo.createUserSettings(
        userSettings,
        session,
      );

      if (!createdSettings) {
        throw new InternalServerError(
          'Failed to create user settings. Please try again later.',
        );
      }

      return createdSettings;
    });
  }

  async readUserSettings(
    studentId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<UserSetting | null> {
    return this._withTransaction(async session => {
      // Check if user settings exist for the student in the course version.
      const userSettings = await this.settingsRepo.readUserSettings(
        studentId,
        courseId,
        courseVersionId,
        session,
      );

      // If user settings do not exist, we will return the course settings.
      if (!userSettings) {
        const courseSettings = await this.settingsRepo.readCourseSettings(
          courseId,
          courseVersionId,
          session,
        );

        if (!courseSettings) {
          throw new NotFoundError(
            `Course settings for course ID ${courseId} and version ID ${courseVersionId} not found.`,
          );
        }
        return Object.assign(
          new UserSetting({
            studentId: studentId,
            courseId: courseId,
            courseVersionId: courseVersionId,
            settings: courseSettings.settings,
          }) as UserSetting,
        );
      }

      // If user settings exist, we will return them.
      return Object.assign(new UserSetting(), userSettings);
    });
  }

  async updateUserSettings(
    studentId: string,
    courseId: string,
    courseVersionId: string,
    detectors: DetectorSettingsDto[],
  ): Promise<boolean> {
    return this._withTransaction(async session => {
      // Check if the user settings exist
      const userSettings = await this.settingsRepo.readUserSettings(
        studentId,
        courseId,
        courseVersionId,
        session,
      );

      if (!userSettings) {
        throw new NotFoundError(
          `User settings for student ID ${studentId}, course ID ${courseId} and version ID ${courseVersionId} not found.`,
        );
      }

      const result = await this.settingsRepo.updateUserSettings(
        studentId,
        courseId,
        courseVersionId,
        detectors,
        session,
      );

      if (!result) {
        throw new InternalServerError(
          'Failed to add proctoring component. Please try again later.',
        );
      }

      return result.acknowledged || false;
    });
  }

  // This endpoint is not used in the current implementation, but it is kept for future use.
  /*
  async removeUserProctoring(
    studentId: string,
    courseId: string,
    courseVersionId: string,
    component: ProctoringComponent,
  ): Promise<boolean> {
    return this._withTransaction(async session => {
      // Check if the user settings exist
      const userSettings = await this.settingsRepo.readUserSettings(
        studentId,
        courseId,
        courseVersionId,
        session,
      );

      if (!userSettings) {
        throw new NotFoundError(
          `User settings for student ID ${studentId}, course ID ${courseId} and version ID ${courseVersionId} not found.`,
        );
      }

      const result = await this.settingsRepo.removeUserProctoring(
        studentId,
        courseId,
        courseVersionId,
        component,
        session,
      );

      if (!result) {
        throw new InternalServerError(
          'Failed to remove proctoring component. Please try again later.',
        );
      }

      return result;
    });
  }
  */
}

export {UserSettingService};
