import {
  IQuestionParameter,
  ILotItem,
  ILotOrder,
  IQuestion,
  QuestionType,
  ISOLSolution,
  ISMLSolution,
  IOTLSolution,
  INATSolution,
  IDESSolution,
} from '#shared/interfaces/quiz.js';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ArrayMinSize,
  IsEnum,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsMongoId,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { ObjectId } from 'mongodb';
import { NATQuestion } from '../transformers/Question.js';
import { JSONSchema } from 'class-validator-jsonschema';

class QuestionParameter implements IQuestionParameter {
  @IsNotEmpty()
  @IsString()
  @JSONSchema({
    description: 'Name of the parameter',
    type: 'string',
    example: 'Param1',
  })
  name: string;

  @IsNotEmpty()
  @IsString({ each: true })
  @IsArray()
  @ArrayMinSize(2)
  @JSONSchema({
    description: 'Possible values for the parameter',
    type: 'array',
    items: { type: 'string', example: 'easy' },
    example: ['easy', 'medium', 'hard'],
    minItems: 2,
  })
  possibleValues: string[];

  @IsNotEmpty()
  @IsString()
  @IsEnum(['number', 'string'])
  @JSONSchema({
    description: 'Type of the parameter',
    type: 'string',
    enum: ['number', 'string'],
    example: 'number',
  })
  type: 'number' | 'string';
}

class LotItem implements ILotItem {
  @IsNotEmpty()
  @IsString()
  @JSONSchema({
    description: 'Text of the lot item',
    type: 'string',
    example: 'Option A',
  })
  text: string;

  @IsNotEmpty()
  @IsString()
  @JSONSchema({
    description: 'Explanation for the lot item',
    type: 'string',
    example: 'This is the correct answer because...',
  })
  explaination: string;
}

class LotOrder implements ILotOrder {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LotItem)
  @JSONSchema({
    description: 'Lot item to be ordered',
  })
  lotItem: ILotItem;

  @IsNotEmpty()
  @IsNumber()
  @JSONSchema({
    description: 'Order of the lot item',
    type: 'number',
    example: 1,
  })
  order: number;
}

class Question implements Partial<IQuestion> {
  @IsNotEmpty()
  @IsString()
  @JSONSchema({
    description: 'Text of the question',
    type: 'string',
    example: 'What is 2 + 2?',
  })
  text: string;

  @IsString()
  @IsNotEmpty()
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
  type: QuestionType;

  @IsNotEmpty()
  @IsBoolean()
  @JSONSchema({
    description: 'Whether the question is parameterized',
    type: 'boolean',
    example: false,
  })
  isParameterized: boolean;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuestionParameter)
  @JSONSchema({
    description: 'Parameters for the question',
    type: 'array',
    example: [
      { name: 'Param1', possibleValues: ['cat', 'dog'], type: 'string' },
    ],
  })
  parameters?: IQuestionParameter[];

  @IsString()
  @JSONSchema({
    description: 'Hint for the question',
    type: 'string',
    example: 'Think about basic addition.',
  })
  hint?: string;

  @IsNotEmpty()
  @IsNumber()
  @JSONSchema({
    description: 'Time limit for the question in seconds',
    type: 'number',
    example: 60,
  })
  timeLimitSeconds: number;

  @IsNotEmpty()
  @IsNumber()
  @JSONSchema({
    description: 'Points for the question',
    type: 'number',
    example: 5,
  })
  points: number;
}

class SOLSolution implements ISOLSolution {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LotItem)
  @JSONSchema({
    description: 'Incorrect lot items',
    type: 'array',
    items: { $ref: '#/components/schemas/LotItem' },
    example: [
      { text: 'Option B', explaination: 'Incorrect because...' },
      { text: 'Option C', explaination: 'Incorrect because...' },
    ],
  })
  incorrectLotItems: ILotItem[];

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LotItem)
  @JSONSchema({
    description: 'Correct lot item',
    items: { $ref: '#/components/schemas/LotItem' },
    example: { text: 'Option A', explaination: 'Correct because...' },
  })
  correctLotItem: ILotItem;
}

