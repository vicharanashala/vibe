
// Invite types (since they're not in the schema yet)
export type EnrollmentRole = 'INSTRUCTOR' | 'STUDENT' | 'MANAGER' | 'TA' | 'STAFF';
export type InviteStatus = 'ACCEPTED' | 'PENDING' | 'CANCELLED' | 'EMAIL_FAILED' | 'ALREADY_ENROLLED';

export interface EmailInvite {
  email: string;
  role: EnrollmentRole;
}

export interface InviteBody {
  inviteData: EmailInvite[];
}
export interface InviteResult {
  inviteId: string;
  email: string;
  inviteStatus: InviteStatus;
  role: EnrollmentRole;
  acceptedAt?: Date;
  courseId?: string;
  courseVersionId?: string;
}

export interface InviteResponse {
  invites: InviteResult[];
  totalDocuments: number;
  totalPages: number;
}

export interface MessageResponse {
  message: string;
}