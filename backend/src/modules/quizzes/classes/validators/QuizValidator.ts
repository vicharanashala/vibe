import {
  IQuestionAnswer,
  Answer,
  IGradingResult,
  IQuestionAnswerFeedback,
  IAttemptDetails,
  IQuestionDetails,
  IAttempt,
  ISubmission,
} from '#quizzes/interfaces/grading.js';
import {IQuestionRenderView, ParameterMap} from '#quizzes/question-processing/index.js';
import {ItemType, IQuizDetails, IQuestionBankRef} from '#shared/interfaces/models.js';
import {Type} from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsArray,
  IsNumber,
  ValidateNested,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsDate,
  IsBoolean,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {ObjectId} from 'mongodb';
import {QuestionBankRef} from '../transformers/QuestionBank.js';
import {QuestionType} from '#root/shared/interfaces/quiz.js';
import { Question } from './QuestionValidator.js';

class QuestionAnswerFeedback implements IQuestionAnswerFeedback {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question',
    type: 'string',
    example: '60d21b4667d0d8992e610c02',
  })
  questionId: string | ObjectId;

  @IsEnum(['CORRECT', 'INCORRECT', 'PARTIAL'])
  @IsNotEmpty()
  @JSONSchema({
    description: 'Status of the answer',
    type: 'string',
    enum: ['CORRECT', 'INCORRECT', 'PARTIAL'],
    example: 'CORRECT',
  })
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Score for the answer',
    type: 'number',
    example: 5,
  })
  score: number;

  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Feedback for the answer',
    type: 'string',
    example: 'Good job! You answered correctly.',
  })
  answerFeedback?: string; // Optional feedback for the answer
}

// Request Schemas
class CreateAttemptParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string;
}

class SaveAttemptParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  attemptId: string;
}

class SubmitAttemptParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  attemptId: string;
}

class GetAttemptResponse implements IAttempt {
  @IsMongoId()
  @JSONSchema({
    description: 'ID of the attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  _id?: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the user',
    type: 'string',
    example: '60d21b4667d0d8992e610c01',
  })
  userId: string | ObjectId;

  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => QuestionDetails)
  @JSONSchema({
    description: 'List of question details in the quiz',
    type: 'array',
    items: { $ref: '#/components/schemas/QuestionDetails' },
    example: [{ questionId: '60d21b4667d0d8992e610c02' }],
  })
  questionDetails: IQuestionDetails[];

  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => QuestionAnswer)
  @JSONSchema({
    description: 'Answers for the attempt',
    type: 'array',
    items: { $ref: '#/components/schemas/QuestionAnswer' },
  })
  answers?: IQuestionAnswer[];

  @IsDate()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Creation date',
    type: 'string',
    format: 'date-time',
    example: '2024-06-18T12:00:00.000Z',
  })
  createdAt: Date;

  @IsDate()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Last update date',
    type: 'string',
    format: 'date-time',
    example: '2024-06-18T12:30:00.000Z',
  })
  updatedAt: Date;
}

class SOLAnswer {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the selected lot item',
    type: 'string',
    example: '60d21b4667d0d8992e610c10',
  })
  lotItemId: string;
}

class SMLAnswer {
  @IsArray()
  @IsMongoId({each: true})
  @IsNotEmpty()
  @JSONSchema({
    description: 'IDs of the selected lot items',
    type: 'array',
    items: { type: 'string', example: '60d21b4667d0d8992e610c10' },
    example: ['60d21b4667d0d8992e610c10', '60d21b4667d0d8992e610c11'],
  })
  lotItemIds: string[];
}

class Order {
  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Order of the lot item',
    type: 'number',
    example: 1,
  })
  order: number;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the lot item',
    type: 'string',
    example: '60d21b4667d0d8992e610c10',
  })
  lotItemId: string;
}

class OTLAnswer {
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => Order)
  @IsNotEmpty()
  @JSONSchema({
    description: 'Orderings of lot items',
    type: 'array',
    items: { $ref: '#/components/schemas/Order' },
    example: [{ order: 1, lotItemId: '60d21b4667d0d8992e610c10' }],
  })
  orders: Order[];
}

class NATAnswer {
  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Numeric answer value',
    type: 'number',
    example: 42,
  })
  value: number;
}

class DESAnswer {
  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Descriptive answer text',
    type: 'string',
    example: 'The answer is four.',
  })
  answerText: string;
}

