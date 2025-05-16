import {Type} from 'class-transformer';
import {
  IsBoolean,
  IsBooleanString,
  IsEmpty,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  IQuestion,
  IQuestionParameter,
  ISOLQuestionSolution,
  ISMLQuesionSolution,
  IMTLQuestionSolution,
  IOTLQuestionSolution,
  INATQuestionSolution,
  IDESQuestionSolution,
  IQuestionOptionsLot,
  IQuesionOptionsLotItem,
  IMTLQuestionMatching,
  IOTLQuestionOrdering,
} from 'shared/interfaces/Models';

interface Question {
  questionText: string;
  questionType: 'SOL' | 'SML' | 'MTL' | 'OTL' | 'NAT' | 'DES';
  isParameterized: boolean;
  parameters?: IQuestionParameter[];
  hintText?: string;
  timeLimit: number;
  points: number;
}

interface NATSolution {
  decimalPrecision: number;
  upperLimit: number;
  lowerLimit: number;
  value?: number;
  expression?: string;
}

interface OptionLotItem {
  itemText: string;
  explaination: string;
}

interface OptionOrder {
  lotItem: OptionLotItem;
  order: number;
}

interface OptionMatch {
  match: OptionLotItem[];
}

interface OTLSolution {
  ordering: OptionOrder[];
}

interface SOLSolution {
  incorrectLotItems: OptionLotItem[];
  correctLotItem: OptionLotItem;
}

interface SMLSolution {
  incorrectLotItems: OptionLotItem[];
  correctLotItems: OptionLotItem[];
}

interface MTLSolution {
  matches: OptionMatch[];
}

const question: Question = {
  questionText: 'This is question',
  isParameterized: true,
  parameters: [
    {
      name: 'a',
      possibleValues: ['20', '10'],
    },
    {
      name: 'b',
      possibleValues: ['10', '12'],
    },
  ],
  points: 10,
  questionType: 'SOL',
  timeLimit: 60,
  hintText: 'This is easy',
};

const solSolution: SOLSolution = {
  incorrectLotItems: [
    {
      itemText: 'This is option 1',
      explaination: '',
    },
    {
      itemText: 'This is option 2',
      explaination: 'sdad',
    },
  ],
  correctLotItem: {
    itemText: '',
    explaination: '',
  },
};

const smlSolution: SMLSolution = {
  incorrectLotItems: [
    {
      itemText: 'This is option 1',
      explaination: '',
    },
    {
      itemText: 'This is option 2',
      explaination: 'sdad',
    },
  ],
  correctLotItems: [
    {
      itemText: 'This is option 3',
      explaination: '',
    },
    {
      itemText: 'This is option 4',
      explaination: 'sdad',
    },
  ],
};

const otlSolution: OTLSolution = {
  ordering: [
    {
      lotItem: {
        itemText: 'item 1',
        explaination: 'dahjkda',
      },
      order: 1,
    },
    {
      lotItem: {
        itemText: 'item 1',
        explaination: 'dahjkda',
      },
      order: 2,
    },
  ],
};

const mtlSolution: MTLSolution = {
  matches: [
    {
      match: [
        {
          itemText: 'This is option 3',
          explaination: '',
        },
        {
          itemText: 'This is option 4',
          explaination: 'sdad',
        },
      ],
    },
    {
      match: [
        {
          itemText: 'This is option 3',
          explaination: '',
        },
        {
          itemText: 'This is option 4',
          explaination: 'sdad',
        },
      ],
    },
    {
      match: [
        {
          itemText: 'This is option 3',
          explaination: '',
        },
        {
          itemText: 'This is option 4',
          explaination: 'sdad',
        },
      ],
    },
  ],
};

const natSolution: NATSolution = {
  decimalPrecision: 1,
  upperLimit: 1.045,
  lowerLimit: 2.0,
  expression: '',
};
