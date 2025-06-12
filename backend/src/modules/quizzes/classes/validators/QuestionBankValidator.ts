import {IQuestionBank, ID} from '#shared/index.js';
import {
  IsMongoId,
  IsOptional,
  IsString,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {ObjectId} from 'mongodb';

class CreateQuestionBankBody implements Partial<IQuestionBank> {
  @JSONSchema({
    title: 'Course ID',
    description:
      'Optional identifier of the course this question bank belongs to',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  courseId?: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'Optional identifier of the specific course version',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  courseVersionId?: string;

  @JSONSchema({
    title: 'Questions',
    description: 'Array of question IDs to include in this question bank',
    type: 'array',
    items: {
      type: 'string',
      format: 'Mongo Object ID',
    },
    example: ['60d5ec49b3f1c8e4a8f8b8c3', '60d5ec49b3f1c8e4a8f8b8c4'],
  })
  @IsString({each: true})
  @IsMongoId({each: true})
  @IsArray()
  @IsOptional()
  questions?: ID[];

  @JSONSchema({
    title: 'Tags',
    description: 'Array of tags to categorize this question bank',
    type: 'array',
    items: {
      type: 'string',
    },
    example: ['mathematics', 'algebra', 'beginner'],
  })
  @IsArray()
  @IsOptional()
  @IsString({each: true})
  tags?: string[];

  @JSONSchema({
    title: 'Title',
    description: 'Title of the question bank',
    example: 'Advanced Mathematics Quiz Bank',
    type: 'string',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @JSONSchema({
    title: 'Description',
    description: 'Detailed description of the question bank',
    example:
      'A comprehensive collection of questions covering advanced mathematical concepts including calculus and linear algebra.',
    type: 'string',
    minLength: 1,
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  description: string;
}

// Request Schemas
class GetQuestionBankByIdParams {
  @JSONSchema({
    title: 'Question Bank ID',
    description: 'Unique identifier of the question bank to retrieve',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  questionBankId: string;
}

class QuestionBankAndQuestionParams {
  @JSONSchema({
    title: 'Question Bank ID',
    description: 'Unique identifier of the question bank',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  questionBankId: string;

  @JSONSchema({
    title: 'Question ID',
    description: 'Unique identifier of the question to add/remove/replace',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;
}
// Response Schemas
class CreateQuestionBankResponse {
  @JSONSchema({
    title: 'Question Bank ID',
    description: 'Unique identifier of the newly created question bank',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  questionBankId: string;
}

class QuestionBankResponse implements Partial<IQuestionBank> {
  @JSONSchema({
    title: 'Question Bank ID',
    description: 'Unique identifier of the question bank',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  _id?: string | ObjectId;

  @JSONSchema({
    title: 'Course ID',
    description: 'Identifier of the course this question bank belongs to',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  courseId?: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'Identifier of the specific course version',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsOptional()
  courseVersionId?: string;

  @JSONSchema({
    title: 'Questions',
    description: 'Array of question IDs included in this question bank',
    type: 'array',
    items: {
      type: 'string',
      format: 'Mongo Object ID',
    },
    example: ['60d5ec49b3f1c8e4a8f8b8c4', '60d5ec49b3f1c8e4a8f8b8c5'],
  })
  @IsArray()
  @IsOptional()
  questions?: ID[];

  @JSONSchema({
    title: 'Tags',
    description: 'Array of tags categorizing this question bank',
    type: 'array',
    items: {
      type: 'string',
    },
    example: ['mathematics', 'algebra', 'beginner'],
  })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @JSONSchema({
    title: 'Title',
    description: 'Title of the question bank',
    example: 'Advanced Mathematics Quiz Bank',
    type: 'string',
  })
  @IsString()
  title: string;

  @JSONSchema({
    title: 'Description',
    description: 'Detailed description of the question bank',
    example:
      'A comprehensive collection of questions covering advanced mathematical concepts.',
    type: 'string',
  })
  @IsString()
  description: string;
}

class ReplaceQuestionResponse {
  @JSONSchema({
    title: 'New Question ID',
    description: 'Unique identifier of the newly created duplicate question',
    example: '60d5ec49b3f1c8e4a8f8b8c6',
    type: 'string',
    format: 'Mongo Object ID',
  })
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
