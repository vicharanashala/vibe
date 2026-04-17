import { ClientSession } from 'mongodb';
import {
  IProjectSubmission,
  IProjectSubmissionWithUser,
} from '../repositories/model.js';
import { SubmitProjectBody } from '../classes/validators/ProjectValidators.js';
import { ID } from '#root/shared/index.js';

export interface IProjectSubmissionRepository {
  getByUser(
    userId: string,
    versionId: string,
    courseId: string,
    cohort?: string,
    session?: ClientSession,
  ): Promise<IProjectSubmission | null>;

  getAllSubmissions(
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IProjectSubmissionWithUser>;

  create(
    projectId: string,
    courseId: string,
    courseVersionId: string,
    userId: string,
    submissionURL: string,
    comment: string,
    cohort?: string,
    session?: ClientSession,
  ): Promise<ID>;


  update(
    submissionId: string,
    submissionURL: string,
    comment: string,
    session?: ClientSession,
  ): Promise<ID>;

  deleteByUserAndVersion(
    userId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<boolean>;

  deleteProjectSubmissionByVersionId(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<boolean>;
}
