import {ObjectId} from 'mongodb';

/**
 * A single issued certificate. One row per (user, course, courseVersion)
 * that has been completed — created once, never mutated after issuance,
 * so it doubles as an immutable audit record.
 */
export interface ICertificate {
  _id?: ObjectId;

  userId: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;

  // Denormalized at issuance time so the certificate still reads correctly
  // even if the user later changes their name or the course gets renamed.
  studentName: string;
  courseName: string;

  // Human-shareable ID (e.g. a short UUID) used in the public verification
  // URL — deliberately separate from the Mongo _id so we never leak
  // internal ids in a link a student posts on LinkedIn.
  certificateId: string;

  issuedAt: Date;
}
