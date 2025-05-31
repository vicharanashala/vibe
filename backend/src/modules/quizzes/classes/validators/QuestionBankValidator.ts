import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {ObjectId} from 'mongodb';
import {IQuestionBank, ID} from 'shared/interfaces/quiz';

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
  @IsOptional()
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

export {
  CreateQuestionBankBody,
  GetQuestionBankByIdParams,
  CreateQuestionBankResponse,
  QuestionBankAndQuestionParams,
  QuestionBankResponse,
  ReplaceQuestionResponse,
};
