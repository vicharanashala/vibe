import {Type} from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
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
  IGradingResult,
  IQuestionAnswer,
  IQuestionAnswerFeedback,
  IQuestionDetails,
} from 'modules/quizzes/interfaces/grading';
import {IQuestionRenderView} from 'modules/quizzes/question-processing/renderers';
import {ObjectId} from 'mongodb';
import {IQuestion, QuestionType} from 'shared/interfaces/quiz';

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
  @IsInt()
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

export {
  CreateAttemptParams,
  SaveAttemptParams,
  SubmitAttemptParams,
  CreateAttemptResponse,
  SubmitAttemptResponse,
  QuestionAnswersBody,
};
