import {injectable, inject} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  AuditingDto,
  CourseSetting,
  DetectorOptionsDto,
  DetectorSettingsDto,
  ProctoringSettingsDto,
  SettingsDto,
} from '#root/modules/setting/classes/index.js';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {
  BaseService,
  MongoDatabase,
  ISettingRepository,
  ICourseRepository,
} from '#shared/index.js';
import {ISettings} from '#shared/interfaces/models.js';
import {getISTFormattedTimestamp} from '#root/utils/toISOFormat.js';
import {ClientSession, ObjectId} from 'mongodb';

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
      let courseSettings = await this.settingsRepo.readCourseSettings(
        courseId,
        courseVersionId,
        session,
      );

      if (!courseSettings) {
        // Create new settings as in updateCourseSettings
        const settings = new SettingsDto();
        settings.proctors = new ProctoringSettingsDto();
        settings.proctors.detectors = [];
        settings.linearProgressionEnabled = true;
        settings.seekForwardEnabled = false;
        settings.isPublic = false;
        settings.hpSystem = false;
        settings.registration = {isActive: true};
        settings.timeslots = {isActive: false, slots: []};
        settings.baseHp = 0;
        settings.randomizeItems = false;

        const created = await this.createCourseSettings(
          new CourseSetting({
            courseVersionId,
            courseId,
            settings,
          }),
        );

        if (!created) {
          throw new InternalServerError(
            'Failed to create course settings. Please try again later.',
          );
        }
        return created;
      }

      return Object.assign(new CourseSetting(), courseSettings);
    });
  }

  async updateCourseSettings(
    courseId: string,
    courseVersionId: string,
    detectors: DetectorSettingsDto[],
    linearProgressionEnabled: boolean,
    seekForwardEnabled: boolean,
    hpSystem: boolean,
    isPublic: boolean,
    baseHp: number,
    randomizeItems: boolean,
    userId: string,
    crowdsourcedQuestionSubmissionEnabled: boolean = false,
  ): Promise<boolean> {
    return this._withTransaction(async session => {
      const versionStatus =
        await this.courseRepo.getCourseVersionStatus(courseVersionId);

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          "This course version is inactive, you can't update settings",
        );
      }
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
        settings.linearProgressionEnabled = linearProgressionEnabled;
        settings.seekForwardEnabled = seekForwardEnabled;
        settings.isPublic = isPublic;
        settings.hpSystem = hpSystem;
        settings.baseHp = baseHp;
        settings.randomizeItems = randomizeItems;
        settings.crowdsourcedQuestionSubmissionEnabled =
          crowdsourcedQuestionSubmissionEnabled;

        settings.audit = [
          {
            userId: new ObjectId(userId),
            modifiedAt: new Date(),
            timestamp: getISTFormattedTimestamp(),
            changes: {
              before: null,
              after: {
                detectors,
                linearProgressionEnabled,
                seekForwardEnabled,
                isPublic,
                hpSystem,
                baseHp,
                randomizeItems,
                crowdsourcedQuestionSubmissionEnabled,
              },
            },
          },
        ];
        // for linear progression
        settings.linearProgressionEnabled = linearProgressionEnabled;

        const result = await this.createCourseSettings(
          new CourseSetting({
            courseVersionId,
            courseId,
            settings,
          }),
        );

        if (!result) {
          throw new InternalServerError(
            'Failed to create course settings. Please try again later.',
          );
        }
        return result._id ? true : false;
      }
      if(linearProgressionEnabled === true)
        randomizeItems=false;

      const beforeState = {
        detectors: courseSettings.settings?.proctors?.detectors,
        linearProgressionEnabled:
          courseSettings.settings?.linearProgressionEnabled,
        seekForwardEnabled: courseSettings.settings?.seekForwardEnabled,
        isPublic: courseSettings.settings?.isPublic,
        hpSystem: courseSettings.settings?.hpSystem,
        baseHp: courseSettings.settings?.baseHp,
        randomizeItems: courseSettings.settings?.randomizeItems,
        crowdsourcedQuestionSubmissionEnabled:
          courseSettings.settings?.crowdsourcedQuestionSubmissionEnabled,
      };

      const afterState = {
        detectors,
        linearProgressionEnabled,
        seekForwardEnabled,
        isPublic,
        hpSystem,
        baseHp,
        randomizeItems,
        crowdsourcedQuestionSubmissionEnabled,
      };

      const audit: AuditingDto = {
        userId: new ObjectId(userId),
        changes: {
          before: beforeState,
          after: afterState,
        },
        timestamp: getISTFormattedTimestamp(),
        modifiedAt: new Date(),
      };

      const result = await this.settingsRepo.updateCourseSettings(
        courseId,
        courseVersionId,
        detectors,
        linearProgressionEnabled,
        seekForwardEnabled,
        hpSystem,
        isPublic,
        baseHp,
        randomizeItems,
        audit,
        session,
        crowdsourcedQuestionSubmissionEnabled,
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

  /**
   * Checks if linear progression is enabled for a specific course and version.
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @returns False if linear progression field is false, true otherwise
   */
  /**
   * Configures the follow-up invite for a course version. When a student
   * completes this (source) course version, an exclusive invite to the
   * configured follow-up course is created automatically.
   * @param courseId - The source course ID
   * @param courseVersionId - The source course version ID
   * @param followUpInvite - The follow-up invite configuration
   * @returns True if the update was acknowledged
   * @throws NotFoundError if the target course/version doesn't exist
   * @throws ForbiddenError if the target course version is archived
   */
  async updateFollowUpInvite(
    courseId: string,
    courseVersionId: string,
    followUpInvite: {
      enabled: boolean;
      courseId?: string;
      courseVersionId?: string;
      cohortId?: string;
      role?: string;
    },
  ): Promise<boolean> {
    // Ensure a fully-formed settings document exists for the source version
    // (runs in its own transaction) before we patch the follow-up field.
    await this.readCourseSettings(courseId, courseVersionId);

    return this._withTransaction(async session => {
      const sourceVersionStatus =
        await this.courseRepo.getCourseVersionStatus(courseVersionId);
      if (sourceVersionStatus === 'archived') {
        throw new ForbiddenError(
          "This course version is inactive, you can't update settings",
        );
      }

      // Validate the target (follow-up) course/version when enabling.
      if (followUpInvite.enabled) {
        if (!followUpInvite.courseId || !followUpInvite.courseVersionId) {
          throw new BadRequestError(
            'Follow-up course and version are required when enabling the follow-up invite.',
          );
        }

        const targetCourse = await this.courseRepo.read(
          followUpInvite.courseId,
          session,
        );
        if (!targetCourse) {
          throw new NotFoundError(
            `Follow-up course with ID ${followUpInvite.courseId} not found.`,
          );
        }

        const targetVersion = await this.courseRepo.readVersion(
          followUpInvite.courseVersionId,
          session,
        );
        if (!targetVersion) {
          throw new NotFoundError(
            `Follow-up course version with ID ${followUpInvite.courseVersionId} not found.`,
          );
        }

        const targetVersionStatus =
          await this.courseRepo.getCourseVersionStatus(
            followUpInvite.courseVersionId,
          );
        if (targetVersionStatus === 'archived') {
          throw new ForbiddenError(
            "Can't set an archived course version as the follow-up course.",
          );
        }

        // If the follow-up version uses cohorts, a cohort is required so
        // students can be enrolled into one. Surface this at configuration
        // time (prompt the instructor) rather than failing silently on
        // completion. Mirrors InviteService.inviteUserToCourse.
        const targetCohorts = targetVersion.cohorts ?? [];
        if (targetCohorts.length > 0) {
          if (!followUpInvite.cohortId) {
            throw new BadRequestError(
              'The follow-up course version has cohorts. Please select a cohort for students to be enrolled into.',
            );
          }
          const isValidCohort = targetCohorts.some(
            c => c.toString() === followUpInvite.cohortId!.toString(),
          );
          if (!isValidCohort) {
            throw new BadRequestError(
              'Invalid cohort. The selected cohort does not exist in the follow-up course version.',
            );
          }
        }
      }

      const result = await this.settingsRepo.updateFollowUpInvite(
        courseId,
        courseVersionId,
        {
          enabled: followUpInvite.enabled,
          courseId: followUpInvite.courseId,
          courseVersionId: followUpInvite.courseVersionId,
          cohortId: followUpInvite.cohortId,
          role: followUpInvite.role as ISettings['followUpInvite']['role'],
        },
        session,
      );

      if (!result) {
        throw new InternalServerError(
          'Failed to update follow-up invite settings. Please try again later.',
        );
      }

      return result.acknowledged || false;
    });
  }

  async isLinearProgressionEnabled(
    courseId: string,
    courseVersionId: string,
  ): Promise<boolean> {
    return this._withTransaction(async session => {
      const isCourseEnabled =
        await this.settingsRepo.isLinearProgressionEnabled(
          courseId,
          courseVersionId,
          session,
        );
      return isCourseEnabled;
    });
  }

  async getSettingsByVersionIds(
    courseVersionIds: ObjectId[],
  ): Promise<CourseSetting[] | null> {
    return this._withTransaction(async session => {
      return await this.settingsRepo.getSettingsByVersionIds(
        courseVersionIds,
        session,
      );
    });
  }

  async isLinearProgressionEnabledByVersionId(
      courseVersionId: string,
      session?: ClientSession,
    ): Promise<boolean> {
      return this.settingsRepo.isLinearProgressionEnabledByVersionId(courseVersionId,session);
    }

    async shouldRandomize(versionId:string): Promise<boolean> {
      return this.settingsRepo.shouldRandomize(versionId);
    }

  /**
   * Lists every course version that has an enabled follow-up invite configured.
   * Used by the daily reconciliation job to backfill follow-up invites.
   */
  async getCourseVersionsWithFollowUpInviteEnabled(): Promise<
    Array<{courseId: string; courseVersionId: string}>
  > {
    return this.settingsRepo.getCourseVersionsWithFollowUpInviteEnabled();
  }
}

export {CourseSettingService};
