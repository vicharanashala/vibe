import {ClientSession, UpdateResult} from 'mongodb';
import {
  ICourseSetting,
  ISettings,
  IUserSetting,
} from '../../interfaces/models.js';
import {
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
}