enum QuestionTypeEnum {
  SELECT_ONE_IN_LOT = 'SELECT_ONE_IN_LOT',
  SELECT_MANY_IN_LOT = 'SELECT_MANY_IN_LOT',
  ORDER_THE_LOTS = 'ORDER_THE_LOTS',
  NUMERIC_ANSWER_TYPE = 'NUMERIC_ANSWER_TYPE',
  DESCRIPTIVE = 'DESCRIPTIVE',
}

class QuestionAnswer implements IQuestionAnswer {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question',
    type: 'string',
    example: '60d21b4667d0d8992e610c02',
  })
  questionId: string;

  @IsString()
  @JSONSchema({
    description: 'Type of the question',
    type: 'string',
    enum: [
      'SELECT_ONE_IN_LOT',
      'SELECT_MANY_IN_LOT',
      'ORDER_THE_LOTS',
      'NUMERIC_ANSWER_TYPE',
      'DESCRIPTIVE',
    ],
    example: 'SELECT_ONE_IN_LOT',
  })
  questionType: QuestionType;

  @JSONSchema({
    description: 'Answer for the question',
    oneOf: [
      { 
        $ref: '#/components/schemas/SOLAnswer',
        title: 'Select One in Lot Answer',
        description: 'Commonly reffered as MCQ (Multiple Choice Question)',
      },
      { 
        $ref: '#/components/schemas/SMLAnswer',
        title: 'Select Many in Lot Answer',
        description: 'Commonly reffered as MSQ (Multiple Select Question)',
      },
      { 
        $ref: '#/components/schemas/OTLAnswer',
        title: 'Order the Lots Answer',
      },
      { 
        $ref: '#/components/schemas/NATAnswer',
        title: 'Numeric Answer Type',
      },
      { 
        $ref: '#/components/schemas/DESAnswer',
        title: 'Descriptive Answer', 
      },
    ],
  })
  @ValidateNested()
  @Type((type) => {

    if (!type) {
      return Object;
    }

    switch (type.object.questionType as QuestionType) {
      case 'SELECT_ONE_IN_LOT':
        return SOLAnswer;
      case 'SELECT_MANY_IN_LOT':
        return SMLAnswer;
      case 'ORDER_THE_LOTS':
        return OTLAnswer;
      case 'NUMERIC_ANSWER_TYPE':
        return NATAnswer;
      case 'DESCRIPTIVE':
        return DESAnswer;
      default:
        throw new Error(`Unsupported question type: ${type.object.questionType}`);
    }
  })
  @IsNotEmpty()
  answer: Answer;
}

class QuestionDetails implements IQuestionDetails {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question',
    type: 'string',
    example: '60d21b4667d0d8992e610c02',
  })
  questionId: string | ObjectId;

  @IsOptional()
  @JSONSchema({
    description: 'Parameter map for the question',
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    example: { difficulty: 'easy', maxScore: 10 }
  })
  parameterMap?: ParameterMap;
}

class QuestionAnswersBody {
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => QuestionAnswer)
  @JSONSchema({
    description: 'Array of answers for the quiz',
    type: 'array',
    items: { $ref: '#/components/schemas/QuestionAnswer' },
  })
  answers: QuestionAnswer[];
}

class QuestionRenderView extends Question implements IQuestionRenderView {
  @IsOptional()
  @ValidateNested()
  @JSONSchema({
    description: 'Parameter map for the question',
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    example: { difficulty: 'easy', maxScore: 10 }
  })
  parameterMap?: ParameterMap;
}

// Response Schemas
class CreateAttemptResponse {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the created attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  attemptId: string;

  @IsMongoId()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => QuestionRenderView)
  @JSONSchema({
    description: 'Question render views for the attempt',
    type: 'array',
    items: { $ref: '#/components/schemas/QuestionRenderView' },
  })
  questionRenderViews: IQuestionRenderView[];
}

class SubmitAttemptResponse implements Partial<IGradingResult> {
  @IsNumber()
  @IsOptional()
  @JSONSchema({
    description: 'Total score for the attempt',
    type: 'number',
    example: 8,
  })
  totalScore?: number;

  @IsNumber()
  @IsOptional()
  @JSONSchema({
    description: 'Maximum possible score for the attempt',
    type: 'number',
    example: 10,
  })
  totalMaxScore?: number;

