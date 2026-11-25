import {ObjectId} from 'mongodb';

export type NotificationType =
  | 'ejection'
  | 'reinstatement'
  | 'policy_created'
  | 'policy_updated'
  | 'inactivity_warning'
  | 'appeal_submitted'
  | 'appeal_approved'
  | 'appeal_rejected'
  | 'mcq_submission_approved'
  | 'mcq_submission_rejected'
  | 'review_reminder'
  | 'case_response_weak_streak'
  | 'case_response_withdrawn';

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
    // SR review reminder (2026-08-09): itemCount = number of due
    // review items across `courseIds`. Used by the in-app inbox card
    // to render the count badge ("3 cards due").
    itemCount?: number;
    courseIds?: ObjectId[];
  };
  extra?: Record<string, any>;
}
