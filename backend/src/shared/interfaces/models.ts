import {ObjectId} from 'mongodb';
import {ProctoringComponent} from '../database/index.js';
import {Type} from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsIn,
  isString,
  IsEnum,
} from 'class-validator';
import { Priority } from './quiz.js';
import { Cohort } from '#root/modules/courses/classes/index.js';

export interface IUser {
  _id?: string | ObjectId | null;
  firebaseUID: string;
  email: string;
  firstName: string;
  lastName?: string;
  roles: 'admin' | 'user';
}

export type Versions = {
  version: string;
  id: ID;
};

export interface ICourse {
  _id?: string | ObjectId | null;
  name: string;
  description: string;
  versions: ID[];
  instructors: ID[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type ID = string | ObjectId | null;
export type courseVersionStatus = 'active' | 'archived';
export interface ICourseVersion {
  _id?: ID;
  courseId: ID;
  version: string;
  description: string;
  versionStatus?: courseVersionStatus;
  supportLink?: string;
  cohorts?: ID[];
  modules: IModule[];
  totalItems?: number;
  itemCounts?: {
    VIDEO?: number;
    QUIZ?: number;
    BLOG?: number;
    PROJECT?: number;
    FEEDBACK?: number;
  };
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IModule {
  moduleId?: ID;
  name: string;
  description: string;
  order: string;
  isHidden: boolean;
  sections: ISection[];
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISection {
  sectionId?: ID;
  name: string;
  description: string;
  order: string;
  isHidden: boolean;
  itemsGroupId?: ID;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IItemGroupInfo {
  courseVersionId: ID;
  moduleId: ID;
  moduleName: string;
  sectionId: ID;
  sectionName: string;
}

export interface IItemId {
  itemId: string;
  order: string;
  isLast: boolean;
}

export interface IItem {
  id?: string;
  name: string;
  description: string;
  createdAt: Date;
  type: 'VIDEO' | 'QUIZ' | 'BLOG';
  itemId: string;
  isDeleted?: boolean;
  deletedAt?: Date;
}

export interface IVideoItem {
  _id: string;
  url: string;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  points: number;
}

export interface IQuizItem {
  _id: string;
  questionVisibilityLimit: number;
  questionIds: string[];
}

export interface IBlogItem {
  _id: string;
  title: string;
  content: string;
  estimatedReadTimeInMinutes: number;
  tags: string[];
  points: number;
}

interface IQuestion {
  _id: string;
  questionText: string;
  questionType: 'SOL' | 'SML' | 'MTL' | 'OTL' | 'NAT' | 'DES';
  parameterized: boolean;
  parameters?: IQuestionParameter[];
  hintText: string;
  timeLimit: number;
  points: number;
  priority: Priority;
  metaDetails: IQuestionMetaDetails;
  createdAt: Date;
  updatedAt: Date;
}

interface IQuestionParameter {
  name: string;
  possibleValues: string[];
  type: 'number' | 'string';
}

export interface IQuestionMetaDetails {
  _id: string;
  creatorId: string;
  isStudentGenerated: boolean;
  isAIGenerated: boolean;
}

export interface IQuestionOptionsLot {
  _id: string;
  lotItems: IQuesionOptionsLotItem[];
}

export interface IQuesionOptionsLotItem {
  _id: string;
  itemText: string;
  explaination: string;
}

export interface ISOLQuestionSolution {
  lotItemId: string;
}

export interface ISMLQuesionSolution {
  lotItemIds: string[];
}

export interface IMTLQuestionSolution {
  matchings: IMTLQuestionMatching[];
}

export interface IMTLQuestionMatching {
  lotItemId: string[];
  explaination: string;
}

export interface IOTLQuestionSolution {
  orderings: IOTLQuestionOrdering[];
}

export interface IOTLQuestionOrdering {
  lotItemId: string;
  order: number;
}

export interface INATQuestionSolution {
  decimalPrecision: number;
  upperLimit: number;
  lowerLimit: number;
  value: number;
}

export interface IDESQuestionSolution {
  solutionText: string;
}

export interface ISOLQuestion extends IQuestion {
  questionType: 'SOL';
  lot: IQuestionOptionsLot;
  solution: ISOLQuestionSolution;
}

export interface ISMLQuestion extends IQuestion {
  questionType: 'SML';
  lots: IQuestionOptionsLot[];
  solution: ISMLQuesionSolution;
}

export interface IMTLQuestion extends IQuestion {
  questionType: 'MTL';
  solution: IMTLQuestionSolution;
}

export interface IOTLQuestion extends IQuestion {
  questionType: 'OTL';
  solution: IOTLQuestionSolution;
}

export interface INATQuestion extends IQuestion {
  questionType: 'NAT';
  solution: INATQuestionSolution;
}

export interface IDESQuestion extends IQuestion {
  questionType: 'DES';
  solution: IDESQuestionSolution;
}

export interface IQuizResponse {
  _id: string;
  quizItemId: string;
  studentId: string;
  questionsLength: number;
  graadingStatus: 'PENDING' | 'GRADED';
  submitted: boolean;
  questions: (
    | IQuizSOLQuestionResponse
    | IQuizSMLQuestionResponse
    | IQuizMTLQuestionResponse
    | IQuizOTLQuestionResponse
    | IQuizNATQuestionResponse
    | IQuizDESQuestionResponse
  )[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuizResponseItem {
  questionId: string;
  parameters: IQuestionParameter[];
  points: number;
  timeTaken: number;
}

export interface IQuizSOLQuestionResponse extends IQuizResponseItem {
  itemId: string;
}

export interface IQuizSMLQuestionResponse extends IQuizResponseItem {
  itemIds: string;
}

export interface IQuizMTLQuestionResponse extends IQuizResponseItem {
  matchings: Omit<IMTLQuestionMatching, 'explaination'>[];
}

export interface IQuizOTLQuestionResponse extends IQuizResponseItem {
  orderings: IOTLQuestionOrdering[];
}

export interface IQuizNATQuestionResponse extends IQuizResponseItem {
  value: number;
}

export interface IQuizDESQuestionResponse extends IQuizResponseItem {
  responseText: string;
}

export enum ItemType {
  VIDEO = 'VIDEO',
  QUIZ = 'QUIZ',
  BLOG = 'BLOG',
  PROJECT = 'PROJECT',
  FEEDBACK = 'FEEDBACK',
}

export interface IBaseItem {
  itemId?: ID;
  name: string;
  description: string;
  type: ItemType;
  order: string;
  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails | IProjectDetails;
}

// Add minimal IProjectItemDetails interface for PROJECT type
export interface IProjectDetails {
  // Add fields as needed for project items, or leave empty if none
}

export interface IVideoDetails {
  URL: string;
  startTime: string;
  endTime: string;
  points: number;
}

export interface IQuestionBankRef {
  bankId: ID; // ObjectId as string
  count: number; // How many questions to pick
  difficulty?: string[]; // Optional filter
  tags?: string[]; // Optional filter
  type?: string; // Optional question type filter
}

export interface IQuizDetails {
  questionBankRefs: IQuestionBankRef[]; // question ids
  passThreshold: number; // 0-1
  maxAttempts: number; // Maximum number of attempts allowed
  quizType: 'DEADLINE' | 'NO_DEADLINE'; // Type of quiz
  releaseTime: Date; // Release time for the quiz
  questionVisibility: number; // Number of questions visible to the user at a time
  deadline?: Date; // Deadline for the quiz, only applicable for DEADLINE type
  approximateTimeToComplete: string; // Approximate time to complete in HH:MM:SS format
  allowPartialGrading: boolean; // If true, allows partial grading for questions
  allowHint: boolean; // If true, allows users to use hints for questions
  showCorrectAnswersAfterSubmission: boolean; // If true, shows correct answers after submission
  showExplanationAfterSubmission: boolean; // If true, shows explanation after submission
  showScoreAfterSubmission: boolean; // If true, shows score after submission
  allowSkip: boolean; // If true, allows users to skip quiz questions
}

export interface IQuizSettings {
  _id?: string | ObjectId;
  quizId: string | ObjectId;
  passThreshold: number; // 0-1
  maxAttempts: number; // Maximum number of attempts allowed
  quizType: 'DEADLINE' | 'NO_DEADLINE'; // Type of quiz
  releaseTime: Date; // Release time for the quiz
  questionVisibility: number; // Number of questions visible to the user at a time
  deadline?: Date; // Deadline for the quiz, only applicable for DEADLINE type
  approximateTimeToComplete: string; // Approximate time to complete in HH:MM:SS format
  allowPartialGrading: boolean; // If true, allows partial grading for questions
  allowHint: boolean; // If true, allows users to use hints for questions
  showCorrectAnswersAfterSubmission: boolean; // If true, shows correct answers after submission
  showExplanationAfterSubmission: boolean; // If true, shows explanation after submission
  showScoreAfterSubmission: boolean; // If true, shows score after submission
  allowSkip: boolean; // If true, allows users to skip quiz questions
}

export interface IBlogDetails {
  tags: string[];
  content: string;
  points: number;
  estimatedReadTimeInMinutes: number;
}

export interface IFeedBackFormDetails {
  jsonSchema: Record<string, any>;
  uiSchema: Record<string, any>;
}

export type EnrollmentRole =
  | 'INSTRUCTOR'
  | 'STUDENT'
  | 'MANAGER'
  | 'TA'
  | 'STAFF';
export type EnrollmentStatus = 'ACTIVE' | 'INACTIVE';
export interface IEnrollment {
  _id?: string | ObjectId | null;
  userId: string | ObjectId;
  courseId: string | ObjectId;
  courseVersionId: string | ObjectId;
  role: EnrollmentRole;
  status: EnrollmentStatus;
  cohort?: string;
  enrollmentDate: Date;
  percentCompleted: number;
  completedItemsCount?: number;
  assignedTimeSlots?: Array<{
    from: string; // HH:MM format in IST
    to: string; // HH:MM format in IST
  }>;
  isDeleted?: boolean;
  deletedAt?: Date;
  unenrolledAt?: Date;
  hasNewItemsAfterCompletion?: boolean;
  cohortId?: ID
}

export interface IProgress {
  _id?: string | ObjectId | null;
  userId: string | ObjectId;
  courseId: string | ObjectId;
  courseVersionId: string | ObjectId;
  currentModule: string | ObjectId;
  currentSection: string | ObjectId;
  currentItem: string | ObjectId;
  completed: boolean;
  completedAt?: Date;
  cohort?: string;
}

export interface ICurrentProgressPath {
  module: {id: string; name: string} | null;
  section: {id: string; name: string} | null;
  item: {id: string; name: string; type: string} | null;
  message?: string;
}

export interface IWatchTime {
  _id?: string | ObjectId | null;
  userId: string | ObjectId;
  courseId: string | ObjectId;
  courseVersionId: string | ObjectId;
  itemId: string | ObjectId;
  startTime: Date;
  endTime?: Date;
  cohortId?: ID;
}

export interface ICohort {
  _id?: string | ObjectId | null;
  courseVersionId: string | ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
}

export interface IUserActivityEvent {
  _id?: string | ObjectId | null;
  userId: string | ObjectId;
  courseId: string | ObjectId;
  courseVersionId: string | ObjectId;
  videoId: ObjectId; // itemId from the system, stored as ObjectId
  cohortId?: string | ObjectId; // Optional cohortId from enrollment
  rewinds: number;
  fastForwards: number;
  rewindData: Array<{
    from: string; // HH:MM:SS format
    to: string; // HH:MM:SS format
    createdAt: Date;
  }>;
  fastForwardData: Array<{
    from: string; // HH:MM:SS format
    to: string; // HH:MM:SS format
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

export enum InviteActionType {
  SIGNUP = 'SIGNUP',
  ENROLL = 'ENROLL',
  NOTIFY = 'NOTIFY',
}
export enum InviteStatusType {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
}
export enum InviteType {
  SINGLE = 'SINGLE',
  BULK = 'BULK',
}
// Interface for Invite
export interface IInvite {
  _id?: string | ObjectId | null;
  email?: string;
  courseId: string | ObjectId;
  courseVersionId: string | ObjectId;
  token: string;
  type: InviteType;
  usedount?: number;
  action: InviteActionType;
  Invitestatus: InviteStatusType;
  createdAt: Date;
  expiresAt: Date;
}
// Interface for proctoring settings.
/*export interface IProctoringSettings {
  components: ProctoringComponent[];
}*/

export interface IDetectorOptions {
  enabled: boolean;
  options?: Record<string, any>;
}

export interface IDetectorSettings {
  detectorName: ProctoringComponent;
  settings: IDetectorOptions;
}

export interface IProctoringSettings {
  detectors: IDetectorSettings[];
}

// Common settings interface for both user and course settings.
export interface IRegistrationSettings {
  _id?: ID;
  label: string;
  type:
    | 'TEXT'
    | 'TEXTAREA'
    | 'EMAIL'
    | 'TEL'
    | 'DATE'
    | 'NUMBER'
    | 'URL'
    | 'SELECT';
  isDefault: boolean;
  required: boolean;
  options?: string[];
}

export interface ITimeSlot {
  from: string; // HH:MM format in IST
  to: string; // HH:MM format in IST
  studentIds: string[]; // Array of student user IDs
  maxStudents?: number; // Maximum number of students allowed in this timeslot
}

export interface ISettings {
  proctors: IProctoringSettings;
  linearProgressionEnabled: boolean;
  seekForwardEnabled: boolean;
  isPublic?: boolean;
  // registration_settings?: IRegistrationSettings[];
  registration?: {
    jsonSchema?: any;
    uiSchema?: any;
    isActive?: boolean;
    registrationsAutoApproved?: boolean;
    autoapproval_emails?: string[];
  };
  timeslots?: {
    isActive: boolean;
    slots: ITimeSlot[];
  };
  // jsonSchema?: any;
  // uiSchema?: any;
}

// Interface for user-specific settings.
export interface IUserSetting {
  _id?: string | ObjectId | null;
  studentId: string | ObjectId;
  courseVersionId: string | ObjectId;
  courseId: string | ObjectId;
  settings: ISettings;
}

// Interface for course-specific settings.
export interface ICourseSetting {
  courseVersionId: string | ObjectId;
  courseId: string | ObjectId;
  settings: ISettings;
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export interface SortOptions {
  field: string;
  order: SortOrder;
}

export class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;
}

export class PaginationWithSortQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  sortField?: string;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}

export class EnrollmentFilterQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search: string = '';

  @IsString()
  @IsIn(['STUDENT', 'INSTRUCTOR', 'MANAGER', 'TA', 'STAFF'])
  role: EnrollmentRole;

  @IsOptional()
  @IsString()
  courseVersionId?: string;

  @IsOptional()
  @IsIn(['active', 'archived'])
  tab?: courseVersionStatus = 'active';
}

export class EnrollmentsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['name', 'enrollmentDate', 'progress', 'unenrolledAt'])
  sortBy: 'name' | 'enrollmentDate' | 'progress' | 'unenrolledAt' =
    'enrollmentDate';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsIn(['STUDENT', 'OTHER'])
  filter?: 'STUDENT' | 'OTHER';

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  statusTab: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';

  @IsOptional()
  @IsString()
  cohort?: string;
}

export class BulkEnrollmentsQuery {
  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  versionId?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export interface IUserAnomaly {
  _id?: string | ObjectId | null;
  userId: string | ObjectId;
  courseId: string | ObjectId;
  courseVersionId: string | ObjectId;
  moduleId?: string | ObjectId;
  sectionId?: string | ObjectId;
  itemId?: string | ObjectId;
  anomalyType: string;
}

export interface AuthenticatedUserEnrollements {
  courseId: string;
  versionId: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'MANAGER' | 'TA' | 'STAFF';
}

export interface AuthenticatedUser {
  userId: string;
  globalRole: 'admin' | 'user';
  enrollments: AuthenticatedUserEnrollements[];
}

// export interface ICourseRegistration {
//   _id?: string | ObjectId;
//   courseId: string;
//   versionId: string;
//   userId: string;
//   detail: {
//     name: string;
//     email: string;
//     mobile: string;
//     gender: 'MALE' | 'FEMALE' | 'OTHERS';
//     city: string;
//     state: string;
//     category: 'GENERAL' | 'OBC' | 'SE' | 'ST' | 'OTHERS';
//     university: string;
//   };
//   status: 'PENDING' | 'APPROVED' | 'REJECTED';
//   createdAt?: Date;
//   updatedAt?: Date;
// }

export interface ICohortResponse {
  _id: ID,
  name: string
}
export interface ICourseRegistration {
  _id?: string | ObjectId;
  courseId: ID;
  versionId: ID;
  userId: ID;
  detail: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  cohortId?: ID;
  cohort?: ICohort;
  cohortName?: string;
  read?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TranscriptResponse {
  segmentNumber: number;
  timestamp: string;
  questions: TranscriptQuestion[];
}

export interface TranscriptQuestion {
  sno: number;
  question: string;
  hint: string;
  options: TranscriptOptions;
  explanations: TranscriptExplanations;
  correctAnswer: string;
}

export interface TranscriptOptions {
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface TranscriptExplanations {
  A: string;
  B: string;
  C: string;
  D: string;
}

export enum AnnouncementType {
  GENERAL = 'GENERAL',
  VERSION_SPECIFIC = 'VERSION_SPECIFIC',
  COURSE_SPECIFIC = 'COURSE_SPECIFIC',
}

export interface IAnnouncementAttachment {
  fileName: string;
  fileUrl: string;
  fileType: string;
}

export interface IAnnouncement {
  _id?: ID;
  title: string;
  content: string;
  type: AnnouncementType;
  courseId?: ID;
  courseVersionId?: ID;
  courseName?: string;
  courseVersionName?: string;
  instructorId: ID;
  instructorName: string;
  instructorFirebaseUid?: string;
  attachments?: IAnnouncementAttachment[];
  isHidden: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// export type AuditCategory =
//   | "COURSE"
//   | "COURSE_VERSION"
//   | "MODULE"
//   | "SECTION"
//   | "ITEM"
//   | "QUIZ"
//   | "QUESTION"
//   | "QUESTION_BANK"
//   | "FLAGS"
//   | "ENROLLMENT"
//   | "REGISTRATION"
//   | "INVITE"
//   | "COURSE_SETTINGS"
//   | "REPORT"
//   | "PROGRESS";

// export type AuditAction =
//   // course
//   | "COURSE_CREATE"
//   | "COURSE_UPDATE"
//   | "COURSE_DELETE"

//   // course version
//   | "COURSE_VERSION_CREATE"
//   | "COURSE_VERSION_UPDATE"
//   | "COURSE_VERSION_DELETE"
//   | "COURSE_VERSION_CLONE"

//   // structure changes
//   | "MODULE_ADD"
//   | "MODULE_UPDATE"
//   | "MODULE_DELETE"
//   | "MODULE_HIDE"
//   | "MODULE_REORDER"

//   | "SECTION_ADD"
//   | "SECTION_UPDATE"
//   | "SECTION_DELETE"
//   | "SECTION_HIDE"
//   | "SECTION_REORDER"

//   | "ITEM_ADD"
//   | "ITEM_UPDATE"
//   | "ITEM_DELETE"
//   | "ITEM_HIDE"
//   | "ITEM_REORDER"
//   | "ITEM_MAKE_OPTIONAL"

//   // quiz/question/bank
//   | "QUESTION_ADD"
//   | "QUESTION_UPDATE"
//   | "QUESTION_DELETE"
//   | "QUESTION_BANK_CREATE"
//   | "QUESTION_BANK_UPDATE"
//   | "QUESTION_BANK_DELETE"

//   // flags
//   | "FLAG_STATUS_UPDATE"

//   // enrollment/progress
//   | "ENROLLMENT_REMOVE"
//   | "ENROLLMENT_REMOVE_INSTRUCTOR"
//   | "ENROLLMENT_REMOVE_STUDENT"
//   | "PROGRESS_RESET"
//   | "PROGRESS_RECALCULATE"

//   // registration
//   | "REGISTRATION_APPROVE"
//   | "REGISTRATION_REJECT"
//   | "REGISTRATION_FORM_UPDATE"

//   // invites
//   | "INVITE_SEND_SINGLE"
//   | "INVITE_SEND_BULK"
//   | "INVITE_RESEND"
//   | "INVITE_REMOVE"

//   // settings
//   | "COURSE_SETTINGS_UPDATE"

//   // exports/reports/downloads
//   | "DOWNLOAD_PROJECT_SUBMISSIONS"
//   | "DOWNLOAD_QUIZ_SUBMISSIONS"
//   | "DOWNLOAD_QUIZ_REPORT";

// export interface InstructorAuditTrail {

//   category: AuditCategory;
//   action: AuditAction;
//   actor: ObjectId;
//   context: {
//     courseId?: ObjectId;
//     courseVersionId?: ObjectId;

//     moduleId?: ObjectId;
//     sectionId?: ObjectId;
//     itemId?: ObjectId;

//     // for quiz/question changes
//     quizId?: ObjectId;
//     questionId?: ObjectId;
//     questionBankId?: ObjectId;

//     // for flags/enrollment/invite/registration
//     flagId?: ObjectId;
//     enrollmentId?: ObjectId;
//     registrationId?: ObjectId;
//     inviteId?: ObjectId;

//     // any additional identifiers
//     relatedIds?: Record<string, ObjectId | string>;
//   };

//     changes: {
//     // "before" and "after" should be partial snapshots, not entire documents (avoid huge payloads)
//     before?: Record<string, any>;
//     after?: Record<string, any>;
//      },

//     outcome: {
//     status: "SUCCESS" | "FAILED" | "PARTIAL";
//     errorCode?: string;
//     errorMessage?: string;      // keep short- avoid stack traces
//   };

//     source?: "DASHBOARD" | "COURSE"
//   createdAt: Date;

// }

// export interface IAuditTrail {
//  itemId: string | ObjectId | null;
//  action: string;
// }