  @IsMongoId()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => QuestionAnswerFeedback)
  @JSONSchema({
    description: 'Overall feedback for the attempt',
    type: 'array',
    items: { $ref: '#/components/schemas/QuestionAnswerFeedback' },
  })
  overallFeedback?: IQuestionAnswerFeedback[];

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Grading status',
    type: 'string',
    enum: ['PENDING', 'PASSED', 'FAILED'],
    example: 'PASSED',
  })
  gradingStatus: any;

  @IsDateString()
  @IsOptional()
  @JSONSchema({
    description: 'Date when graded',
    example: '2024-06-18T12:30:00.000Z',
  })
  gradedAt?: Date;

  @IsString()
  @IsOptional()
  @JSONSchema({
    description: 'User who graded the attempt',
    type: 'string',
    example: 'admin',
  })
  gradedBy?: string;
}

class QuizIdParam {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string;
}

class QuizAttemptParam {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  attemptId: string;
}

class QuizSubmissionParam {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the submission',
    type: 'string',
    example: '60d21b4667d0d8992e610c77',
  })
  submissionId: string;
}

class UpdateQuizSubmissionParam {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the submission',
    type: 'string',
    example: '60d21b4667d0d8992e610c77',
  })
  submissionId: string;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Score to update',
    type: 'number',
    example: 8,
  })
  score: number;
}

class RemoveQuestionBankParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question bank',
    type: 'string',
    example: '60d21b4667d0d8992e610c88',
  })
  questionBankId: string;
}

class AddFeedbackParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the submission',
    type: 'string',
    example: '60d21b4667d0d8992e610c77',
  })
  submissionId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question',
    type: 'string',
    example: '60d21b4667d0d8992e610c02',
  })
  questionId: string;
}

class GetUserMatricesParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the user',
    type: 'string',
    example: '60d21b4667d0d8992e610c01',
  })
  userId: string;
}

class AddQuestionBankBody implements QuestionBankRef {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question bank',
    type: 'string',
    example: '60d21b4667d0d8992e610c88',
  })
  bankId: string;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Number of questions to pick',
    type: 'number',
    example: 10,
  })
  count: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @JSONSchema({
    description: 'Difficulty filters',
    type: 'array',
    items: { type: 'string', example: 'easy' },
    example: ['easy', 'medium'],
  })
  difficulty?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @JSONSchema({
    description: 'Tags filters',
    type: 'array',
    items: { type: 'string', example: 'math' },
    example: ['math', 'science'],
  })
  tags?: string[];
}

class EditQuestionBankBody implements Partial<QuestionBankRef> {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question bank',
    type: 'string',
    example: '60d21b4667d0d8992e610c88',
  })
  bankId: string;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Number of questions to pick',
    type: 'number',
    example: 10,
  })
  count: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @JSONSchema({
    description: 'Difficulty filters',
    type: 'array',
    items: { type: 'string', example: 'easy' },
    example: ['easy', 'medium'],
  })
  difficulty?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @JSONSchema({
    description: 'Tags filters',
    type: 'array',
    items: { type: 'string', example: 'math' },
    example: ['math', 'science'],
  })
  tags?: string[];
}

class RegradeSubmissionBody implements Partial<IGradingResult> {
  @IsNumber()
  @IsOptional()
  @JSONSchema({
    description: 'Total score after regrading',
    type: 'number',
    example: 8,
  })
  totalScore?: number;

  @IsNumber()
  @IsOptional()
  @JSONSchema({
    description: 'Maximum possible score after regrading',
    type: 'number',
    example: 10,
  })
  totalMaxScore?: number;

  @IsOptional()
  @JSONSchema({
    description: 'Overall feedback after regrading',
    type: 'array',
    items: {$ref: '#/components/schemas/QuestionAnswerFeedback'},
  })
  overallFeedback?: IQuestionAnswerFeedback[];

  @IsEnum(['PENDING', 'PASSED', 'FAILED'])
  @IsNotEmpty()
  @JSONSchema({
    description: 'Grading status after regrading',
    type: 'string',
    enum: ['PENDING', 'PASSED', 'FAILED'],
    example: 'PASSED',
  })
  gradingStatus: 'PENDING' | 'PASSED' | 'FAILED' | any;
}

class AddFeedbackBody {
  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Feedback text',
    type: 'string',
    example: 'Great answer!',
  })
  feedback: string;
}

