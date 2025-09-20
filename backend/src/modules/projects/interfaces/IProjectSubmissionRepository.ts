import {ClientSession} from 'mongodb';
import {IProjectSubmissionWithUser} from '../repositories/model.js';
import {SubmitProjectBody} from '../classes/validators/ProjectValidators.js';
import {ID} from '#root/shared/index.js';

export interface IProjectSubmissionRepository {
  getAllSubmissions(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IProjectSubmissionWithUser[]>;

  create(
    projectId: string,
    courseId: string,
    courseVersionId: string,
    userId: string,
    body: SubmitProjectBody,
    session?: ClientSession,
  ): Promise<ID>;
}
