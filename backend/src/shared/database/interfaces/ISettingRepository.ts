import {ClientSession, ObjectId, UpdateResult} from 'mongodb';
import {
  ICourseSetting,
  IRegistrationSettings,
  ISettings,
  IUserSetting,
  ITimeSlot,
  ICohortSettings,
} from '../../interfaces/models.js';
import {
  AuditingDto,
  DetectorOptionsDto,
  DetectorSettingsDto,
  ProctoringSettingsDto,
} from '#setting/index.js';

/**
 * Interface representing a repository for settings related operations.
 * This interface defined methods for creating, reading and managing course & user settings.
 */

// Enum representing the different components of proctoring that can be enabled or disabled.
export enum ProctoringComponent {
  CAMERAMICRO = 'cameraMic',
  BLURDETECTION = 'blurDetection', // bulrDetection
  FACECOUNTDETECTION = 'faceCountDetection', // faceCountDetection
  HANDGESTUREDETECTION = 'handGestureDetection', // handGestureDetection
  VOICEDETECTION = 'voiceDetection', // voiceDetection
  VIRTUALBACKGROUNDDETECTION = 'virtualBackgroundDetection', // virtualBackgroundDetection
  RIGHTCLICKDISABLED = 'rightClickDisabled', // rightClickDisabled
  FACERECOGNITION = 'faceRecognition', // faceRecognition
}

/**
 * Interface for the settings repository.
 * This interface defines methods for managing course and user settings.
 */
export interface ISettingRepository {
  createCourseSettings(
    courseSettings: ICourseSetting,
    session?: ClientSession,
  ): Promise<ICourseSetting | null>;

  readCourseSettings(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<ICourseSetting | null>;

  /**
   * Reads course settings for a specific course and version.
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param session - Optional MongoDB session for transactions
   * @returns The course settings or null if not found
   */

  updateCourseSettings(
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
  ): Promise<UpdateResult | null>;

  updateRegistrationSchemas(
    courseId: string,
    versionId: string,
    schemas: {jsonSchema?: any; uiSchema?: any; isActive?: boolean}, // Partial update for schemas only
    session?: ClientSession,
  ): Promise<UpdateResult>;

  /**
   * Reads course settings for a specific course and version.
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param settings - The default registration settings to add
   * @param session - Optional MongoDB session for transactions
   * @returns The course settings or null if not found
   */

  addDefaultRegistrationSettings(
    courseId: string,
    courseVersionId: string,
    settings: IRegistrationSettings[],
    session?: ClientSession,
  ): Promise<UpdateResult | null>;
  /**
   * Reads course settings for a specific course and version.
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param settings - The updated registration settings
   * @param session - Optional MongoDB session for transactions
   * @returns The course settings or null if not found
   */

  updateRegistrationSettings(
    courseId: string,
    versionId: string,
    schemas: {
      jsonSchema: any;
      uiSchema: any;
      isActive: boolean;
      registrationsAutoApproved?: boolean;
      autoapproval_emails?: string[];
      cohortSettings?: ObjectId[];
    },
    session?: ClientSession,
  ): Promise<UpdateResult | null>;

  updateCohortSettings(
    courseId: string,
    versionId: string,
    schemas: {cohortSettings: ObjectId[]},
    session?: ClientSession,
  ): Promise<UpdateResult | null>;

  /**
   * Creates new user settings.
   * @param userSettings - The user settings to create
   * @param session - Optional MongoDB session for transactions
   * @returns The created user settings or null if creation failed
   */

  createUserSettings(
    userSettings: IUserSetting,
    session?: ClientSession,
  ): Promise<IUserSetting | null>;

  readSettingsSchema(
    versionId: string,
    session?: ClientSession,
  ): Promise<{jsonSchema: any; uiSchema: any; isActive: boolean}>;

  /**
   * Reads user settings for a specific student, course and version.
   * @param studentId - The ID of the student
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param session - Optional MongoDB session for transactions
   * @returns The user settings or null if not found
   */

  readUserSettings(
    studentId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IUserSetting | null>;

  /**
   * Updates user settings for a specific detector.
   * If the detector doesn't exist, it will be added.
   * @param studentId - The ID of the student
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param detectorName - The name of the proctoring detector to update
   * @param detectorSettings - The new settings for the detector
   * @param session - Optional MongoDB session for transactions
   * @returns True if update was successful, null/false otherwise
   */
  updateUserSettings(
    studentId: string,
    courseId: string,
    courseVersionId: string,
    detectors: DetectorSettingsDto[],
    session?: ClientSession,
  ): Promise<UpdateResult | null>;

  deleteCourseSettingsbyVersionId(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<boolean>;

  /**
   * Checks if linear progression is enabled for a specific course and version.
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param session - Optional MongoDB session for transactions
   * @returns True if linear progression is enabled, false otherwise
   */
  isLinearProgressionEnabled(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<boolean>;

  /**
   * Gets public courses that are available for enrollment.
   * @param excludeCourseIds - Course IDs to exclude (user's enrolled courses)
   * @param skip - Number of documents to skip for pagination
   * @param limit - Maximum number of documents to return
   * @param search - Search query for course name/description
   * @param session - Optional MongoDB session for transactions
   * @returns Array of public courses with course details
   */
  getPublicCourses(
    excludeCourseIds: string[],
    skip: number,
    limit: number,
    search: string,
    session?: ClientSession,
  ): Promise<any[]>;

  /**
   * Counts public courses available for enrollment.
   * @param excludeCourseIds - Course IDs to exclude (user's enrolled courses)
   * @param search - Search query for course name/description
   * @param session - Optional MongoDB session for transactions
   * @returns Total count of public courses
   */
  countPublicCourses(
    excludeCourseIds: string[],
    search: string,
    session?: ClientSession,
  ): Promise<number>;

  /**
   * Updates timeslots settings for a specific course and version.
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param timeslots - The timeslots settings to update
   * @param session - Optional MongoDB session for transactions
   * @returns Update result or null if update failed
   */
  updateTimeslotsSettings(
    courseId: string,
    courseVersionId: string,
    timeslots: {isActive: boolean; slots: ITimeSlot[]},
    session?: ClientSession,
  ): Promise<UpdateResult | null>;

  /**
   * Reads timeslots settings for a specific course and version.
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param session - Optional MongoDB session for transactions
   * @returns The timeslots settings or null if not found
   */
  readTimeslotsSettings(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<{isActive: boolean; slots: ITimeSlot[]} | null>;

  getSettingsByVersionIds(
    courseVersionIds: ObjectId[],
    session?: ClientSession,
  ): Promise<ICourseSetting[] | null>;

  getisHpSystemEnabled(
    courseVersionId: ObjectId,
  ): Promise<boolean>;
}
