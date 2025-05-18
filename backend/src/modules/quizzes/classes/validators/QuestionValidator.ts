import {Type} from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsBooleanString,
  IsEmpty,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
} from 'class-validator';
import {ObjectId} from 'mongodb';
import {
  IDESSolution,
  ILotItem,
  ILotOrder,
  INATSolution,
  IOTLSolution,
  IQuestion,
  IQuestionParameter,
  ISMLSolution,
  ISOLSolution,
  QuestionType,
} from 'shared/interfaces/quiz';
import {NATQuestion} from '../transformers/Question';

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

class Question implements IQuestion {
  @IsEmpty()
  _id?: string | ObjectId;

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

class CreateQuestionBody {
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

export {
  CreateQuestionBody,
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
