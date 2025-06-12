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
import {Type} from 'class-transformer';
import {JSONSchema} from 'class-validator-jsonschema';
import {ObjectId} from 'mongodb';
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
} from '#shared/index.js';
import {NATQuestion} from '../transformers/Question.js';

class QuestionParameter implements IQuestionParameter {
  @JSONSchema({
    title: 'Parameter Name',
    description: 'Name of the question parameter used in expression',
    example: 'x',
    type: 'string',
    minLength: 1,
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @JSONSchema({
    title: 'Possible Values',
    description: 'Array of possible values for this parameter',
    type: 'array',
    items: {
      type: 'string',
    },
    example: ['2', '3', '4'],
    minItems: 2,
  })
  @IsNotEmpty()
  @IsString({each: true})
  @IsArray()
  @ArrayMinSize(2)
  possibleValues: string[];

  @JSONSchema({
    title: 'Parameter Type',
    description: 'Data type of the parameter values',
    enum: ['number', 'string'],
    example: 'number',
  })
  @IsNotEmpty()
  @IsString()
  @IsEnum(['number', 'string'])
  type: 'number' | 'string';
}

class LotItem implements ILotItem {
  @JSONSchema({
    title: 'Item Text',
    description: 'The text content of the lot item',
    example: 'Apple',
    type: 'string',
    minLength: 1,
    maxLength: 500,
  })
  @IsNotEmpty()
  @IsString()
  text: string;

  @JSONSchema({
    title: 'Explanation',
    description: 'Explanation for why this item is correct or incorrect',
    example: 'Apple is a fruit, not a vegetable',
    type: 'string',
    minLength: 1,
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsString()
  explaination: string;
}

class LotOrder implements ILotOrder {
  @JSONSchema({
    title: 'Lot Item',
    description: 'The lot item to be ordered',
    type: 'object',
    $ref: '#/components/schemas/LotItem',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LotItem)
  lotItem: ILotItem;

  @JSONSchema({
    title: 'Order Position',
    description: 'The position of this item in the correct order',
    example: 1,
    type: 'number',
    minimum: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  order: number;
}

class Question implements Partial<IQuestion> {
  @JSONSchema({
    title: 'Question Text',
    description: 'The main text of the question, may contain parameter tags',
    example: 'What is sum of 23 and 46?',
    type: 'string',
    minLength: 1,
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  text: string;

  @JSONSchema({
    title: 'Question Type',
    description: 'The type of question being created',
    enum: [
      'SELECT_ONE_IN_LOT',
      'SELECT_MANY_IN_LOT',
      'ORDER_THE_LOTS',
      'NUMERIC_ANSWER_TYPE',
      'DESCRIPTIVE',
    ],
    example: 'SELECT_ONE_IN_LOT',
  })
  @IsString()
  @IsNotEmpty()
  type: QuestionType;

  @JSONSchema({
    title: 'Is Parameterized',
    description: 'Whether this question uses parameters for dynamic content',
    example: true,
    type: 'boolean',
  })
  @IsNotEmpty()
  @IsBoolean()
  isParameterized: boolean;

  @JSONSchema({
    title: 'Parameters',
    description: 'Array of parameters used in the question text',
    type: 'array',
    items: {
      $ref: '#/components/schemas/QuestionParameter',
    },
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => QuestionParameter)
  parameters?: IQuestionParameter[];

  @JSONSchema({
    title: 'Hint',
    description: 'Optional hint to help students answer the question',
    example: 'Remember to add the two numbers together',
    type: 'string',
    maxLength: 1000,
  })
  @IsString()
  hint?: string;

  @JSONSchema({
    title: 'Time Limit (Seconds)',
    description: 'Maximum time allowed to answer this question in seconds',
    example: 60,
    type: 'number',
    minimum: 1,
    maximum: 3600,
  })
  @IsNotEmpty()
  @IsNumber()
  timeLimitSeconds: number;

  @JSONSchema({
    title: 'Points',
    description: 'Number of points this question is worth',
    example: 10,
    type: 'number',
    minimum: 0,
    maximum: 100,
  })
  @IsNotEmpty()
  @IsNumber()
  points: number;
}

class SOLSolution implements ISOLSolution {
  @JSONSchema({
    title: 'Incorrect Lot Items',
    description: 'Array of incorrect options for select one in lot questions',
    type: 'array',
    items: {
      $ref: '#/components/schemas/LotItem',
    },
    minItems: 1,
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  incorrectLotItems: ILotItem[];

  @JSONSchema({
    title: 'Correct Lot Item',
    description: 'The correct option for select one in lot questions',
    type: 'object',
    $ref: '#/components/schemas/LotItem',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LotItem)
  correctLotItem: ILotItem;
}

class SMLSolution implements ISMLSolution {
  @JSONSchema({
    title: 'Incorrect Lot Items',
    description: 'Array of incorrect options for select many in lot questions',
    type: 'array',
    items: {
      $ref: '#/components/schemas/LotItem',
    },
    minItems: 1,
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  incorrectLotItems: ILotItem[];

  @JSONSchema({
    title: 'Correct Lot Items',
    description: 'Array of correct options for select many in lot questions',
    type: 'array',
    items: {
      $ref: '#/components/schemas/LotItem',
    },
    minItems: 1,
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  correctLotItems: ILotItem[];
}

class OTLSolution implements IOTLSolution {
  @JSONSchema({
    title: 'Ordering',
    description: 'Array of lot items with their correct order positions',
    type: 'array',
    items: {
      $ref: '#/components/schemas/LotOrder',
    },
    minItems: 2,
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => LotOrder)
  ordering: ILotOrder[];
}

class NATSoltion implements INATSolution {
  @JSONSchema({
    title: 'Decimal Precision',
    description: 'Number of decimal places to consider for numeric answers',
    example: 2,
    type: 'number',
    minimum: 0,
    maximum: 10,
  })
  @IsNotEmpty()
  @IsNumber()
  decimalPrecision: number;

  @JSONSchema({
    title: 'Upper Limit',
    description: 'Maximum acceptable value for the numeric answer',
    example: 100,
    type: 'number',
  })
  @IsNotEmpty()
  @IsNumber()
  upperLimit: number;

  @JSONSchema({
    title: 'Lower Limit',
    description: 'Minimum acceptable value for the numeric answer',
    example: 0,
    type: 'number',
  })
  @IsNotEmpty()
  @IsNumber()
  lowerLimit: number;

  @JSONSchema({
    title: 'Exact Value',
    description: 'Exact numeric value for the answer (optional)',
    example: 42,
    type: 'number',
  })
  @IsNumber()
  @IsOptional()
  value?: number;

  @JSONSchema({
    title: 'Mathematical Expression',
    description:
      'Mathematical expression that evaluates to the answer (optional)',
    example: '2 * x + 5',
    type: 'string',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  expression?: string;
}

class DESSolution implements IDESSolution {
  @JSONSchema({
    title: 'Solution Text',
    description: 'The model answer text for descriptive questions',
    example: 'This is a sample answer explaining the concept in detail.',
    type: 'string',
    minLength: 1,
    maxLength: 5000,
  })
  @IsNotEmpty()
  @IsString()
  solutionText: string;
}

class QuestionBody {
  @JSONSchema({
    title: 'Question',
    description: 'The question object containing all question details',
    type: 'object',
    $ref: '#/components/schemas/Question',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Question)
  question: IQuestion;

  @JSONSchema({
    title: 'Solution',
    description: 'The solution object corresponding to the question type',
    oneOf: [
      {$ref: '#/components/schemas/SOLSolution'},
      {$ref: '#/components/schemas/SMLSolution'},
      {$ref: '#/components/schemas/OTLSolution'},
      {$ref: '#/components/schemas/NATSoltion'},
      {$ref: '#/components/schemas/DESSolution'},
    ],
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(({object}) => {
    const question = object.question as Question;
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
    Partial<DESSolution>
{
  @JSONSchema({
    title: 'Question ID',
    description: 'Unique identifier for the question',
    example: '507f1f77bcf86cd799439011',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  _id?: string | ObjectId;

  @JSONSchema({
    title: 'Solution Text',
    description: 'Solution text for descriptive questions',
    example: 'This is the model answer for the descriptive question.',
    type: 'string',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  solutionText?: string;

  @JSONSchema({
    title: 'Decimal Precision',
    description: 'Decimal precision for numeric answers',
    example: 2,
    type: 'integer',
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @IsInt()
  @Max(10)
  @Min(0)
  decimalPrecision?: number;

  @JSONSchema({
    title: 'Upper Limit',
    description: 'Upper limit for numeric answers',
    example: 100,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  upperLimit?: number;

  @JSONSchema({
    title: 'Lower Limit',
    description: 'Lower limit for numeric answers',
    example: 0,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  lowerLimit?: number;

  @JSONSchema({
    title: 'Numeric Value',
    description: 'Exact numeric value for the answer',
    example: 42,
    type: 'number',
  })
  @IsOptional()
  @IsNumber()
  value?: number;

  @JSONSchema({
    title: 'Mathematical Expression',
    description: 'Mathematical expression for the answer',
    example: '2 * x + 5',
    type: 'string',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  expression?: string;

  @JSONSchema({
    title: 'Ordering',
    description: 'Ordering information for order-the-lots questions',
    type: 'array',
    items: {
      $ref: '#/components/schemas/LotOrder',
    },
  })
  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  ordering?: ILotOrder[];

  @JSONSchema({
    title: 'Correct Lot Items',
    description: 'Array of correct lot items for multi-select questions',
    type: 'array',
    items: {
      $ref: '#/components/schemas/LotItem',
    },
  })
  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  correctLotItems?: ILotItem[];

  @JSONSchema({
    title: 'Incorrect Lot Items',
    description: 'Array of incorrect lot items for selection questions',
    type: 'array',
    items: {
      $ref: '#/components/schemas/LotItem',
    },
  })
  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  incorrectLotItems?: ILotItem[];

  @JSONSchema({
    title: 'Correct Lot Item',
    description: 'The single correct lot item for single-select questions',
    type: 'object',
    $ref: '#/components/schemas/LotItem',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LotItem)
  correctLotItem?: ILotItem;
}

class QuestionId {
  @JSONSchema({
    title: 'Question ID',
    description: 'Unique MongoDB ObjectId identifier for the question',
    example: '507f1f77bcf86cd799439011',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;
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
};
