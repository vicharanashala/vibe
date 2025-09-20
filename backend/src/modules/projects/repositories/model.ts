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
export interface IProjectSubmissionWithUser extends IProjectSubmission {
  userInfo?: Partial<IUser>; 
}