class AttemptDetails implements IAttemptDetails {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  attemptId: string | ObjectId;

  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the submission result',
    type: 'string',
    example: '60d21b4667d0d8992e610c77',
  })
  submissionResultId?: string | ObjectId;
}

class UserQuizMetricsResponse {
  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the metrics record',
    type: 'string',
    example: '60d21b4667d0d8992e610c01',
  })
  _id?: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the user',
    type: 'string',
    example: '60d21b4667d0d8992e610c01',
  })
  userId: string | ObjectId;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Latest attempt status',
    type: 'string',
    enum: ['ATTEMPTED', 'SUBMITTED'],
    example: 'ATTEMPTED',
  })
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED';

  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the latest attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  latestAttemptId?: string | ObjectId;

  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the latest submission result',
    type: 'string',
    example: '60d21b4667d0d8992e610c77',
  })
  latestSubmissionResultId?: string | ObjectId;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Number of remaining attempts',
    type: 'number',
    example: 2,
  })
  remainingAttempts: number;

  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => AttemptDetails)
  @JSONSchema({
    description: 'List of attempts',
    type: 'array',
    items: { $ref: '#/components/schemas/AttemptDetails' },
  })
  attempts: IAttemptDetails[];
}

class QuizAttemptResponse {
  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  _id?: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the user',
    type: 'string',
    example: '60d21b4667d0d8992e610c01',
  })
  userId: string | ObjectId;

  @IsNotEmpty()
  @JSONSchema({
    description: 'List of question details in the quiz',
    type: 'array',
    items: { type: 'object' },
  })
  questionDetails: IQuestionDetails[];

  @IsOptional()
  @JSONSchema({
    description: 'Answers for the attempt',
    type: 'array',
    items: { type: 'object' },
  })
  answers?: IQuestionAnswer[];

  @IsDate()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Creation date',
    type: 'string',
    format: 'date-time',
    example: '2024-06-18T12:00:00.000Z',
  })
  createdAt: Date;

  @IsDate()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Last update date',
    type: 'string',
    format: 'date-time',
    example: '2024-06-18T12:30:00.000Z',
  })
  updatedAt: Date;
}

class GradingResult implements IGradingResult {
  @IsNumber()
  @IsOptional()
  @JSONSchema({
    description: 'Total score for the grading result',
    type: 'number',
    example: 8,
  })
  totalScore?: number;

  @IsNumber()
  @IsOptional()
  @JSONSchema({
    description: 'Maximum possible score for the grading result',
    type: 'number',
    example: 10,
  })
  totalMaxScore?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => QuestionAnswerFeedback)
  @JSONSchema({
    description: 'Overall feedback for the grading result',
    type: 'array',
    items: { $ref: '#/components/schemas/QuestionAnswerFeedback' },
  })
  overallFeedback?: IQuestionAnswerFeedback[];
  gradingStatus: 'PENDING' | 'PASSED' | 'FAILED' | any;
  gradedAt?: Date;
  gradedBy?: string;
}

class QuizSubmissionResponse {
  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the submission',
    type: 'string',
    example: '60d21b4667d0d8992e610c77',
  })
  _id?: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the user',
    type: 'string',
    example: '60d21b4667d0d8992e610c01',
  })
  userId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  attemptId: string | ObjectId;

  @IsDate()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Submission date',
    example: '2024-06-18T12:45:00.000Z',
  })
  submittedAt: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => GradingResult)
  @JSONSchema({
    description: 'Grading result for the submission',
    type: 'object',
    items: {$ref: '#/components/schemas/GradingResult'},
  })
  gradingResult?: IGradingResult;
}

