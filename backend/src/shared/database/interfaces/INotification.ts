import {ObjectId} from 'mongodb';

export type NotificationType =
  | 'ejection'
  | 'reinstatement'
  | 'policy_created'
  | 'policy_updated'
  | 'inactivity_warning'
  | 'appeal_submitted'
  | 'appeal_approved'
  | 'appeal_rejected';

export interface INotification {
  _id?: ObjectId | string;
  userId: ObjectId | string; // recipient
  type: NotificationType;
  title: string;
  message: string;
  courseId?: ObjectId | string;
  courseVersionId?: ObjectId | string;
  cohortId?: ObjectId | string;
  policyId?: ObjectId | string;
  read: boolean;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: {
    allowAppeal?: boolean;
    appealDeadline?: Date;
    enrollmentId?: ObjectId;
    appealPending?: boolean;
  };
}
