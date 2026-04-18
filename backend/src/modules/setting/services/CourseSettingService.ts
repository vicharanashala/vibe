import { injectable, inject } from 'inversify';
import { GLOBAL_TYPES } from '#root/types.js';
import {
  CourseSetting,
  DetectorOptionsDto,
  DetectorSettingsDto,
  ProctoringSettingsDto,
  SettingsDto,
} from '#root/modules/setting/classes/index.js';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {
  BaseService,
  MongoDatabase,
  ISettingRepository,
  ICourseRepository,
} from '#shared/index.js';


/**
 * Service responsible for course settings operations.
 * Handles business logic for creating, reading, and updating course settings.
 */
@injectable()
class CourseSettingService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.SettingRepo)
    private readonly settingsRepo: ISettingRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  /**
   * Creates new course settings for a course and version.
   * Validates that the course and version exist before creating settings.
   * @param courseSettings - The course settings to create
   * @returns The created course settings
   * @throws NotFoundError if course or course version doesn't exist
   * @throws InternalServerError if creation fails
   */
  async createCourseSettings(
    courseSettings: CourseSetting,
  ): Promise<CourseSetting> {
    return this._withTransaction(async session => {
      // Check if the course exists
      const course = await this.courseRepo.read(
        courseSettings.courseId.toString(),
        session,
      );

      if (!course) {
        throw new NotFoundError(
          `Course with ID ${courseSettings.courseId} not found.`,
        );
      }

      // check if courseVersion is valid

      const courseVersion = await this.courseRepo.readVersion(
        courseSettings.courseVersionId.toString(),
        session,
      );

      if (!courseVersion) {
        throw new NotFoundError(
          `Course version for course Version ID ${courseSettings.courseVersionId} not found.`,
        );
      }

      // check if courseSettings already exists for the course

      const existingSettings = await this.settingsRepo.readCourseSettings(
        courseSettings.courseId.toString(),
        courseSettings.courseVersionId.toString(),
        session,
      );

      if (existingSettings) {
        throw new BadRequestError(
          `Course settings for course ID ${courseSettings.courseId} and version ID ${courseSettings.courseVersionId} already exist.`,
        );
      }

      const createdSettings = await this.settingsRepo.createCourseSettings(
        courseSettings,
        session,
      );

      if (!createdSettings) {
        throw new InternalServerError(
          'Failed to create course settings. Please try again later.',
        );
      }

      return createdSettings;
    });
  }

  async readCourseSettings(
    courseId: string,
    courseVersionId: string,
  ): Promise<CourseSetting | null> {
    return this._withTransaction(async session => {
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

      return Object.assign(new CourseSetting(), courseSettings);
    });
  }

  async updateCourseSettings(
    courseId: string,
    courseVersionId: string,
    detectors: DetectorSettingsDto[],
  ): Promise<boolean> {
    return this._withTransaction(async session => {
      // Check if the course settings exist
      const courseSettings = await this.settingsRepo.readCourseSettings(
        courseId,
        courseVersionId,
        session,
      );

      if (!courseSettings) {
        const settings = new SettingsDto();
        settings.proctors = new ProctoringSettingsDto();
        settings.proctors.detectors = detectors;

        const result = await this.createCourseSettings(new CourseSetting({
          courseVersionId,
          courseId,
          settings: settings
        }))

        if (!result) {
          throw new InternalServerError(
            'Failed to create course settings. Please try again later.',
          );
        }
        return result._id ? true : false;
      }

      const result = await this.settingsRepo.updateCourseSettings(
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

  // Not needed, but kept for consistency with the original code
  /*
  async removeCourseProctoring(
    courseId: string,
    courseVersionId: string,
    detectorName: ProctoringComponent,
  ): Promise<boolean> {
    return this._withTransaction(async session => {
      // Check if the course settings exist
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

      const result = await this.settingsRepo.removeCourseProctoring(
        courseId,
        courseVersionId,
        detectorName,
        session,
      );

      if (!result) {
        throw new InternalServerError(
          'Failed to remove proctoring component. Please try again later.',
        );
      }

      return result.acknowledged || false;
    });
  }
    */
}

export { CourseSettingService };