class QuizDetails implements IQuizDetails {
  @ValidateNested({each: true})
  @Type(() => QuestionBankRef)
  @IsArray()
  @IsNotEmpty()
  @JSONSchema({
    description: 'List of question banks referenced in the quiz',
    type: 'array',
    items: { $ref: '#/components/schemas/QuestionBankRef' },
  })
  questionBankRefs: IQuestionBankRef[]; // question ids

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Passing threshold for the quiz',
    type: 'number',
    example: 0.7,
  })
  passThreshold: number; // 0-1

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Maximum number of attempts allowed',
    type: 'number',
    example: 3,
  })
  maxAttempts: number; // Maximum number of attempts allowed

  @IsEnum(['DEADLINE', 'NO_DEADLINE'])
  @IsNotEmpty()
  @JSONSchema({
    description: 'Type of the quiz',
    type: 'string',
    enum: ['DEADLINE', 'NO_DEADLINE'],
    example: 'DEADLINE',
  })
  quizType: 'DEADLINE' | 'NO_DEADLINE'; // Type of quiz

  @IsDate()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Release time for the quiz',
    example: '2024-06-18T12:00:00.000Z',
  })
  releaseTime: Date; // Release time for the quiz

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Number of questions visible to the user at a time',
    type: 'number',
    example: 5,
  })
  questionVisibility: number; // Number of questions visible to the user at a time

  @IsDate()
  @IsOptional()
  @JSONSchema({
    description: 'Deadline for the quiz, only applicable for DEADLINE type',
    example: '2024-06-25T12:00:00.000Z',
  })
  deadline?: Date; // Deadline for the quiz, only applicable for DEADLINE type

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Approximate time to complete the quiz',
    type: 'string',
    example: '01:30:00',
  })
  approximateTimeToComplete: string; // Approximate time to complete in HH:MM:SS format

  @IsBoolean()
  @IsNotEmpty()
  @JSONSchema({
    description: 'If true, allows partial grading for SML questions',
    type: 'boolean',
    example: true,
  })
  allowPartialGrading: boolean; // If true, allows partial grading for questions

  @IsBoolean()
  @IsNotEmpty()
  @JSONSchema({
    description: 'If true, allows users to use hints for questions',
    type: 'boolean',
    example: false,
  })
  allowHint: boolean; // If true, allows users to use hints for questions

  @IsBoolean()
  @IsNotEmpty()
  @JSONSchema({
    description: 'If true, shows correct answers after submission',
    type: 'boolean',
    example: true,
  })
  showCorrectAnswersAfterSubmission: boolean; // If true, shows correct answers after submission

  @IsBoolean()
  @IsNotEmpty()
  @JSONSchema({
    description: 'If true, shows explanation after submission',
    type: 'boolean',
    example: true,
  })
  showExplanationAfterSubmission: boolean; // If true, shows explanation after submission

  @IsBoolean()
  @IsNotEmpty()
  @JSONSchema({
    description: 'If true, shows score after submission',
    type: 'boolean',
    example: true,
  })
  showScoreAfterSubmission: boolean; // If true, shows score after submission
}

class QuizDetailsResponse {
  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  _id?: string | ObjectId;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Name of the quiz',
    type: 'string',
    example: 'Algebra Quiz',
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Description of the quiz',
    type: 'string',
    example: 'A quiz on algebra basics.',
  })
  description: string;

  @IsEnum(ItemType)
  @IsNotEmpty()
  @JSONSchema({
    description: 'Type of the quiz',
    type: 'string',
    enum: Object.values(ItemType),
    example: 'QUIZ',
  })
  type: ItemType;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuizDetails)
  @JSONSchema({
    description: 'Quiz details',
    items: {$ref: '#/components/schemas/QuizDetails'},
  })
  details?: IQuizDetails;
}

class QuizAnalyticsResponse {
  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Total number of attempts',
    type: 'number',
    example: 100,
  })
  totalAttempts: number;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Number of submissions',
    type: 'number',
    example: 80,
  })
  submissions: number;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Pass rate (%)',
    type: 'number',
    example: 75,
  })
  passRate: number;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Average score',
    type: 'number',
    example: 7.5,
  })
  averageScore: number;
}

class QuizPerformanceResponse {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question',
    type: 'string',
    example: '60d21b4667d0d8992e610c02',
  })
  questionId: string;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Correct answer rate (%)',
    type: 'number',
    example: 80,
  })
  correctRate: number;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Average score for the question',
    type: 'number',
    example: 4.2,
  })
  averageScore: number;
}

class QuizResultsResponse {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the student',
    type: 'string',
    example: '60d21b4667d0d8992e610c01',
  })
  studentId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  attemptId: string | ObjectId;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Score for the attempt',
    type: 'number',
    example: 9,
  })
  score: number;

  @IsEnum(['PENDING', 'PASSED', 'FAILED'])
  @IsNotEmpty()
  @JSONSchema({
    description: 'Status of the attempt',
    type: 'string',
    enum: ['PENDING', 'PASSED', 'FAILED'],
    example: 'PASSED',
  })
  status: 'PENDING' | 'PASSED' | 'FAILED' | any;
}