class SMLSolution implements ISMLSolution {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LotItem)
  @JSONSchema({
    description: 'Incorrect lot items',
    type: 'array',
    items: { $ref: '#/components/schemas/LotItem' },
    example: [
      { text: 'Option B', explaination: 'Incorrect because...' },
      { text: 'Option C', explaination: 'Incorrect because...' },
    ],
  })
  incorrectLotItems: ILotItem[];

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LotItem)
  @JSONSchema({
    description: 'Correct lot items',
    type: 'array',
    example: [
      { text: 'Option A', explaination: 'Correct because...' },
      { text: 'Option D', explaination: 'Correct because...' },
    ],
  })
  correctLotItems: ILotItem[];
}

class OTLSolution implements IOTLSolution {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LotOrder)
  @JSONSchema({
    description: 'Ordering of lot items',
    type: 'array',
    example: [
      { lotItem: { text: 'Step 1', explaination: '...' }, order: 1 },
      { lotItem: { text: 'Step 2', explaination: '...' }, order: 2 },
    ],
  })
  ordering: ILotOrder[];
}

class NATSoltion implements INATSolution {
  @IsNotEmpty()
  @IsNumber()
  @JSONSchema({
    description: 'Decimal precision for the answer',
    type: 'number',
    example: 2,
  })
  decimalPrecision: number;

  @IsNotEmpty()
  @IsNumber()
  @JSONSchema({
    description: 'Upper limit for the answer',
    type: 'number',
    example: 100,
  })
  upperLimit: number;

  @IsNotEmpty()
  @IsNumber()
  @JSONSchema({
    description: 'Lower limit for the answer',
    type: 'number',
    example: 0,
  })
  lowerLimit: number;

  @IsNumber()
  @IsOptional()
  @JSONSchema({
    description: 'Value of the answer (optional)',
    type: 'number',
    example: 42,
  })
  value?: number;

  @IsString()
  @IsOptional()
  @JSONSchema({
    description: 'Expression for the answer (optional)',
    type: 'string',
    example: '21 * 2',
  })
  expression?: string;
}

class DESSolution implements IDESSolution {
  @IsNotEmpty()
  @IsString()
  @JSONSchema({
    description: 'Descriptive solution text',
    type: 'string',
    example: 'The answer is found by adding 2 and 2.',
  })
  solutionText: string;
}

class QuestionBody {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Question)
  @JSONSchema({
    description: 'Question object',
    items: { $ref: '#/components/schemas/Question' },
  })
  question: IQuestion;

  @IsNotEmpty()
  @ValidateNested()
  @Type((type) => {

    if (!type) {
      // Fallback to a base type or throw during runtime use only
      return Object;
    }

    const question = type.object.question as Question;
    switch (question.type) {
      case 'SELECT_ONE_IN_LOT':
        return SOLSolution;
      case 'SELECT_MANY_IN_LOT':
        return SMLSolution;
      case 'ORDER_THE_LOTS':
        return OTLSolution;
      case 'NUMERIC_ANSWER_TYPE':
        return NATSoltion;
      case 'DESCRIPTIVE':
        return DESSolution;
      default:
        throw new Error('Invalid question type');
    }
  })
  @JSONSchema({
    description: 'Solution object for the question',
    oneOf: [
      { 
        $ref: '#/components/schemas/SOLSolution',
        title: 'Select One from Lot Solution',
        description: 'Solution for questions where one item is selected from a lot.',
      },
      { 
        $ref: '#/components/schemas/SMLSolution',
        title: 'Select Many from Lot Solution',
        description: 'Solution for questions where multiple items are selected from a lot.',},
      { 
        $ref: '#/components/schemas/OTLSolution',
        title: 'Order the Lots Solution',
        description: 'Solution for questions where items need to be ordered.',
      },
      { 
        $ref: '#/components/schemas/NATSoltion',
        title: 'Numeric Answer Type Solution',
        description: 'Solution for numeric answer type questions.',
      },
      { 
        $ref: '#/components/schemas/DESSolution',
        title: 'Descriptive Solution',
        description: 'Solution for descriptive questions with a text answer.',
      },
    ],
  })
  solution:
    | ISOLSolution
    | ISMLSolution
    | IOTLSolution
    | INATSolution
    | IDESSolution;
}

