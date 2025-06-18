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
import {Type} from 'class-transformer';
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
import {ObjectId} from 'mongodb';
import {NATQuestion} from '../transformers/Question.js';
import { JSONSchema } from 'class-validator-jsonschema';

class QuestionParameter implements IQuestionParameter {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString({each: true})
  @IsArray()
  @ArrayMinSize(2)
  possibleValues: string[];

  @IsNotEmpty()
  @IsString()
  @IsEnum(['number', 'string'])
  type: 'number' | 'string';
}

class LotItem implements ILotItem {
  @IsNotEmpty()
  @IsString()
  text: string;

  @IsNotEmpty()
  @IsString()
  explaination: string;
}

class LotOrder implements ILotOrder {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LotItem)
  lotItem: ILotItem;

  @IsNotEmpty()
  @IsNumber()
  order: number;
}

class Question implements Partial<IQuestion> {
  @IsNotEmpty()
  @IsString()
  text: string;

  @IsString()
  @IsNotEmpty()
  type: QuestionType;

  @IsNotEmpty()
  @IsBoolean()
  isParameterized: boolean;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => QuestionParameter)
  parameters?: IQuestionParameter[];

  @IsString()
  hint?: string;

  @IsNotEmpty()
  @IsNumber()
  timeLimitSeconds: number;

  @IsNotEmpty()
  @IsNumber()
  points: number;
}

class SOLSolution implements ISOLSolution {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  incorrectLotItems: ILotItem[];

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LotItem)
  correctLotItem: ILotItem;
}

class SMLSolution implements ISMLSolution {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  incorrectLotItems: ILotItem[];

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  correctLotItems: ILotItem[];
}

class OTLSolution implements IOTLSolution {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({each: true})
  @Type(() => LotOrder)
  ordering: ILotOrder[];
}

class NATSoltion implements INATSolution {
  @IsNotEmpty()
  @IsNumber()
  decimalPrecision: number;

  @IsNotEmpty()
  @IsNumber()
  upperLimit: number;

  @IsNotEmpty()
  @IsNumber()
  lowerLimit: number;

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsString()
  @IsOptional()
  expression?: string;
}

class DESSolution implements IDESSolution {
  @IsNotEmpty()
  @IsString()
  solutionText: string;
}

class QuestionBody {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Question)
  question: IQuestion;
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
  @IsNotEmpty()
  @IsMongoId()
  _id?: string | ObjectId;

  @IsOptional()
  @IsString()
  solutionText?: string;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Max(10)
  @Min(0)
  decimalPrecision?: number;

  @IsOptional()
  @IsNumber()
  upperLimit?: number;

  @IsOptional()
  @IsNumber()
  lowerLimit?: number;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  expression?: string;

  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  ordering?: ILotOrder[];

  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  correctLotItems?: ILotItem[];

  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => LotItem)
  incorrectLotItems?: ILotItem[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LotItem)
  correctLotItem?: ILotItem;
}

class QuestionId {
  @IsMongoId()
  @IsNotEmpty()
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
