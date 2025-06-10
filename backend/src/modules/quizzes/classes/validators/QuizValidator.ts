import {Type} from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  Answer,
  IAttempt,
  IAttemptDetails,
  IGradingResult,
  IQuestionAnswer,
  IQuestionAnswerFeedback,
  IQuestionDetails,
} from 'modules/quizzes/interfaces/grading';
import {IQuestionRenderView} from 'modules/quizzes/question-processing/renderers';
import {ObjectId} from 'mongodb';
import {IQuizDetails, ItemType} from 'shared/interfaces/Models';
import {IQuestion, QuestionType} from 'shared/interfaces/quiz';
import {QuestionBankRef} from '../transformers/QuestionBank';

// Request Schemas
class CreateAttemptParams {
  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz to attempt',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;
}

class SaveAttemptParams {
  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz being attempted',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;

  @JSONSchema({
    title: 'Attempt ID',
    description: 'Unique identifier of the quiz attempt to save',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  attemptId: string;
}

class SubmitAttemptParams {
  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz being submitted',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;

  @JSONSchema({
    title: 'Attempt ID',
    description: 'Unique identifier of the quiz attempt to submit',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  attemptId: string;
}

class SOLAnswer {
  @JSONSchema({
    title: 'Lot Item ID',
    description: 'Selected lot item identifier for single selection question',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  lotItemId: string;
}

class SMLAnswer {
  @JSONSchema({
    title: 'Lot Item IDs',
    description:
      'Array of selected lot item identifiers for multiple selection question',
    example: ['60d5ec49b3f1c8e4a8f8b8c3', '60d5ec49b3f1c8e4a8f8b8c4'],
    type: 'array',
    items: {
      type: 'string',
      format: 'Mongo Object ID',
    },
  })
  @IsArray()
  @IsMongoId({each: true})
  @IsNotEmpty()
  lotItemIds: string[];
}

class Order {
  @JSONSchema({
    title: 'Order',
    description: 'The order position of this item in the sequence',
    example: 1,
    type: 'number',
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  order: number;

  @JSONSchema({
    title: 'Lot Item ID',
    description: 'Identifier of the lot item being ordered',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  lotItemId: string;
}

class OTLAnswer {
  @JSONSchema({
    title: 'Orders',
    description: 'Array of ordered items with their positions',
    type: 'array',
    items: {
      $ref: '#/components/schemas/Order',
    },
    example: [
      {order: 1, lotItemId: '60d5ec49b3f1c8e4a8f8b8c3'},
      {order: 2, lotItemId: '60d5ec49b3f1c8e4a8f8b8c4'},
    ],
  })
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => Order)
  @IsNotEmpty()
  orders: Order[];
}

class NATAnswer {
  @JSONSchema({
    title: 'Numeric Value',
    description: 'The numeric answer value',
    example: 42.5,
    type: 'number',
  })
  @IsNumber()
  @IsNotEmpty()
  value: number;
}

class DESAnswer {
  @JSONSchema({
    title: 'Answer Text',
    description: 'The descriptive text answer provided by the user',
    example: 'This is a detailed explanation of the concept...',
    type: 'string',
    minLength: 1,
    maxLength: 5000,
  })
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
  @JSONSchema({
    title: 'Question ID',
    description: 'Unique identifier of the question being answered',
    example: '60d5ec49b3f1c8e4a8f8b8c5',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;

  @JSONSchema({
    title: 'Question Type',
    description: 'The type of question being answered',
    example: 'SELECT_ONE_IN_LOT',
    enum: [
      'SELECT_ONE_IN_LOT',
      'SELECT_MANY_IN_LOT',
      'ORDER_THE_LOTS',
      'NUMERIC_ANSWER_TYPE',
      'DESCRIPTIVE',
    ],
  })
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
  @JSONSchema({
    title: 'Question Answers',
    description: 'Array of answers for quiz questions',
    type: 'array',
    items: {
      $ref: '#/components/schemas/QuestionAnswer',
    },
  })
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => QuestionAnswer)
  answers: QuestionAnswer[];
}

// Response Schemas
class CreateAttemptResponse {
  @JSONSchema({
    title: 'Attempt ID',
    description: 'Unique identifier of the created quiz attempt',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  attemptId: string;

  @JSONSchema({
    title: 'Question Render Views',
    description: 'Array of rendered question views for the quiz attempt',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        questionId: {
          type: 'string',
          format: 'Mongo Object ID',
        },
        questionType: {
          type: 'string',
          enum: [
            'SELECT_ONE_IN_LOT',
            'SELECT_MANY_IN_LOT',
            'ORDER_THE_LOTS',
            'NUMERIC_ANSWER_TYPE',
            'DESCRIPTIVE',
          ],
        },
      },
    },
  })
  @IsMongoId()
  @IsNotEmpty()
  @ValidateNested({each: true})
  questionRenderViews: IQuestionRenderView[];
}

class SubmitAttemptResponse implements Partial<IGradingResult> {
  @JSONSchema({
    title: 'Total Score',
    description: 'Total score achieved in the quiz attempt',
    example: 85.5,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsOptional()
  totalScore?: number;

  @JSONSchema({
    title: 'Total Maximum Score',
    description: 'Maximum possible score for the quiz',
    example: 100,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsOptional()
  totalMaxScore?: number;

  @JSONSchema({
    title: 'Overall Feedback',
    description: 'Array of feedback for each question in the quiz',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        questionId: {
          type: 'string',
          format: 'Mongo Object ID',
        },
        status: {
          type: 'string',
          enum: ['CORRECT', 'INCORRECT', 'PARTIAL'],
        },
        score: {
          type: 'number',
        },
        answerFeedback: {
          type: 'string',
        },
      },
      required: ['questionId', 'status', 'score'],
    },
  })
  @IsArray()
  @ValidateNested({each: true})
  @IsOptional()
  overallFeedback?: IQuestionAnswerFeedback[];

  @JSONSchema({
    title: 'Grading Status',
    description: 'Current status of the grading process',
    example: 'COMPLETED',
    type: 'string',
    // CHECK
    enum: ['PENDING', 'PASSED', 'FAILED'],
  })
  @IsString()
  @IsNotEmpty()
  gradingStatus: any;

  @JSONSchema({
    title: 'Graded At',
    description: 'Timestamp when the quiz was graded',
    example: '2023-06-09T10:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  gradedAt?: Date;

  @JSONSchema({
    title: 'Graded By',
    description: 'Identifier of who or what graded the quiz',
    example: 'system',
    type: 'string',
  })
  @IsString()
  @IsOptional()
  gradedBy?: string;
}

class QuizIdParam {
  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;
}

class QuizAttemptParam {
  @JSONSchema({
    title: 'Attempt ID',
    description: 'Unique identifier of the quiz attempt',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  attemptId: string;
}

class QuizSubmissionParam {
  @JSONSchema({
    title: 'Submission ID',
    description: 'Unique identifier of the quiz submission',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  submissionId: string;
}

class UpdateQuizSubmissionParam {
  @JSONSchema({
    title: 'Submission ID',
    description: 'Unique identifier of the quiz submission to update',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  submissionId: string;

  @JSONSchema({
    title: 'Score',
    description: 'New score to assign to the submission',
    example: 85.5,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsNotEmpty()
  score: number;
}

class RemoveQuestionBankParams {
  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;

  @JSONSchema({
    title: 'Question Bank ID',
    description: 'Unique identifier of the question bank to remove',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  questionBankId: string;
}

class AddFeedbackParams {
  @JSONSchema({
    title: 'Submission ID',
    description: 'Unique identifier of the quiz submission',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  submissionId: string;

  @JSONSchema({
    title: 'Question ID',
    description: 'Unique identifier of the question to add feedback to',
    example: '60d5ec49b3f1c8e4a8f8b8c5',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;
}

class GetUserMatricesParams {
  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  quizId: string;

  @JSONSchema({
    title: 'User ID',
    description: 'Unique identifier of the user',
    example: '60d5ec49b3f1c8e4a8f8b8c6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}

class AddQuestionBankBody implements QuestionBankRef {
  @JSONSchema({
    title: 'Bank ID',
    description: 'Unique identifier of the question bank to add',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  bankId: string;

  @JSONSchema({
    title: 'Count',
    description: 'Number of questions to select from the bank',
    example: 5,
    type: 'number',
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  count: number;

  @JSONSchema({
    title: 'Difficulty Levels',
    description: 'Array of difficulty levels to filter questions',
    type: 'array',
    items: {
      type: 'string',
    },
    example: ['easy', 'medium'],
  })
  @IsArray()
  @IsOptional()
  difficulty?: string[];

  @JSONSchema({
    title: 'Tags',
    description: 'Array of tags to filter questions',
    type: 'array',
    items: {
      type: 'string',
    },
    example: ['algebra', 'calculus'],
  })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @JSONSchema({
    title: 'Tag',
    description: 'Single tag to filter questions',
    example: 'mathematics',
    type: 'string',
  })
  @IsString()
  @IsOptional()
  tag?: string;
}

class EditQuestionBankBody implements Partial<QuestionBankRef> {
  @JSONSchema({
    title: 'Bank ID',
    description: 'Unique identifier of the question bank to edit',
    example: '60d5ec49b3f1c8e4a8f8b8c4',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  bankId: string;

  @JSONSchema({
    title: 'Count',
    // check
    description: 'Updated number of questions in the bank',
    example: 8,
    type: 'number',
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  count: number;

  @JSONSchema({
    title: 'Difficulty Levels',
    description: 'Updated array of difficulty levels to filter questions',
    type: 'array',
    items: {
      type: 'string',
    },
    example: ['medium', 'hard'],
  })
  @IsArray()
  @IsOptional()
  difficulty?: string[];

  @JSONSchema({
    title: 'Tags',
    description: 'Updated array of tags to filter questions',
    type: 'array',
    items: {
      type: 'string',
    },
    example: ['geometry', 'trigonometry'],
  })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @JSONSchema({
    title: 'Tag',
    description: 'Single tag to filter questions',
    example: 'physics',
    type: 'string',
  })
  @IsString()
  @IsOptional()
  tag?: string;
}

class RegradeSubmissionBody implements Partial<IGradingResult> {
  @JSONSchema({
    title: 'Total Score',
    description: 'Updated total score for the submission',
    example: 92.5,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsOptional()
  totalScore?: number;

  @JSONSchema({
    title: 'Total Maximum Score',
    description: 'Updated maximum possible score',
    example: 100,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsOptional()
  totalMaxScore?: number;

  @JSONSchema({
    title: 'Overall Feedback',
    description: 'Updated feedback for each question in the submission',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        questionId: {
          type: 'string',
          format: 'Mongo Object ID',
        },
        status: {
          type: 'string',
          enum: ['CORRECT', 'INCORRECT', 'PARTIAL'],
        },
        score: {
          type: 'number',
        },
        answerFeedback: {
          type: 'string',
        },
      },
      required: ['questionId', 'status', 'score'],
    },
  })
  @IsOptional()
  overallFeedback?: IQuestionAnswerFeedback[];

  @JSONSchema({
    title: 'Grading Status',
    description: 'Updated grading status',
    example: 'PASSED',
    type: 'string',
    enum: ['PENDING', 'PASSED', 'FAILED'],
  })
  @IsEnum(['PENDING', 'PASSED', 'FAILED'])
  @IsNotEmpty()
  gradingStatus: 'PENDING' | 'PASSED' | 'FAILED' | any;

  @JSONSchema({
    title: 'Graded At',
    description: 'Timestamp when the submission was regraded',
    example: '2023-06-09T10:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsDate()
  @IsOptional()
  gradedAt?: Date;

  @JSONSchema({
    title: 'Graded By',
    description: 'Identifier of who performed the regrading',
    example: 'instructor_001',
    type: 'string',
  })
  @IsString()
  @IsOptional()
  gradedBy?: string;
}

class AddFeedbackBody {
  @JSONSchema({
    title: 'Feedback',
    description: 'Feedback text to add to the question answer',
    example:
      'Good explanation, but consider including more details about the methodology.',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  feedback: string;
}

class UserQuizMetricsResponse {
  @JSONSchema({
    title: 'User Quiz Metrics ID',
    description: 'Unique identifier for the user quiz metrics record',
    example: '60d5ec49b3f1c8e4a8f8b8c7',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  _id?: string | ObjectId;

  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  quizId: string | ObjectId;

  @JSONSchema({
    title: 'User ID',
    description: 'Unique identifier of the user',
    example: '60d5ec49b3f1c8e4a8f8b8c6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  userId: string | ObjectId;

  @JSONSchema({
    title: 'Latest Attempt Status',
    description: 'Status of the most recent quiz attempt',
    example: 'SUBMITTED',
    type: 'string',
    enum: ['ATTEMPTED', 'SUBMITTED'],
  })
  @IsString()
  @IsNotEmpty()
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED';

  @JSONSchema({
    title: 'Latest Attempt ID',
    description: 'Unique identifier of the most recent attempt',
    example: '60d5ec49b3f1c8e4a8f8b8c8',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  latestAttemptId?: string | ObjectId;

  @JSONSchema({
    title: 'Latest Submission Result ID',
    description: 'Unique identifier of the most recent submission result',
    example: '60d5ec49b3f1c8e4a8f8b8c9',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  latestSubmissionResultId?: string | ObjectId;

  @JSONSchema({
    title: 'Remaining Attempts',
    description: 'Number of quiz attempts remaining for the user',
    example: 2,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsNotEmpty()
  remainingAttempts: number;

  @JSONSchema({
    title: 'Attempts',
    description: 'Array of attempt details for this user and quiz',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        attemptId: {
          type: 'string',
          format: 'Mongo Object ID',
        },
        submissionResultId: {
          type: 'string',
          format: 'Mongo Object ID',
        },
      },
      required: ['attemptId'],
    },
  })
  @IsNotEmpty()
  attempts: IAttemptDetails[];
}

class QuizAttemptResponse {
  @JSONSchema({
    title: 'Attempt ID',
    description: 'Unique identifier of the quiz attempt',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  _id?: string | ObjectId;

  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz being attempted',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  quizId: string | ObjectId;

  @JSONSchema({
    title: 'User ID',
    description: 'Unique identifier of the user taking the quiz',
    example: '60d5ec49b3f1c8e4a8f8b8c6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  userId: string | ObjectId;

  @JSONSchema({
    title: 'Question Details',
    description: 'Array of question details for this attempt',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        questionId: {
          type: 'string',
          format: 'Mongo Object ID',
        },
        parameterMap: {
          type: 'object',
          description: 'Optional parameter map for the question',
        },
      },
      required: ['questionId'],
    },
  })
  @IsNotEmpty()
  questionDetails: IQuestionDetails[];

  @JSONSchema({
    title: 'Answers',
    description: 'Array of answers provided by the user',
    type: 'array',
    items: {
      $ref: '#/components/schemas/QuestionAnswer',
    },
  })
  @IsOptional()
  answers?: IQuestionAnswer[];

  @JSONSchema({
    title: 'Created At',
    description: 'Timestamp when the attempt was created',
    example: '2023-06-09T09:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;

  @JSONSchema({
    title: 'Updated At',
    description: 'Timestamp when the attempt was last updated',
    example: '2023-06-09T09:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;
}

class QuizSubmissionResponse {
  @JSONSchema({
    title: 'Submission ID',
    description: 'Unique identifier of the quiz submission',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  _id?: string | ObjectId;

  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz that was submitted',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  quizId: string | ObjectId;

  @JSONSchema({
    title: 'User ID',
    description: 'Unique identifier of the user who submitted the quiz',
    example: '60d5ec49b3f1c8e4a8f8b8c6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  userId: string | ObjectId;

  @JSONSchema({
    title: 'Attempt ID',
    description: 'Unique identifier of the attempt that was submitted',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  attemptId: string | ObjectId;

  @JSONSchema({
    title: 'Submitted At',
    description: 'Timestamp when the quiz was submitted',
    example: '2023-06-09T10:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @IsDate()
  @IsNotEmpty()
  submittedAt: Date;

  @JSONSchema({
    title: 'Grading Result',
    description: 'Result of the grading process',
    type: 'object',
    properties: {
      totalScore: {
        type: 'number',
        description: 'Total score achieved',
      },
      totalMaxScore: {
        type: 'number',
        description: 'Maximum possible score',
      },
      gradingStatus: {
        type: 'string',
        enum: ['PENDING', 'PASSED', 'FAILED'],
      },
      gradedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when graded',
      },
      gradedBy: {
        type: 'string',
        description: 'Identifier of who graded',
      },
      overallFeedback: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            questionId: {
              type: 'string',
              format: 'Mongo Object ID',
            },
            status: {
              type: 'string',
              enum: ['CORRECT', 'INCORRECT', 'PARTIAL'],
            },
            score: {
              type: 'number',
            },
            answerFeedback: {
              type: 'string',
            },
          },
          required: ['questionId', 'status', 'score'],
        },
      },
    },
  })
  @IsOptional()
  gradingResult?: IGradingResult;
}

class QuizDetailsResponse {
  @JSONSchema({
    title: 'Quiz ID',
    description: 'Unique identifier of the quiz',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  _id?: string | ObjectId;

  @JSONSchema({
    title: 'Quiz Name',
    description: 'Name of the quiz',
    example: 'Mathematics Final Exam',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @JSONSchema({
    title: 'Quiz Description',
    description: 'Description of the quiz',
    example: 'Comprehensive mathematics exam covering algebra and geometry',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @JSONSchema({
    title: 'Item Type',
    description: 'Type of the item',
    example: 'QUIZ',
    type: 'string',
    enum: ['QUIZ', 'VIDEO', 'BLOG'],
  })
  @IsEnum(ItemType)
  @IsNotEmpty()
  type: ItemType;

  @JSONSchema({
    title: 'Quiz Details',
    description: 'Detailed configuration of the quiz',
    type: 'object',
    properties: {
      questionBankRefs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            bankId: {
              type: 'string',
              format: 'Mongo Object ID',
            },
            count: {
              type: 'number',
              minimum: 1,
            },
            difficulty: {
              type: 'array',
              items: {type: 'string'},
            },
            tags: {
              type: 'array',
              items: {type: 'string'},
            },
            type: {
              type: 'string',
            },
          },
          required: ['bankId', 'count'],
        },
      },
      passThreshold: {
        type: 'number',
        description: 'Minimum score required to pass (0-1)',
        minimum: 0,
        maximum: 1,
      },
      maxAttempts: {
        type: 'number',
        description: 'Maximum number of attempts allowed',
        minimum: 1,
      },
      quizType: {
        type: 'string',
        enum: ['DEADLINE', 'NO_DEADLINE'],
      },
      releaseTime: {
        type: 'string',
        format: 'date-time',
        description: 'Release time for the quiz',
      },
      questionVisibility: {
        type: 'number',
        minimum: 1,
      },
      deadline: {
        type: 'string',
        format: 'date-time',
      },
      approximateTimeToComplete: {
        type: 'string',
        description: 'Estimated time to complete in HH:MM:SS format',
      },
      allowPartialGrading: {
        type: 'boolean',
        description: 'If true, allows partial grading for questions',
      },
      allowHint: {
        type: 'boolean',
        description: 'If true, allows users to use hints for questions',
      },
      showCorrectAnswersAfterSubmission: {
        type: 'boolean',
        description: 'If true, shows correct answers after submission',
      },
      showExplanationAfterSubmission: {
        type: 'boolean',
        description: 'If true, shows explanation after submission',
      },
      showScoreAfterSubmission: {
        type: 'boolean',
        description: 'If true, shows score after submission',
      },
    },
  })
  @IsOptional()
  details?: IQuizDetails;
}

class QuizAnalyticsResponse {
  @JSONSchema({
    title: 'Total Attempts',
    description: 'Total number of quiz attempts made',
    example: 2,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsNotEmpty()
  totalAttempts: number;

  @JSONSchema({
    title: 'Submissions',
    description: 'Total number of quiz submissions',
    example: 2,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsNotEmpty()
  submissions: number;

  @JSONSchema({
    title: 'Pass Rate',
    description: 'Percentage of students who passed the quiz',
    example: 0.78,
    type: 'number',
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  passRate: number;

  @JSONSchema({
    title: 'Average Score',
    description: 'Average score across all submissions',
    example: 82.5,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsNotEmpty()
  averageScore: number;
}

class QuizPerformanceResponse {
  @JSONSchema({
    title: 'Question ID',
    description: 'Unique identifier of the question',
    example: '60d5ec49b3f1c8e4a8f8b8c5',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;

  @JSONSchema({
    title: 'Correct Rate',
    description: 'Percentage of students who answered this question correctly',
    example: 0.85,
    type: 'number',
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  correctRate: number;

  @JSONSchema({
    title: 'Average Score',
    description: 'Average score for this question across all submissions',
    example: 8.5,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsNotEmpty()
  averageScore: number;
}

class QuizResultsResponse {
  @JSONSchema({
    title: 'Student ID',
    description: 'Unique identifier of the student',
    example: '60d5ec49b3f1c8e4a8f8b8c6',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  studentId: string | ObjectId;

  @JSONSchema({
    title: 'Attempt ID',
    description: 'Unique identifier of the quiz attempt',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  attemptId: string | ObjectId;

  @JSONSchema({
    title: 'Score',
    description: 'Score achieved by the student',
    example: 85.5,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @IsNotEmpty()
  score: number;

  @JSONSchema({
    title: 'Status',
    description: 'Pass/fail status of the quiz attempt',
    example: 'PASSED',
    type: 'string',
    enum: ['PENDING', 'PASSED', 'FAILED'],
  })
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
