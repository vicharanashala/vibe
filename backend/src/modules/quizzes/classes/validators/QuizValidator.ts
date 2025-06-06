import {
  IQuestionAnswer,
  Answer,
  IGradingResult,
  IQuestionAnswerFeedback,
  IAttemptDetails,
  IQuestionDetails,
} from '#quizzes/interfaces/grading.js';
import {IQuestionRenderView} from '#quizzes/question-processing/index.js';
import {QuestionType, ItemType, IQuizDetails} from '#shared/index.js';
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
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {ObjectId} from 'mongodb';
import {QuestionBankRef} from '../transformers/QuestionBank.js';

// Request Schemas
class CreateAttemptParams {
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;
}

class SaveAttemptParams {
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;

  @IsMongoId()
  @IsNotEmpty()
  attemptId: string;
}

class SubmitAttemptParams {
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;

  @IsMongoId()
  @IsNotEmpty()
  attemptId: string;
}

class SOLAnswer {
  @IsMongoId()
  @IsNotEmpty()
  lotItemId: string;
}

class SMLAnswer {
  @IsArray()
  @IsMongoId({each: true})
  @IsNotEmpty()
  lotItemIds: string[];
}

class Order {
  @IsNumber()
  @IsNotEmpty()
  order: number;

  @IsMongoId()
  @IsNotEmpty()
  lotItemId: string;
}

class OTLAnswer {
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => Order)
  @IsNotEmpty()
  orders: Order[];
}

class NATAnswer {
  @IsNumber()
  @IsNotEmpty()
  value: number;
}

class DESAnswer {
  @IsString()
  @IsNotEmpty()
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
  questionId: string;

  @IsNotEmpty()
  @IsEnum(QuestionTypeEnum)
  @IsString()
  @ValidateNested()
  questionType: QuestionType;

  @JSONSchema({
    anyOf: [
      {
        $ref: '#/components/schemas/SOLAnswer',
      },
      {
        $ref: '#/components/schemas/SMLAnswer',
      },
      {
        $ref: '#/components/schemas/OTLAnswer',
      },
      {
        $ref: '#/components/schemas/NATAnswer',
      },
      {
        $ref: '#/components/schemas/DESAnswer',
      },
    ],
  })
  @ValidateNested()
  @Type(({object}) => {
    switch (object.questionType as QuestionType) {
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
        throw new Error(`Unsupported question type: ${object.questionType}`);
    }
  })
  @IsNotEmpty()
  answer: Answer;
}

class QuestionAnswersBody {
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => QuestionAnswer)
  answers: QuestionAnswer[];
}

// Response Schemas
class CreateAttemptResponse {
  @IsMongoId()
  @IsNotEmpty()
  attemptId: string;

  @IsMongoId()
  @IsNotEmpty()
  @ValidateNested({each: true})
  questionRenderViews: IQuestionRenderView[];
}

class SubmitAttemptResponse implements Partial<IGradingResult> {
  @IsNumber()
  @IsOptional()
  totalScore?: number;

  @IsNumber()
  @IsOptional()
  totalMaxScore?: number;

  @IsMongoId()
  @IsNotEmpty()
  overallFeedback?: IQuestionAnswerFeedback[];

  @IsString()
  @IsNotEmpty()
  gradingStatus: any;

  @IsDateString()
  @IsOptional()
  gradedAt?: Date;

  @IsString()
  @IsOptional()
  gradedBy?: string;
}

class QuizIdParam {
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;
}

class QuizAttemptParam {
  @IsMongoId()
  @IsNotEmpty()
  attemptId: string;
}

class QuizSubmissionParam {
  @IsMongoId()
  @IsNotEmpty()
  submissionId: string;
}

class UpdateQuizSubmissionParam {
  @IsMongoId()
  @IsNotEmpty()
  submissionId: string;

  @IsNumber()
  @IsNotEmpty()
  score: number;
}

class RemoveQuestionBankParams {
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;

  @IsMongoId()
  @IsNotEmpty()
  questionBankId: string;
}

class AddFeedbackParams {
  @IsMongoId()
  @IsNotEmpty()
  submissionId: string;

