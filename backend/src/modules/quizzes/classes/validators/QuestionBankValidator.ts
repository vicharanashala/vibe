import {ID} from '#root/shared/interfaces/models.js';
import {IQuestionBank} from '#root/shared/interfaces/quiz.js';
import {
  IsMongoId,
  IsOptional,
  IsString,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import {ObjectId} from 'mongodb';

class CreateQuestionBankBody implements Partial<IQuestionBank> {
  @IsMongoId()
  @IsOptional()
  courseId?: string;

  @IsMongoId()
  @IsOptional()
  courseVersionId?: string;

  @IsString({each: true})
  @IsMongoId({each: true})
  @IsArray()
  @IsOptional()
  questions?: ID[];

  @IsArray()
  @IsOptional()
  @IsString({each: true})
  tags?: string[];

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  description: string;
}

// Request Schemas
class GetQuestionBankByIdParams {
  @IsMongoId()
  @IsNotEmpty()
  questionBankId: string;
}
class QuestionBankAndQuestionParams {
  @IsMongoId()
  @IsNotEmpty()
  questionBankId: string;

  @IsMongoId()
  @IsNotEmpty()
  questionId: string;
}
// Response Schemas
class CreateQuestionBankResponse {
  @IsMongoId()
  questionBankId: string;
}

class QuestionBankResponse implements Partial<IQuestionBank> {
  @IsMongoId()
  _id?: string | ObjectId;

  @IsMongoId()
  @IsOptional()
  courseId?: string;

  @IsMongoId()
  @IsOptional()
  courseVersionId?: string;

  @IsArray()
  @IsOptional()
  questions?: ID[];

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  title: string;

  @IsString()
  description: string;
}

class ReplaceQuestionResponse {
  @IsMongoId()
  @IsNotEmpty()
  newQuestionId: string;
}

class QuestionBankNotFoundErrorResponse {
  @JSONSchema({
      description: 'The error message.',
      example:
        'Question bank not found.',
      type: 'string',
      readOnly: true,
    })
  @IsNotEmpty()
  message: string;
}

export {
  CreateQuestionBankBody,
  GetQuestionBankByIdParams,
  CreateQuestionBankResponse,
  QuestionBankAndQuestionParams,
  QuestionBankResponse,
  ReplaceQuestionResponse,
  QuestionBankNotFoundErrorResponse,
};
