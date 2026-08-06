import { ClientSession } from 'mongodb';
import {
  IProjectSubmission,
  IProjectSubmissionWithUser,
} from '../repositories/model.js';
import { SubmitProjectBody } from '../classes/validators/ProjectValidators.js';
import { ID } from '#root/shared/index.js';

export interface IProjectSubmissionRepository {
  getById(
    submissionId: string,
    session?: ClientSession,
  ): Promise<IProjectSubmission | null>;

  getByUser(
    userId: string,
    versionId: string,
    courseId: string,
    cohort?: string,
    session?: ClientSession,
  ): Promise<IProjectSubmission | null>;

  /**
   * Bug-safe alternative to getByUser() for student-facing lookups.
   * Filters by userId + projectId + courseId + courseVersionId (+ cohortId if present).
   * getByUser() omits projectId and can collide when a student has submissions to
   * multiple project items in the same course version — do NOT use that method here.
   */
  getSubmissionByUserAndProject(
    userId: string,
    projectId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
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

  setFeatured(
    submissionId: string,
    featured: boolean,
    session?: ClientSession,
  ): Promise<IProjectSubmission | null>;

  getFeaturedSubmissions(
    projectId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IProjectSubmission[]>;
}
