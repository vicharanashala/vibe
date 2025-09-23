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
}
export interface IProjectSubmissionWithUser {
  course: {name: string};
  courseVersion: {name: string};
  userInfo: Array<Partial<IUser> & {submissionURL: string; comment?: string}>;
}