class QuestionResponse
  extends Question
  implements
  Partial<ISOLSolution>,
  Partial<ISMLSolution>,
  Partial<IOTLSolution>,
  Partial<NATQuestion>,
  Partial<DESSolution> {
  @IsNotEmpty()
  @IsMongoId()
  @JSONSchema({
    description: 'ID of the question',
    type: 'string',
    example: '60d21b4667d0d8992e610c87',
  })
  _id?: string | ObjectId;

  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Descriptive solution text',
    type: 'string',
    example: 'The answer is found by adding 2 and 2.',
  })
  solutionText?: string;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Max(10)
  @Min(0)
  @JSONSchema({
    description: 'Decimal precision for the answer',
    type: 'number',
    example: 2,
    minimum: 0,
    maximum: 10,
  })
  decimalPrecision?: number;

  @IsOptional()
  @IsNumber()
  @JSONSchema({
    description: 'Upper limit for the answer',
    type: 'number',
    example: 100,
  })
  upperLimit?: number;

  @IsOptional()
  @IsNumber()
  @JSONSchema({
    description: 'Lower limit for the answer',
    type: 'number',
    example: 0,
  })
  lowerLimit?: number;

  @IsOptional()
  @IsNumber()
  @JSONSchema({
    description: 'Value of the answer (optional)',
    type: 'number',
    example: 42,
  })
  value?: number;

  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Expression for the answer (optional)',
    type: 'string',
    example: '21 * 2',
  })
  expression?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LotItem)
  @JSONSchema({
    description: 'Ordering of lot items',
    type: 'array',
    items: { $ref: '#/components/schemas/LotOrder' },
    example: [
      { lotItem: { text: 'Step 1', explaination: '...' }, order: 1 },
      { lotItem: { text: 'Step 2', explaination: '...' }, order: 2 },
    ],
  })
  ordering?: ILotOrder[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LotItem)
  @JSONSchema({
    description: 'Correct lot items',
    type: 'array',
    items: { $ref: '#/components/schemas/LotItem' },
    example: [
      { text: 'Option A', explaination: 'Correct because...' },
      { text: 'Option D', explaination: 'Correct because...' },
    ],
  })
  correctLotItems?: ILotItem[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LotItem)
  @JSONSchema({
    description: 'Incorrect lot items',
    type: 'array',
    items: { $ref: '#/components/schemas/LotItem' },
    example: [
      { text: 'Option B', explaination: 'Incorrect because...' },
      { text: 'Option C', explaination: 'Incorrect because...' },
    ],
  })
  incorrectLotItems?: ILotItem[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LotItem)
  @JSONSchema({
    description: 'Correct lot item',
    $ref: '#/components/schemas/LotItem',
    example: { text: 'Option A', explaination: 'Correct because...' },
  })
  correctLotItem?: ILotItem;
}

class QuestionId {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({
    description: 'ID of the question',
    type: 'string',
    example: '60d21b4667d0d8992e610c87',
  })
  questionId: string;
}

class QuestionNotFoundErrorResponse {
  @JSONSchema({
    description: 'The error message.',
    example:
      'Question not found.',
    type: 'string',
    readOnly: true,
  })
  @IsNotEmpty()
  message: string;
}

export {
  QuestionBody,
  QuestionId,
  QuestionResponse,
  Question,
  SOLSolution,
  SMLSolution,
  OTLSolution,
  NATSoltion,
  DESSolution,
  QuestionParameter,
  LotItem,
  LotOrder,
  QuestionNotFoundErrorResponse,
};

export const QUESTION_VALIDATORS = [
  QuestionBody,
  QuestionId,
  QuestionResponse,
  Question,
  SOLSolution,
  SMLSolution,
  OTLSolution,
  NATSoltion,
  DESSolution,
  QuestionParameter,
  LotItem,
  LotOrder,
  QuestionNotFoundErrorResponse,
]