import { ObjectId } from 'mongodb';

export type SubmissionStatus = 
  | 'Pending'
  | 'Accepted'
  | 'Wrong Answer'
  | 'Time Limit Exceeded'
  | 'Memory Limit Exceeded'
  | 'Compilation Error'
  | 'Runtime Error';

export interface CodingSubmission {
  _id?: ObjectId | string;
  problemId: ObjectId | string;
  studentId: string; // From Firebase Auth
  language: string;
  code: string;
  status: SubmissionStatus;
  runtimeMs?: number;
  memoryKb?: number;
  output?: string;
  errorDetail?: string;
  createdAt?: Date;
  isRun?: boolean;
}
