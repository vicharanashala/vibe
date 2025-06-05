import {ObjectId} from 'mongodb';
import {ParameterMap} from '../question-processing/tag-parser/index.js';

interface ISOLAnswer {
  lotItemId: string;
}

interface ISMLAnswer {
  lotItemIds: string[];
}

interface IOrder {
  order: number;
  lotItemId: string;
}

interface IOTLAnswer {
  orders: IOrder[];
}

interface INATAnswer {
  value: number;
}

interface IDESAnswer {
  answerText: string;
}

export type Answer =
  | ISOLAnswer
  | ISMLAnswer
  | IOTLAnswer
  | INATAnswer
  | IDESAnswer;

interface IQuestionAnswer {
  questionId: string;
  answer: Answer;
}

interface IAttempt {
  _id?: string | ObjectId;
  quizId: string | ObjectId;
  userId: string | ObjectId;
  questionDetails: IQuestionDetails[]; // List of question IDs in the quiz
  answers?: IQuestionAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

interface IQuestionDetails {
  questionId: string | ObjectId;
  parameterMap?: ParameterMap;
}

interface IQuestionAnswerFeedback {
  questionId: string | ObjectId;
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
  score: number;
  answerFeedback?: string; // Optional feedback for the answer
}

interface ISubmission {
  _id?: string | ObjectId;
  quizId: string | ObjectId;
  userId: string | ObjectId;
  attemptId: string | ObjectId;
  submittedAt: Date;
  gradingResult?: IGradingResult; // Result of the grading process
}

interface IAttemptDetails {
  attemptId: string | ObjectId;
  submissionResultId?: string | ObjectId;
}

interface IUserQuizMetrics {
  _id?: string | ObjectId;
  quizId: string | ObjectId;
  userId: string | ObjectId;
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED';
  latestAttemptId?: string | ObjectId;
  latestSubmissionResultId?: string | ObjectId;
  remainingAttempts: number;
  attempts: IAttemptDetails[];
}

export interface IGradingResult {
  totalScore?: number;
  totalMaxScore?: number;
  overallFeedback?: IQuestionAnswerFeedback[];
  gradingStatus: 'PENDING' | 'PASSED' | 'FAILED' | any;
  gradedAt?: Date;
  gradedBy?: string;
}

/**
 * Quiz should have a settings entity
 * - passThreshold: number (0-1)
 * - maxAttempts: number
 * - quizType: 'DEADLINE' | 'NO_DEADLINE'
 * - deadline: Date (optional, only for DEADLINE type)
 * - approximateTimeToComplete: number (in HH:MM:SS format)
 * - allowPartialGrading: boolean (if true, allows partial grading for questions)
 * - allowHint: boolean (if true, allows users to use hints for questions)
 * - showCorrectAnswersAfterSubmission: boolean (if true, shows correct answers after submission)
 * - showExplanationAfterSubmission: boolean (if true, shows explanation after submission)
 * - showScoreAfterSubmission: boolean (if true, shows score after submission
 */

interface IQuizSettings {
  _id?: string | ObjectId;
  quizId: string | ObjectId;
  passThreshold: number; // 0-1
  maxAttempts: number; // Maximum number of attempts allowed
  quizType: 'DEADLINE' | 'NO_DEADLINE'; // Type of quiz
  deadline?: Date; // Deadline for the quiz, only applicable for DEADLINE type
  approximateTimeToComplete: string; // Approximate time to complete in HH:MM:SS format
  allowPartialGrading: boolean; // If true, allows partial grading for questions
  allowHint: boolean; // If true, allows users to use hints for questions
  showCorrectAnswersAfterSubmission: boolean; // If true, shows correct answers after submission
  showExplanationAfterSubmission: boolean; // If true, shows explanation after submission
  showScoreAfterSubmission: boolean; // If true, shows score after submission
  createdAt: Date;
  updatedAt: Date;
}

/**
 * There is one-to-one mapping for attempt and submission.
 * Each attempt will have a corresponding submission result.
 *
 *
 * POST /quiz/:quizId/attempt/
 * - Create a new attempt for the quiz
 *   - If quiz is of type 'DEADLINE'
 *     - Check if time of attempt < deadline
 *     - If yes, proceed
 *     - If no, return an error
 *   - Check if IUserQuizDetails exists for the user and quiz
 *   - If not, create a new IUserQuizDetails
 *   - If exists, proceed
 *   - If available attempts > 0,
 *     - proceed to create a new attempt
 *     - Reduces the number of available attempts by 1
 *     - Return the attempt ID
 *   - If no available attempts, return an error
 *
 * POST /quiz/:quizId/attempt/save
 * - Save the current attempt
 *   - If quiz is of type 'DEADLINE'
 *     - Check if time of save < deadline
 *     - If yes, proceed
 *     - If no, return an error
 *   - Updates the attempt in the database
 *   - Returns the updated attempt
 *
 * POST /quiz/:quizId/attempt/submit
 * - Submit the current attempt
 *  - If quiz is of type 'DEADLINE'
 *    - Check if time of submission < deadline
 *    - If yes, proceed
 *    - If no, return an error
 *  - Check if any SubmissionResult exists for the attemptId
 *    - If exists, return an error
 *    - If not, proceed
 *  - Create SubmissionResult
 *    - Set gradingStatus to 'PENDING'
 *    - Set submittedAt to current time
 *    - Calculate total score based on points for each question in the attempt
 *    - Set totalScore to the calculated score
 *    - Start a background job to grade the attempt
 *    - Return the submission result ID
 *
 */

export {
  IQuestionAnswer,
  ISOLAnswer,
  ISMLAnswer,
  IOTLAnswer,
  INATAnswer,
  IDESAnswer,
  IAttempt,
  ISubmission,
  IAttemptDetails,
  IUserQuizMetrics,
  IQuizSettings,
  IQuestionDetails,
  IQuestionAnswerFeedback,
};
