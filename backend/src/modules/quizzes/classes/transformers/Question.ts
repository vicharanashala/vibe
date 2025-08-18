import {
  IQuestion,
  QuestionType,
  IQuestionParameter,
  ISOLSolution,
  ILotItem,
  ISMLSolution,
  IOTLSolution,
  ILotOrder,
  INATSolution,
  IDESSolution,
  Priority,
} from '#shared/interfaces/quiz.js';
import {ObjectId} from 'mongodb';
import {QuestionBody} from '../validators/QuestionValidator.js';

abstract class BaseQuestion implements IQuestion {
  _id?: string | ObjectId;
  createdBy?: string;
  text: string;
  type: QuestionType;
  isParameterized: boolean;
  parameters?: IQuestionParameter[];
  hint?: string;
  timeLimitSeconds: number;
  points: number;
  priority: Priority;

  constructor(question: IQuestion, userId: string) {
    this._id = question._id;
    this.createdBy = userId;
    this.text = question.text;
    this.type = question.type;
    this.isParameterized = question.isParameterized;
    this.parameters = question.parameters;
    this.hint = question.hint;
    this.timeLimitSeconds = question.timeLimitSeconds;
    this.points = question.points;
    this.priority = question.priority;
  }
}

class SOLQuestion extends BaseQuestion implements ISOLSolution {
  incorrectLotItems: ILotItem[];
  correctLotItem: ILotItem;

  constructor(userId: string, question: IQuestion, solution: ISOLSolution) {
    super(question, userId);
    this.incorrectLotItems = ensureLotItemIds(solution.incorrectLotItems);
    this.correctLotItem = {
      ...solution.correctLotItem,
      _id: solution.correctLotItem._id ?? new ObjectId(),
    };
  }
}

class SMLQuestion extends BaseQuestion implements ISMLSolution {
  incorrectLotItems: ILotItem[];
  correctLotItems: ILotItem[];

  constructor(userId: string, question: IQuestion, solution: ISMLSolution) {
    super(question, userId);
    this.incorrectLotItems = ensureLotItemIds(solution.incorrectLotItems);
    this.correctLotItems = ensureLotItemIds(solution.correctLotItems);
  }
}

class OTLQuestion extends BaseQuestion implements IOTLSolution {
  ordering: ILotOrder[];

  constructor(userId: string, question: IQuestion, solution: IOTLSolution) {
    super(question, userId);
    this.ordering = solution.ordering.map(order => ({
      ...order,
      lotItem: {
        ...order.lotItem,
        _id: order.lotItem._id ?? new ObjectId(),
      },
    }));
  }
}

class NATQuestion extends BaseQuestion implements INATSolution {
  decimalPrecision: number;
  upperLimit: number;
  lowerLimit: number;
  value?: number;
  expression?: string;

  constructor(userId: string, question: IQuestion, solution: INATSolution) {
    super(question, userId);
    this.decimalPrecision = solution.decimalPrecision;
    this.upperLimit = solution.upperLimit;
    this.lowerLimit = solution.lowerLimit;
    this.value = solution.value;
    this.expression = solution.expression;
  }
}

class DESQuestion extends BaseQuestion implements IDESSolution {
  solutionText: string;
  constructor(userId: string, question: IQuestion, solution: IDESSolution) {
    super(question, userId);
    this.solutionText = solution.solutionText;
  }
}

function ensureLotItemIds(items: ILotItem[]): ILotItem[] {
  return items.map(item => ({
    ...item,
    _id: item._id ?? new ObjectId(),
  }));
}

class QuestionFactory {
  static createQuestion(
    body: QuestionBody,
    userId: string,
  ): SOLQuestion | SMLQuestion | OTLQuestion | NATQuestion | DESQuestion {
    switch (body.question.type) {
      case 'SELECT_ONE_IN_LOT':
        return new SOLQuestion(userId, body.question, body.solution as ISOLSolution);
      case 'SELECT_MANY_IN_LOT':
        return new SMLQuestion(userId, body.question, body.solution as ISMLSolution);
      case 'ORDER_THE_LOTS':
        return new OTLQuestion(userId, body.question, body.solution as IOTLSolution);
      case 'NUMERIC_ANSWER_TYPE':
        return new NATQuestion(userId, body.question, body.solution as INATSolution);
      case 'DESCRIPTIVE':
        return new DESQuestion(userId, body.question, body.solution as IDESSolution);
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
  priority: 'LOW',
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

class FlaggedQuestion {
  _id?: string | ObjectId;
  questionId: string;
  courseId?: string;
  versionId?: string;
  flaggedBy: string;
  reason: string;
  createdAt: Date;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  resolvedBy?: string;
  resolvedAt?: Date;
  
  constructor(
    questionId: string,
    userId: string,
    reason: string,
    courseId?: string,
    versionId?: string,
  ) {
    this.questionId = questionId;
    this.flaggedBy = userId;
    this.reason = reason;
    this.status = 'PENDING';
    this.createdAt = new Date();
    this.courseId = courseId;
    this.versionId = versionId;
  }
}

export {
  BaseQuestion,
  SOLQuestion,
  SMLQuestion,
  OTLQuestion,
  NATQuestion,
  DESQuestion,
  QuestionFactory,
  FlaggedQuestion,
};
