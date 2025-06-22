import {ObjectId} from 'mongodb';
import {ProctoringComponent} from '../database/index.js';

export interface IUser {
  _id?: string | ObjectId | null;
  firebaseUID: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
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
export interface ICourseVersion {
  _id?: ID;
  courseId: ID;
  version: string;
  description: string;
  modules: IModule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IModule {
  moduleId?: ID;
  name: string;
  description: string;
  order: string;
  sections: ISection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISection {
  sectionId?: ID;
  name: string;
  description: string;
  order: string;
  itemsGroupId?: ID;
  createdAt: Date;
  updatedAt: Date;
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
}

export interface IBaseItem {
  itemId?: ID;
  name: string;
  description: string;
  type: ItemType;
  order: string;
  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails;
}

export interface IVideoDetails {
  URL: string;
  startTime: string;
  endTime: string;
  points: number;
}

export interface IQuestionBankRef {
  bankId: string; // ObjectId as string
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
}

export interface IBlogDetails {
  tags: string[];
  content: string;
  points: number;
  estimatedReadTimeInMinutes: number;
}

export type EnrollmentRole = 'INSTRUCTOR' | 'STUDENT' | 'MANAGER' | 'TA' | 'STAFF';
export type EnrollmentStatus = 'ACTIVE' | 'INACTIVE';
// New interfaces for user enrollment and progress tracking
export interface IEnrollment {
  _id?: string | ObjectId | null;
  userId: string | ObjectId;
  courseId: string | ObjectId;
  courseVersionId: string | ObjectId;
  role: EnrollmentRole;
  status: EnrollmentStatus;
  enrollmentDate: Date;
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
}

export interface IWatchTime {
  _id?: string | ObjectId | null;
  userId: string | ObjectId;
  courseId: string | ObjectId;
  courseVersionId: string | ObjectId;
  itemId: string | ObjectId;
  startTime: Date;
  endTime?: Date;
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
// Interface for Invite
export interface IInvite {
  _id?: string | ObjectId | null;
  email: String;
  courseId: String | ObjectId;
  courseVersionId: string | ObjectId;
  token: String;
  action: InviteActionType;
  status: InviteStatusType;
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
export interface ISettings {
  proctors: IProctoringSettings;
}

// Interface for user-specific settings.
export interface IUserSettings {
  _id?: string | ObjectId | null;
  studentId: string | ObjectId;
  courseVersionId: string | ObjectId;
  courseId: string | ObjectId;
  settings: ISettings;
}

// Interface for course-specific settings.
export interface ICourseSettings {
  courseVersionId: string | ObjectId;
  courseId: string | ObjectId;
  settings: ISettings;
}

// Interface for User Specific Anomalies

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
