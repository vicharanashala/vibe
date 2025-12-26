import {Module} from '#root/modules/courses/classes/index.js';
import {
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
    session?: ClientSession,
  ): Promise<ICourseVersion | null>;

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

  // Cascade Delete Methods used by Cron Jobs
  cascadeDeleteVersion(session?: ClientSession): Promise<void>;
  //cascadeDeleteModule(session?: ClientSession): Promise<void>;
  //cascadeDeleteSection(session?: ClientSession): Promise<void>;
  //cascadeDeleteItemGroup(session?: ClientSession): Promise<void>;
  //cascadeDeleteItem(session?: ClientSession): Promise<void>;
}
