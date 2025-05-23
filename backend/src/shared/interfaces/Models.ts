import {ObjectId} from 'mongodb';

export interface IUser {
  id?: string;
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

type ID = string | ObjectId | null;
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
  startTime: Number;
  endTime: Number;
  points: Number;
}

export interface IQuizItem {
  _id: string;
  questionVisibilityLimit: Number;
  questionIds: string[];
}

export interface IBlogItem {
  _id: string;
  title: string;
  content: string;
  estimatedReadTimeInMinutes: Number;
  tags: string[];
  points: Number;
}

interface IQuestion {
  _id: string;
  questionText: string;
  questionType: 'SOL' | 'SML' | 'MTL' | 'OTL' | 'NAT' | 'DES';
  parameterized: boolean;
  parameters?: IQuestionParameter[];
  hintText: string;
  timeLimit: Number;
  points: Number;
  metaDetails: IQuestionMetaDetails;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuestionParameter {
  name: string;
  value: string[] | Number[];
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
  order: Number;
}

export interface INATQuestionSolution {
  decimalPrecision: Number;
  upperLimit: Number;
  lowerLimit: Number;
  value: Number;
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
  questionsLength: Number;
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

interface IQuizResponseItem {
  questionId: string;
  parameters: IQuestionParameter[];
  points: Number;
  timeTaken: Number;
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
  value: Number;
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

export interface IQuizDetails {
  questionVisibility: number;
  releaseTime: Date; // quiz start time
  deadline: Date; // quiz deadline
  questions: string[]; // question ids
}

export interface IBlogDetails {
  tags: string[];
  content: string;
  points: number;
  estimatedReadTimeInMinutes: number;
}

// New interfaces for user enrollment and progress tracking
export interface IEnrollment {
  _id?: string | ObjectId | null;
  userId: string | ObjectId;
  courseId: string | ObjectId;
  courseVersionId: string | ObjectId;
  status: 'active' | 'inactive';
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
