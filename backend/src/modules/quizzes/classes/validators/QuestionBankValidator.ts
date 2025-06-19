import {ID, IQuestionBankRef} from '#root/shared/interfaces/models.js';
import {IQuestionBank} from '#root/shared/interfaces/quiz.js';
import {
  IsMongoId,
  IsOptional,
  IsString,
  IsArray,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import {ObjectId} from 'mongodb';

class CreateQuestionBankBody implements Partial<IQuestionBank> {
  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the course',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  courseId?: string;

  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the course version',
    type: 'string',
    example: '60d21b4667d0d8992e610c86',
  })
  courseVersionId?: string;

  @IsString({each: true})
  @IsMongoId({each: true})
  @IsArray()
  @IsOptional()
  @JSONSchema({
    description: 'Array of question IDs',
    type: 'array',
    items: { type: 'string', example: '60d21b4667d0d8992e610c87' },
    example: ['60d21b4667d0d8992e610c87'],
  })
  questions?: ID[];

  @IsArray()
  @IsOptional()
  @IsString({each: true})
  @JSONSchema({
    description: 'Tags for the question bank',
    type: 'array',
    items: { type: 'string', example: 'math' },
    example: ['math', 'science'],
  })
  tags?: string[];

  @IsString()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Title of the question bank',
    type: 'string',
    example: 'Algebra Basics',
  })
  title: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @JSONSchema({
    description: 'Description of the question bank',
    type: 'string',
    example: 'A collection of algebra questions.',
  })
  description: string;
}

// Request Schemas
class GetQuestionBankByIdParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question bank',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  questionBankId: string;
}
class QuestionBankAndQuestionParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question bank',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  questionBankId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question',
    type: 'string',
    example: '60d21b4667d0d8992e610c87',
  })
  questionId: string;
}
// Response Schemas
class CreateQuestionBankResponse {
  @IsMongoId()
  @JSONSchema({
    description: 'ID of the created question bank',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  questionBankId: string;
}

class QuestionBankResponse implements Partial<IQuestionBank> {
  @IsMongoId()
  @JSONSchema({
    description: 'ID of the question bank',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  _id?: string | ObjectId;

  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the course',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  courseId?: string;

  @IsMongoId()
  @IsOptional()
  @JSONSchema({
    description: 'ID of the course version',
    type: 'string',
    example: '60d21b4667d0d8992e610c86',
  })
  courseVersionId?: string;

  @IsArray()
  @IsOptional()
  @JSONSchema({
    description: 'Array of question IDs',
    type: 'array',
    items: { type: 'string', example: '60d21b4667d0d8992e610c87' },
    example: ['60d21b4667d0d8992e610c87'],
  })
  questions?: ID[];

  @IsArray()
  @IsOptional()
  @JSONSchema({
    description: 'Tags for the question bank',
    type: 'array',
    items: { type: 'string', example: 'math' },
    example: ['math', 'science'],
  })
  tags?: string[];

  @IsString()
  @JSONSchema({
    description: 'Title of the question bank',
    type: 'string',
    example: 'Algebra Basics',
  })
  title: string;

  @IsString()
  @JSONSchema({
    description: 'Description of the question bank',
    type: 'string',
    example: 'A collection of algebra questions.',
  })
  description: string;
}

class ReplaceQuestionResponse {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the new question',
    type: 'string',
    example: '60d21b4667d0d8992e610c88',
  })
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

class QuestionBankRef implements IQuestionBankRef {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question bank',
    type: 'string',
    example: '60d21b4667d0d8992e610c85',
  })
  bankId: string; // ObjectId as string

  @IsNotEmpty()
  @IsNumber()
  @JSONSchema({
    description: 'How many questions to pick',
    type: 'integer',
    example: 10,
  })
  count: number; // How many questions to pick

  @IsOptional()
  @IsArray()
  @IsString({each: true})
  @JSONSchema({
    description: 'Optional filter for question difficulty',
    type: 'array',
    items: { type: 'string', example: 'easy' },
    example: ['easy', 'medium'],
  })
  difficulty?: string[]; // Optional filter

  @IsOptional()
  @IsArray()
  @IsString({each: true})
  @JSONSchema({
    description: 'Optional filter for question tags',
    type: 'array',
    items: { type: 'string', example: 'math' },
    example: ['math', 'science'],
  })
  tags?: string[]; // Optional filter

  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Optional question type filter',
    type: 'string',
    example: 'multiple-choice',
  })
  type?: string; // Optional question type filter
}

export {
  CreateQuestionBankBody,
  GetQuestionBankByIdParams,
  CreateQuestionBankResponse,
  QuestionBankAndQuestionParams,
  QuestionBankResponse,
  ReplaceQuestionResponse,
  QuestionBankNotFoundErrorResponse,
  QuestionBankRef,
};
