import {ID, IUser} from '#root/shared/index.js';

export interface IProjectSubmission {
  _id?: ID;
  userId: ID;
  projectId: ID;
  courseId: ID;
  courseVersionId: ID;
  submissionURL: string;
  comment?: string;
  createdAt: Date;
  featured?: boolean;
  cohortId?: ID;
}
export interface IProjectSubmissionWithUser {
  course: {name: string};
  courseVersion: {name: string};
  userInfo: Array<
    Partial<IUser> & {
      submissionId: string;
      submissionURL: string;
      comment?: string;
      featured: boolean;
    }
  >;
}