class FlaggedQuestionResponse {
  // Not yet implemented
}

class SubmissionResponse implements ISubmission {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the submission',
    type: 'string',
    example: '60d21b4667d0d8992e610c77',
  })
  _id: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the quiz',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  quizId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the user',
    type: 'string',
    example: '60d21b4667d0d8992e610c01',
  })
  userId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the attempt',
    type: 'string',
    example: '60d21b4667d0d8992e610c99',
  })
  attemptId: string;

  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  @JSONSchema({
    description: 'Submission date',
    type: 'string',
    format: 'date-time',
    example: '2024-06-18T12:45:00.000Z',
  })
  submittedAt: Date;

  @IsOptional()
  @JSONSchema({
    description: 'Grading result for the submission',
    type: 'object',
  })
  gradingResult?: IGradingResult;
}

class GetAllSubmissionsResponse {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionResponse)
  @JSONSchema({
    description: 'List of all submissions',
    type: 'array',
    items: { type: 'object' },
  })
  submissions: SubmissionResponse[];
}

class QuestionBankRefResponse implements IQuestionBankRef {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question bank',
    type: 'string',
    example: '60d21b4667d0d8992e610c88',
  })
  bankId: string;

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Number of questions to pick',
    type: 'number',
    example: 10,
  })
  count: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @JSONSchema({
    description: 'Difficulty filters',
    type: 'array',
    items: { type: 'string', example: 'easy' },
    example: ['easy', 'medium'],
  })
  difficulty?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @JSONSchema({
    description: 'Tags filters',
    type: 'array',
    items: { type: 'string', example: 'math' },
    example: ['math', 'science'],
  })
  tags?: string[];

  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Type filter',
    type: 'string',
    example: 'MCQ',
  })
  type?: string;
}

class AttemptNotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message.',
    example:
      'No attempt found.',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

class QuizNotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message.',
    example: 'Quiz not found.',
    type: 'string',
    readOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

class GetAllQuestionBanksResponse {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionBankRefResponse)
  @JSONSchema({
    description: 'List of all question banks',
    type: 'array',
    items: { $ref: '#/components/schemas/QuestionBankRef' },
  })
  questionBanks: IQuestionBankRef[];
}

export {
  CreateAttemptParams,
  SaveAttemptParams,
  SubmitAttemptParams,
  CreateAttemptResponse,
  SubmitAttemptResponse,
  GetAttemptResponse,
  QuestionAnswersBody,
  AddQuestionBankBody,
  EditQuestionBankBody,
  RegradeSubmissionBody,
  AddFeedbackBody,
  QuizIdParam,
  QuizAttemptParam,
  QuizSubmissionParam,
  UpdateQuizSubmissionParam,
  RemoveQuestionBankParams,
  GetUserMatricesParams,
  AddFeedbackParams,
  UserQuizMetricsResponse,
  QuizAttemptResponse,
  QuizSubmissionResponse,
  QuizDetailsResponse,
  QuizAnalyticsResponse,
  QuizPerformanceResponse,
  QuizResultsResponse,
  FlaggedQuestionResponse,
  AttemptNotFoundErrorResponse,
  GetAllSubmissionsResponse,
  QuizNotFoundErrorResponse,
  GetAllQuestionBanksResponse
};

export const QUIZ_VALIDATORS = [
  CreateAttemptParams,
  SaveAttemptParams,
  SubmitAttemptParams,
  CreateAttemptResponse,
  SubmitAttemptResponse,
  GetAttemptResponse,
  QuestionAnswersBody,
  AddQuestionBankBody,
  EditQuestionBankBody,
  RegradeSubmissionBody,
  AddFeedbackBody,
  QuizIdParam,
  QuizAttemptParam,
  QuizSubmissionParam,
  UpdateQuizSubmissionParam,
  RemoveQuestionBankParams,
  GetUserMatricesParams,
  AddFeedbackParams,
  UserQuizMetricsResponse,
  QuizAttemptResponse,
  QuizSubmissionResponse,
  QuizDetailsResponse,
  QuizAnalyticsResponse,
  QuizPerformanceResponse,
  QuizResultsResponse,
  FlaggedQuestionResponse,
  AttemptNotFoundErrorResponse,
  GetAllSubmissionsResponse,
  QuizNotFoundErrorResponse,
  GetAllQuestionBanksResponse
]