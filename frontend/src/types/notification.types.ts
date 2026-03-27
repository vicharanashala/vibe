// Notification types for course registration system

export interface PendingRegistrationNotification {
  _id: string;
  userId: string;
  courseId: string;
  versionId: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  detail: {
    Name: string;
    Email: string;
    Phone: string;
  };
  courseName: string;
  user?: {
    email: string;
    firstName: string;
    lastName: string;
  };
  course?: {
    name: string;
  };
  version?: {
    version: string;
  };
}

export interface ApprovedRegistrationNotification {
  _id: string;
  userId: string;
  courseId: string;
  versionId: string;
  status: string;
  detail: {
    Name: string;
    Email: string;
    Phone: string;
    [key: string]: any; // Allow additional properties like "current now cheking new"
  };
  createdAt: string;
  updatedAt?: string | null;
  read: boolean;
  course?: {
    name: string;
  };
  courseName?: string;
}

export interface PendingStudentRegistrationNotification {
  _id: string;
  userId: string;
  courseId: string;
  versionId: string;
  status: string;
  detail: {
    Name?: string;
    Email?: string;
    Phone?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt?: string | null;
  course?: {
    name: string;
  };
  courseName?: string;
}

export interface RejectedStudentRegistrationNotification {
  _id: string;
  userId: string;
  courseId: string;
  versionId: string;
  status: string;
  detail: {
    Name?: string;
    Email?: string;
    Phone?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt?: string | null;
  course?: {
    name: string;
  };
  courseName?: string;
}

export type SystemNotificationType =
  | 'ejection'
  | 'reinstatement'
  | 'policy_created'
  | 'policy_updated'
  | 'appeal_submitted'
  | 'appeal_approved'
  | 'appeal_rejected';
 
export interface SystemNotification {
  _id: string;
  type: SystemNotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  courseId?: string;
  courseVersionId?: string;
  cohortId?: string;
  policyId?: string;
  metadata?: {
    allowAppeal?: boolean;
    appealDeadline?: string;
    enrollmentId?: string;
  };
  extra?: {
    studentId?: string;
    reason?: string;
    evidenceUrl?: string;
  };
}
 
export interface SystemNotificationsResponse {
  notifications: SystemNotification[];
  unreadCount: number;
}