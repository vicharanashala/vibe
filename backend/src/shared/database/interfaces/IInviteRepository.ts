import {
  ICourse,
  IInvite,
  ICourseVersion,
  IEnrollment,
  IModule,
  IProgress,
} from '#shared/interfaces/models.js';
import {
  ClientSession,
  DeleteResult,
  MongoClient,
  ObjectId,
  UpdateResult,
} from 'mongodb';

export interface IInviteRepository {
  getDBClient(): Promise<MongoClient>;
  create(invite: IInvite, session?: ClientSession): Promise<any>;
  findInviteByEmail(email: string): Promise<IInvite | null>;
  updateInvite(invite: any): Promise<void>;
}