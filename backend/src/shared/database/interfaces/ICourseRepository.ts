import {ICourse, ICourseVersion} from '#shared/interfaces/models.js';
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
  readVersion(
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
  ): Promise<DeleteResult | null>;
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
  ): Promise<ICourseVersion | null>

  getAllCourses(
    session?: ClientSession,
  ): Promise<ICourse []>
}
