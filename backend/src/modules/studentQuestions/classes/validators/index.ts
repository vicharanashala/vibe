import {
  CreateStudentQuestionBody,
  StudentQuestionOptionBody,
  StudentQuestionCreateResponse,
  StudentQuestionOptionItem,
  StudentQuestionListItem,
  StudentQuestionListQuery,
  StudentQuestionListResponse,
  StudentQuestionPathParams,
} from './StudentQuestionValidator.js';

export * from './StudentQuestionValidator.js';

export const STUDENT_QUESTION_VALIDATORS: Function[] = [
  StudentQuestionPathParams,
  CreateStudentQuestionBody,
  StudentQuestionOptionBody,
  StudentQuestionCreateResponse,
  StudentQuestionListQuery,
  StudentQuestionOptionItem,
  StudentQuestionListResponse,
  StudentQuestionListItem,
];
