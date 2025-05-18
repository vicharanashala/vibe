import {ObjectId} from 'mongodb';
import {
  ISOLSolution,
  ISMLSolution,
  IOTLSolution,
  INATSolution,
  IDESSolution,
  ILotItem,
  ISOLQuizView,
  ISMLQuizView,
  ILotOrder,
  IOTLQuizView,
  INATQuizView,
  IDESQuizView,
  IQuestionParameter,
  IQuestion,
  QuestionType,
} from 'shared/interfaces/quiz';
import {CreateQuestionBody} from '../validators/QuestionValidator';

abstract class BaseQuestion implements IQuestion {
  _id?: string | ObjectId;
  text: string;
  type: QuestionType;
  isParameterized: boolean;
  parameters?: IQuestionParameter[];
  hint?: string;
  timeLimitSeconds: number;
  points: number;

  constructor(question: IQuestion) {
    this._id = question._id;
    this.text = question.text;
    this.type = question.type;
    this.isParameterized = question.isParameterized;
    this.parameters = question.parameters;
    this.hint = question.hint;
    this.timeLimitSeconds = question.timeLimitSeconds;
    this.points = question.points;
  }
}

class SOLQuestion extends BaseQuestion implements ISOLSolution {
  incorrectLotItems: ILotItem[];
  correctLotItem: ILotItem;

  constructor(question: IQuestion, solution: ISOLSolution) {
    super(question);
    this.incorrectLotItems = solution.incorrectLotItems;
    this.correctLotItem = solution.correctLotItem;
  }

  toQuizView(): ISOLQuizView {
    return {
      ...this,
      lot: this.incorrectLotItems.concat(this.correctLotItem),
    } as ISOLQuizView;
  }
}

class SMLQuestion extends BaseQuestion implements ISMLSolution {
  incorrectLotItems: ILotItem[];
  correctLotItems: ILotItem[];

  constructor(question: IQuestion, solution: ISMLSolution) {
    super(question);
    this.incorrectLotItems = solution.incorrectLotItems;
    this.correctLotItems = solution.correctLotItems;
  }
  toQuizView(): ISMLQuizView {
    return {
      ...this,
      lot: this.incorrectLotItems.concat(this.correctLotItems),
    } as ISMLQuizView;
  }
}

class OTLQuestion extends BaseQuestion implements IOTLSolution {
  ordering: ILotOrder[];

  constructor(question: IQuestion, solution: IOTLSolution) {
    super(question);
    this.ordering = solution.ordering;
  }
  toQuizView(): IOTLQuizView {
    return {
      ...this,
      lot: this.ordering.map(lotOrder => lotOrder.lotItem),
    } as IOTLQuizView;
  }
}

class NATQuestion extends BaseQuestion implements INATSolution {
  decimalPrecision: number;
  upperLimit: number;
  lowerLimit: number;
  value?: number;
  expression?: string;

  constructor(question: IQuestion, solution: INATSolution) {
    super(question);
    this.decimalPrecision = solution.decimalPrecision;
    this.upperLimit = solution.upperLimit;
    this.lowerLimit = solution.lowerLimit;
    this.value = solution.value;
    this.expression = solution.expression;
  }

  toQuizView(): INATQuizView {
    return {
      ...this,
    } as INATQuizView;
  }
}

class DESQuestion extends BaseQuestion implements IDESSolution {
  solutionText: string;
  constructor(question: IQuestion, solution: IDESSolution) {
    super(question);
    this.solutionText = solution.solutionText;
  }
  toQuizView(): IDESQuizView {
    return {
      ...this,
    } as IDESQuizView;
  }
}

class QuestionFactory {
  static createQuestion(
    body: CreateQuestionBody,
  ): SOLQuestion | SMLQuestion | OTLQuestion | NATQuestion | DESQuestion {
    switch (body.question.type) {
      case 'SELECT_ONE_IN_LOT':
        return new SOLQuestion(body.question, body.solution as ISOLSolution);
      case 'SELECT_MANY_IN_LOT':
        return new SMLQuestion(body.question, body.solution as ISMLSolution);
      case 'ORDER_THE_LOTS':
        return new OTLQuestion(body.question, body.solution as IOTLSolution);
      case 'NUMERIC_ANSWER_TYPE':
        return new NATQuestion(body.question, body.solution as INATSolution);
      case 'DESCRIPTIVE':
        return new DESQuestion(body.question, body.solution as IDESSolution);
      default:
        throw new Error('Invalid question type');
    }
  }
}

const question: IQuestion = {
  text: 'This is question',
  isParameterized: true,
  parameters: [
    {
      name: 'a',
      possibleValues: ['20', '10'],
      type: 'number',
    },
    {
      name: 'b',
      possibleValues: ['10', '12'],
      type: 'number',
    },
  ],
  points: 10,
  type: 'SELECT_ONE_IN_LOT',
  timeLimitSeconds: 60,
  hint: 'This is easy',
};

const solSolution: ISOLSolution = {
  incorrectLotItems: [
    {
      text: 'This is option 1',
      explaination: '',
    },
    {
      text: 'This is option 2',
      explaination: 'sdad',
    },
  ],
  correctLotItem: {
    text: '',
    explaination: '',
  },
};

const smlSolution: ISMLSolution = {
  incorrectLotItems: [
    {
      text: 'This is option 1',
      explaination: '',
    },
    {
      text: 'This is option 2',
      explaination: 'sdad',
    },
  ],
  correctLotItems: [
    {
      text: 'This is option 3',
      explaination: '',
    },
    {
      text: 'This is option 4',
      explaination: 'sdad',
    },
  ],
};

const otlSolution: IOTLSolution = {
  ordering: [
    {
      lotItem: {
        text: 'item 1',
        explaination: 'dahjkda',
      },
      order: 1,
    },
    {
      lotItem: {
        text: 'item 1',
        explaination: 'dahjkda',
      },
      order: 2,
    },
  ],
};

const mtlSolution = {
  matches: [
    {
      match: [
        {
          text: 'This is option 3',
          explaination: '',
        },
        {
          text: 'This is option 4',
          explaination: 'sdad',
        },
      ],
    },
    {
      match: [
        {
          text: 'This is option 3',
          explaination: '',
        },
        {
          text: 'This is option 4',
          explaination: 'sdad',
        },
      ],
    },
    {
      match: [
        {
          text: 'This is option 3',
          explaination: '',
        },
        {
          text: 'This is option 4',
          explaination: 'sdad',
        },
      ],
    },
  ],
};

const natSolution: INATSolution = {
  decimalPrecision: 1,
  upperLimit: 1.045,
  lowerLimit: 2.0,
  expression: '',
};

export {
  BaseQuestion,
  SOLQuestion,
  SMLQuestion,
  OTLQuestion,
  NATQuestion,
  DESQuestion,
  QuestionFactory,
};