  @IsMongoId()
  @IsNotEmpty()
  questionId: string;
}

class GetUserMatricesParams {
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;

  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}

class AddQuestionBankBody implements QuestionBankRef {
  @IsMongoId()
  @IsNotEmpty()
  bankId: string;

  @IsNumber()
  @IsNotEmpty()
  count: number;

  @IsArray()
  @IsOptional()
  difficulty?: string[];

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  tag?: string;
}

class EditQuestionBankBody implements Partial<QuestionBankRef> {
  @IsMongoId()
  @IsNotEmpty()
  bankId: string;

  @IsNumber()
  @IsNotEmpty()
  count: number;

  @IsArray()
  @IsOptional()
  difficulty?: string[];

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  tag?: string;
}

class RegradeSubmissionBody implements Partial<IGradingResult> {
  @IsNumber()
  @IsOptional()
  totalScore?: number;

  @IsNumber()
  @IsOptional()
  totalMaxScore?: number;

  @IsOptional()
  overallFeedback?: IQuestionAnswerFeedback[];

  @IsEnum(['PENDING', 'PASSED', 'FAILED'])
  @IsNotEmpty()
  gradingStatus: 'PENDING' | 'PASSED' | 'FAILED' | any;

  @IsDate()
  @IsOptional()
  gradedAt?: Date;

  @IsString()
  @IsOptional()
  gradedBy?: string;
}

class AddFeedbackBody {
  @IsString()
  @IsNotEmpty()
  feedback: string;
}

class UserQuizMetricsResponse {
  @IsMongoId()
  @IsOptional()
  _id?: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  quizId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  userId: string | ObjectId;

  @IsString()
  @IsNotEmpty()
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED';

  @IsMongoId()
  @IsOptional()
  latestAttemptId?: string | ObjectId;

  @IsMongoId()
  @IsOptional()
  latestSubmissionResultId?: string | ObjectId;

  @IsNumber()
  @IsNotEmpty()
  remainingAttempts: number;

  @IsNotEmpty()
  attempts: IAttemptDetails[];
}

class QuizAttemptResponse {
  @IsMongoId()
  @IsOptional()
  _id?: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  quizId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  userId: string | ObjectId;

  @IsNotEmpty()
  questionDetails: IQuestionDetails[]; // List of question IDs in the quiz

  @IsOptional()
  answers?: IQuestionAnswer[];

  @IsDate()
  @IsNotEmpty()
  createdAt: Date;

  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;
}

class QuizSubmissionResponse {
  @IsMongoId()
  @IsOptional()
  _id?: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  quizId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  userId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  attemptId: string | ObjectId;

  @IsDate()
  @IsNotEmpty()
  submittedAt: Date;

  @IsOptional()
  gradingResult?: IGradingResult;
}

class QuizDetailsResponse {
  @IsMongoId()
  @IsOptional()
  _id?: string | ObjectId;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(ItemType)
  @IsNotEmpty()
  type: ItemType;

  @IsOptional()
  details?: IQuizDetails;
}

class QuizAnalyticsResponse {
  @IsNumber()
  @IsNotEmpty()
  totalAttempts: number;

  @IsNumber()
  @IsNotEmpty()
  submissions: number;

  @IsNumber()
  @IsNotEmpty()
  passRate: number;

  @IsNumber()
  @IsNotEmpty()
  averageScore: number;
}

class QuizPerformanceResponse {
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;

  @IsNumber()
  @IsNotEmpty()
  correctRate: number;

  @IsNumber()
  @IsNotEmpty()
  averageScore: number;
}

class QuizResultsResponse {
  @IsMongoId()
  @IsNotEmpty()
  studentId: string | ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  attemptId: string | ObjectId;

  @IsNumber()
  @IsNotEmpty()
  score: number;

  @IsEnum(['PENDING', 'PASSED', 'FAILED'])
  @IsNotEmpty()
  status: 'PENDING' | 'PASSED' | 'FAILED' | any;
}

class FlaggedQuestionResponse {
  //not yet implemented
}

export {
  CreateAttemptParams,
  SaveAttemptParams,
  SubmitAttemptParams,
  CreateAttemptResponse,
  SubmitAttemptResponse,
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
};
