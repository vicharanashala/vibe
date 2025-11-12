import {ICourseRegistration} from '#root/shared/interfaces/models.js';
import {ClientSession} from 'mongodb';

export interface ICourseRegistrationRepository {
  findByUserId(
    userId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<ICourseRegistration>;
  create(data: ICourseRegistration, session?: ClientSession): Promise<string>;
  getRegistration(
    registrationId: string,
    session?: ClientSession,
  ): Promise<ICourseRegistration | null>;
  findAllregistrations(
    versionId: string,
    filter: {status?: string; search?: string},
    skip: number,
    limit: number,
    sort: 'older' | 'latest',
    session?: ClientSession,
  ): Promise<{registrations: ICourseRegistration[]; totalDocuments: number}>;
  updateStatus(
    registrationId: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    session?: ClientSession,
  ): Promise<ICourseRegistration>;
  updateBulkStatus(
    registrationIds: string[],
    session?: ClientSession,
  ): Promise<number>;
  remove(userId:string,courseId:string,versionId:string,session?:ClientSession)
  deleteRegistrationByVersionId(versionId: string, session?: ClientSession)
}
