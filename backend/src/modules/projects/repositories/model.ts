import {ID, IUser} from '#root/shared/index.js';

export interface IProjectSubmission {
  _id?: ID;
  userId: ID;
  projectId: ID;
  courseId: ID;
  courseVersionId: ID;
  cohortId?: ID;
  submissionURL: string;
  comment?: string;
  reviewedAt?: Date;
  reviewedById?: ID;
  feedback?: string;
  grade?: string;
  createdAt: Date;
  updatedAt?: Date;
}
export interface IProjectSubmissionWithUser {
  course: {name: string};
  courseVersion: {name: string};
  userInfo: Array<
    Partial<IUser> & {
      submissionId: string;
      submissionURL: string;
      comment?: string;
      cohortName?: string;
      submittedAt?: Date;
      reviewedAt?: Date;
      feedback?: string;
      grade?: string;
    }
  >;
}
