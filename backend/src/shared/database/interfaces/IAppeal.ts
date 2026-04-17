import {ObjectId} from 'mongodb';

export interface IAppeal {
  _id?: ObjectId;

  userId: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  cohortId: ObjectId;

  policyId: ObjectId;

  reason: string;

  evidenceImages?: string[];

  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  createdAt: Date;
  updatedAt: Date;

  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  adminResponse?: string;
}
