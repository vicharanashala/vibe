import { Module } from '#root/modules/courses/classes/index.js';
import {
  courseVersionStatus,
  ICohort,
  ICourse,
  ICourseVersion,
  ID,
  IItemGroupInfo,
  IModule,
} from '#shared/interfaces/models.js';
import {
  MongoClient,
  ClientSession,
  ObjectId,
  DeleteResult,
  UpdateResult,
} from 'mongodb';

export interface ICourseRepository {
  getDBClient(): Promise<MongoClient>;

  create(course: ICourse, session?: ClientSession): Promise<ICourse | null>;
  read(id: string, session?: ClientSession): Promise<ICourse | null>;
  update(
    id: string,
    course: Partial<ICourse>,
    session?: ClientSession,
  ): Promise<ICourse | null>;
  delete(id: string, session?: ClientSession): Promise<boolean>;

  createVersion(
    courseVersion: ICourseVersion,
    // cohorts?: string[],
    session?: ClientSession,
  ): Promise<ICourseVersion | null>;

  updateTotalItemCount(versionId: string, newCount: number, session?: ClientSession): Promise<void>
  
  getCohortsByIds(
    cohortIds: ID[],
    options?: {
      search?: string
      sortBy?: "name" | "createdAt" | "updatedAt" | "baseHp" | "safeHp"
      sortOrder?: "asc" | "desc"
      skip?: number
      limit?: number
    },
    session?: ClientSession,
  ): Promise<ICohort[]>;

  createCohorts(
    versionId: string,
    cohorts: string[],
    baseHp: number,
    session?: ClientSession
  ): Promise<ObjectId[]>;

  addCohortsToVersion(
    versionId: string,
    cohortIds: ObjectId[],
    session?: ClientSession
  ): Promise<boolean>;

  // pushCohortsToVersion(
  //   versionId: string,
  //   cohortIds: ObjectId[],
  //   session?: ClientSession
  // ):Promise<boolean>;

  modifyCohortById(
    cohortId: ObjectId,
    cohortName?: string,
    isPublic?: boolean,
    isActive?: boolean,
    baseHp?: number,
    safeHp?: number,
    session?: ClientSession
  ): Promise<boolean>;

  deleteCohortById(
    cohortId: string,
    session: ClientSession
  ): Promise<boolean>;

  removeCohortFromVersion(
    versionId: string,
    cohortId: string,
    session?: ClientSession
  ): Promise<boolean>

  addModulesToVersion(
    courseVersionId: string,
    newModules: Module[],
    session?: ClientSession,
  ): Promise<void>;

  getItemGroupInfo(
    itemGroupId: ID,
    session?: ClientSession,
  ): Promise<IItemGroupInfo | null>;

  readVersion(
    versionId: string,
    session?: ClientSession,
  ): Promise<ICourseVersion | null>;

  getActiveVersion(
    versionId: string,
    session?: ClientSession,
  ): Promise<ICourseVersion | null>;

  getActiveVersions(
    versionIds: string[],
    session?: ClientSession,
  ): Promise<ICourseVersion[]>;

  getModulebyId(
    versionId: string,
    moduleId: string,
    session?: ClientSession,
  ): Promise<IModule | null>;

  updateVersion(
    versionId: string,
    courseVersion: ICourseVersion,
    session?: ClientSession,
  ): Promise<ICourseVersion | null>;
  deleteVersion(
    courseId: string,
    versionId: string,
    itemGroupsIds: ObjectId[],
    session?: ClientSession,
  ): Promise<UpdateResult | null>;
  addNewCourseVersionToCourse(
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<boolean>;
  deleteSection(
    versionId: string,
    moduleId: string,
    sectionId: string,
    courseVersion: ICourseVersion,
    session?: ClientSession,
  ): Promise<UpdateResult | null>;
  deleteModule(
    versionId: string,
    moduleId: string,
    session?: ClientSession,
  ): Promise<boolean | null>;
  findVersionByItemGroupId(
    itemGroupId: string,
    session?: ClientSession,
  ): Promise<ICourseVersion | null>;
  bulkUpdateVersions(operations: any[], session?: ClientSession): Promise<void>;
  getAllCourses(session?: ClientSession): Promise<ICourse[]>;
  updateCourseVersionStatus(vesionId: string, versionStatus: courseVersionStatus, session?: ClientSession): Promise<ICourseVersion | null>;
  getCourseVersionStatus(versionId: string, session?: ClientSession): Promise<courseVersionStatus>;
  // Cascade Delete Methods used by Cron Jobs
  cascadeDeleteVersion(session?: ClientSession): Promise<void>;
  //cascadeDeleteModule(session?: ClientSession): Promise<void>;
  //cascadeDeleteSection(session?: ClientSession): Promise<void>;
  //cascadeDeleteItemGroup(session?: ClientSession): Promise<void>;
  //cascadeDeleteItem(session?: ClientSession): Promise<void>;
  createCohortSettings(
    versionId: string,
    cohortId: string,
    registrationsAutoApproved: boolean,
    autoapproval_emails: string[],
    session?: ClientSession
  ): Promise<string>;

  getCohortSetting(
    versionId: string,
    cohortId: string,
    session?: ClientSession
  ): Promise<string>;

  updateCohortSettings(
    settingId: string,
    registrationsAutoApproved: boolean,
    autoapproval_emails: string[],
    session?: ClientSession
  ): Promise<boolean>;

  getCohortSettingById(
    id: string,
    session?: ClientSession
  ): Promise<any>;
}
