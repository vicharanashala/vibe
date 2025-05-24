import Express from 'express';
import {setupAuthModuleDependencies, authModuleOptions} from 'modules/auth';
import {
  setupCoursesModuleDependencies,
  coursesModuleOptions,
} from 'modules/courses';
import {setupUsersModuleDependencies, usersModuleOptions} from 'modules/users';
import {ProgressService} from 'modules/users/services/ProgressService';
import {
  CourseData,
  createCourseWithModulesSectionsAndItems,
} from 'modules/users/tests/utils/createCourse';
import {createEnrollment} from 'modules/users/tests/utils/createEnrollment';
import {createUser} from 'modules/users/tests/utils/createUser';
import {RoutingControllersOptions, useExpressServer} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {ProgressRepository} from 'shared/database/providers/mongo/repositories/ProgressRepository';
import {
  MongoDatabase,
  UserRepository,
} from 'shared/database/providers/MongoDatabaseProvider';
import {IUser} from 'shared/interfaces/Models';
import Container from 'typedi';
import {quizzesModuleOptions} from '..';
import {
  IOTLSolution,
  IQuestion,
  ISMLSolution,
  ISOLSolution,
} from 'shared/interfaces/quiz';
import {SOLQuestion} from '../classes/transformers';
import {CreateQuestionBody, SOLSolution} from '../classes/validators';
import request from 'supertest';

describe('Progress Controller Integration Tests', () => {
  const appInstance = Express();
  let app;
  let user: IUser;
  let courseData: CourseData;

  beforeAll(async () => {
    //Set env variables
    process.env.NODE_ENV = 'test';
    // setupQuizzesModuleDependencies();

    // Create the Express app with routing-controllers configuration
    const options: RoutingControllersOptions = {
      controllers: [...(quizzesModuleOptions.controllers as Function[])],
      authorizationChecker: async (action, roles) => {
        return true;
      },
      defaultErrorHandler: true,
      validation: true,
    };

    app = useExpressServer(appInstance, options);
  }, 900000);

  afterAll(async () => {
    Container.reset();
  });

  beforeEach(async () => {}, 10000);

  describe('Create Question', () => {
    it('should create a question', async () => {
      const questionData: IQuestion = {
        text: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
        type: 'SELECT_ONE_IN_LOT',
        points: 10,
        timeLimitSeconds: 60,
        isParameterized: true,
        parameters: [
          {name: 'a', possibleValues: ['20', '10'], type: 'number'},
          {
            name: 'b',
            possibleValues: ['1', '2', '3', '4.5', '7'],
            type: 'number',
          },
          {name: 'name', possibleValues: ['John', 'Doe'], type: 'string'},
          {name: 'name2', possibleValues: ['Kalix', 'Danny'], type: 'string'},
        ],
        hint: 'This is a hint for <QParam>name</QParam> and <QParam>name2</QParam>',
      };

      const solution: ISOLSolution = {
        correctLotItem: {
          text: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
          explaination:
            'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
        },
        incorrectLotItems: [
          {
            text: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
            explaination:
              'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
          },
          {
            text: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
            explaination:
              'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
          },
        ],
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(201);
    });
    it('should create an SML question', async () => {
      const questionData: IQuestion = {
        text: 'Select all correct options: <QParam>animal</QParam>, <QParam>color</QParam>',
        type: 'SELECT_MANY_IN_LOT',
        points: 15,
        timeLimitSeconds: 90,
        isParameterized: true,
        parameters: [
          {name: 'animal', possibleValues: ['Dog', 'Cat'], type: 'string'},
          {name: 'color', possibleValues: ['Red', 'Blue'], type: 'string'},
        ],
        hint: 'Pick all that apply to <QParam>animal</QParam> and <QParam>color</QParam>',
      };

      const solution: ISMLSolution = {
        correctLotItems: [
          {
            text: 'Correct: <QParam>animal</QParam>',
            explaination: 'This is a correct animal: <QParam>animal</QParam>',
          },
          {
            text: 'Correct color: <QParam>color</QParam>',
            explaination: 'This is a correct color: <QParam>color</QParam>',
          },
        ],
        incorrectLotItems: [
          {
            text: 'Incorrect option',
            explaination: 'This is not correct',
          },
        ],
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(201);
    });
    it('should create an OTL question', async () => {
      const questionData: IQuestion = {
        text: 'Arrange the following in correct order: <QParam>step1</QParam>, <QParam>step2</QParam>, <QParam>step3</QParam>, <QParam>step4</QParam>, <QParam>step5</QParam>',
        type: 'ORDER_THE_LOTS',
        points: 25,
        timeLimitSeconds: 180,
        isParameterized: true,
        parameters: [
          {
            name: 'step1',
            possibleValues: ['Wake up', 'Alarm Sounds'],
            type: 'string',
          },
          {
            name: 'step2',
            possibleValues: ['Brush teeth', 'Rinse mouth'],
            type: 'string',
          },
          {
            name: 'step3',
            possibleValues: ['Take a shower', 'Wash hair'],
            type: 'string',
          },
          {
            name: 'step4',
            possibleValues: ['Eat breakfast', 'Drink coffee'],
            type: 'string',
          },
          {
            name: 'step5',
            possibleValues: ['Go to school', 'Leave home'],
            type: 'string',
          },
        ],
        hint: 'Put all the steps in the correct order: <QParam>step1</QParam> to <QParam>step5</QParam>',
      };

      const solution: IOTLSolution = {
        ordering: [
          {
            lotItem: {
              text: 'Step 1: <QParam>step1</QParam>',
              explaination: 'This is the first step: <QParam>step1</QParam>',
            },
            order: 1,
          },
          {
            lotItem: {
              text: 'Step 2: <QParam>step2</QParam>',
              explaination: 'This is the second step: <QParam>step2</QParam>',
            },
            order: 2,
          },
          {
            lotItem: {
              text: 'Step 3: <QParam>step3</QParam>',
              explaination: 'This is the third step: <QParam>step3</QParam>',
            },
            order: 3,
          },
          {
            lotItem: {
              text: 'Step 4: <QParam>step4</QParam>',
              explaination: 'This is the fourth step: <QParam>step4</QParam>',
            },
            order: 4,
          },
          {
            lotItem: {
              text: 'Step 5: <QParam>step5</QParam>',
              explaination: 'This is the fifth step: <QParam>step5</QParam>',
            },
            order: 5,
          },
        ],
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(201);
    });
    it('should create a NAT question', async () => {
      const questionData: IQuestion = {
        text: 'What is the value of <QParam>x</QParam> + <QParam>y</QParam>?',
        type: 'NUMERIC_ANSWER_TYPE',
        points: 5,
        timeLimitSeconds: 30,
        isParameterized: true,
        parameters: [
          {name: 'x', possibleValues: ['2', '3'], type: 'number'},
          {name: 'y', possibleValues: ['5', '7'], type: 'number'},
        ],
        hint: 'Add <QParam>x</QParam> and <QParam>y</QParam>.',
      };

      const solution = {
        decimalPrecision: 0,
        upperLimit: 20,
        lowerLimit: 0,
        expression: '<QParam>x</QParam> + <QParam>y</QParam>',
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(201);
    });
    it('should create a DES question', async () => {
      const questionData: IQuestion = {
        text: 'Describe the process of <QParam>process</QParam> in <QParam>subject</QParam>.',
        type: 'DESCRIPTIVE',
        points: 8,
        timeLimitSeconds: 120,
        isParameterized: true,
        parameters: [
          {
            name: 'process',
            possibleValues: ['compiling', 'generating machine code'],
            type: 'string',
          },
          {
            name: 'subject',
            possibleValues: ['coding', 'programming'],
            type: 'string',
          },
        ],
        hint: 'Focus on <QParam>process</QParam> and <QParam>subject</QParam>.',
      };

      const solution = {
        solutionText:
          'The process of <QParam>process</QParam> in <QParam>subject</QParam> involves several steps...',
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(201);
    });
    it('should fail if parameterized but no tags in question text', async () => {
      const questionData: IQuestion = {
        text: 'This question has no tags.',
        type: 'SELECT_ONE_IN_LOT',
        points: 10,
        timeLimitSeconds: 60,
        isParameterized: true,
        parameters: [{name: 'a', possibleValues: ['1', '2'], type: 'number'}],
        hint: 'No tags here either.',
      };
      const solution: ISOLSolution = {
        correctLotItem: {text: 'No tags here.', explaination: 'No tags.'},
        incorrectLotItems: [],
      };
      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/must have a valid tag/i);
    });
    it('should fail if not parameterized but parameters are defined', async () => {
      const questionData: IQuestion = {
        text: 'No parameters needed.',
        type: 'SELECT_ONE_IN_LOT',
        points: 10,
        timeLimitSeconds: 60,
        isParameterized: false,
        parameters: [{name: 'a', possibleValues: ['1', '2'], type: 'number'}],
        hint: 'Should not have parameters.',
      };
      const solution: ISOLSolution = {
        correctLotItem: {
          text: 'No parameters.',
          explaination: 'No parameters.',
        },
        incorrectLotItems: [],
      };
      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(
        /not parameterized, but has parameters/i,
      );
    });
    it('should fail if parameterized but parameters array is empty', async () => {
      const questionData: IQuestion = {
        text: 'This is <QParam>a</QParam>.',
        type: 'SELECT_ONE_IN_LOT',
        points: 10,
        timeLimitSeconds: 60,
        isParameterized: true,
        parameters: [],
        hint: 'Missing parameters.',
      };
      const solution: ISOLSolution = {
        correctLotItem: {
          text: 'Missing param.',
          explaination: 'Missing param.',
        },
        incorrectLotItems: [],
      };
      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(
        /parameterized, but has no parameters/i,
      );
    });
    it('should fail if required solution fields are missing', async () => {
      const questionData: IQuestion = {
        text: 'What is 2 + 2?',
        type: 'NUMERIC_ANSWER_TYPE',
        points: 5,
        timeLimitSeconds: 30,
        isParameterized: false,
        parameters: [],
        hint: 'Simple math.',
      };
      // Missing decimalPrecision, upperLimit, lowerLimit
      const solution = {};
      const body: CreateQuestionBody = {
        question: questionData,
        solution: undefined,
      };
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Invalid body/i);
    });
    it('should fail if parameter tag in text does not match any parameter', async () => {
      const questionData: IQuestion = {
        text: 'This is <QParam>notDefined</QParam>.',
        type: 'SELECT_ONE_IN_LOT',
        points: 10,
        timeLimitSeconds: 60,
        isParameterized: true,
        parameters: [{name: 'a', possibleValues: ['1', '2'], type: 'number'}],
        hint: 'Tag does not match parameter.',
      };
      const solution: ISOLSolution = {
        correctLotItem: {text: 'Wrong tag.', explaination: 'Wrong tag.'},
        incorrectLotItems: [],
      };
      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(
        /At least one LotItem must contain a valid tag./i,
      );
    });
    it('should return the original question if not parameterized', async () => {
      const questionData: IQuestion = {
        text: 'What is 2 + 2?',
        type: 'NUMERIC_ANSWER_TYPE',
        points: 5,
        timeLimitSeconds: 30,
        isParameterized: false,
        parameters: [],
        hint: 'Simple math.',
      };

      const solution = {
        decimalPrecision: 0,
        upperLimit: 10,
        lowerLimit: 0,
        value: 4,
      };

      const body: CreateQuestionBody = {
        question: questionData,
        solution: solution,
      };

      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(201);
      // The response should have the same text as the original, since no tag processing occurs
      expect(response.body.text).toBe(questionData.text);
    });
    it('should fail to create an SML question because of no tags', async () => {
      const questionData: IQuestion = {
        text: 'Select all correct options: <QParam>animal</QParam>, <QParam>color</QParam>',
        type: 'SELECT_MANY_IN_LOT',
        points: 15,
        timeLimitSeconds: 90,
        isParameterized: true,
        parameters: [
          {name: 'animal', possibleValues: ['Dog', 'Cat'], type: 'string'},
          {name: 'color', possibleValues: ['Red', 'Blue'], type: 'string'},
        ],
        hint: 'Pick all that apply to <QParam>animal</QParam> and <QParam>color</QParam>',
      };

      const solution: ISMLSolution = {
        correctLotItems: [
          {
            text: 'Correct: animal',
            explaination: 'This is a correct animal: animal',
          },
          {
            text: 'Correct color: color',
            explaination: 'This is a correct color: color',
          },
        ],
        incorrectLotItems: [
          {
            text: 'Incorrect option',
            explaination: 'This is not correct',
          },
        ],
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(
        /at least one lotitem must contain a valid tag/i,
      );
    });
    it('should fail to create an OTL question because of no tags', async () => {
      const questionData: IQuestion = {
        text: 'Arrange the following in correct order: <QParam>step1</QParam>, <QParam>step2</QParam>, <QParam>step3</QParam>, <QParam>step4</QParam>, <QParam>step5</QParam>',
        type: 'ORDER_THE_LOTS',
        points: 25,
        timeLimitSeconds: 180,
        isParameterized: true,
        parameters: [
          {
            name: 'step1',
            possibleValues: ['Wake up', 'Alarm Sounds'],
            type: 'string',
          },
          {
            name: 'step2',
            possibleValues: ['Brush teeth', 'Rinse mouth'],
            type: 'string',
          },
          {
            name: 'step3',
            possibleValues: ['Take a shower', 'Wash hair'],
            type: 'string',
          },
          {
            name: 'step4',
            possibleValues: ['Eat breakfast', 'Drink coffee'],
            type: 'string',
          },
          {
            name: 'step5',
            possibleValues: ['Go to school', 'Leave home'],
            type: 'string',
          },
        ],
        hint: 'Put all the steps in the correct order: <QParam>step1</QParam> to <QParam>step5</QParam>',
      };

      const solution: IOTLSolution = {
        ordering: [
          {
            lotItem: {
              text: 'Step 1',
              explaination: 'This is the first',
            },
            order: 1,
          },
          {
            lotItem: {
              text: 'Step 2',
              explaination: 'This is the second',
            },
            order: 2,
          },
          {
            lotItem: {
              text: 'Step 3',
              explaination: 'This is the third',
            },
            order: 3,
          },
          {
            lotItem: {
              text: 'Step 4',
              explaination: 'This is the fourth',
            },
            order: 4,
          },
          {
            lotItem: {
              text: 'Step 5',
              explaination: 'This is the fifth',
            },
            order: 5,
          },
        ],
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(
        /at least one lotitem must contain a valid tag/i,
      );
    });
    it('should fail to create a DES question if a QParam tag does not match any parameter', async () => {
      const questionData: IQuestion = {
        text: 'Describe the process of <QParam>process</QParam> in <QParam>subject</QParam> and <QParam>missingParam</QParam>.',
        type: 'DESCRIPTIVE',
        points: 8,
        timeLimitSeconds: 120,
        isParameterized: true,
        parameters: [
          {
            name: 'process',
            possibleValues: ['compiling', 'generating machine code'],
            type: 'string',
          },
          {
            name: 'subject',
            possibleValues: ['coding', 'programming'],
            type: 'string',
          },
        ],
        hint: 'Focus on <QParam>process</QParam> and <QParam>subject</QParam>.',
      };

      const solution = {
        solutionText:
          'The process of <QParam>process</QParam> in <QParam>subject</QParam> and <QParam>missingParam</QParam> involves several steps...',
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/not found in context/i);
    });
    it('should fail to create a question with a NumExpr tag referencing missing parameter', async () => {
      const questionData: IQuestion = {
        text: 'Calculate: <NumExpr>a + b + c</NumExpr>',
        type: 'NUMERIC_ANSWER_TYPE',
        points: 5,
        timeLimitSeconds: 30,
        isParameterized: true,
        parameters: [
          {name: 'a', possibleValues: ['1', '2'], type: 'number'},
          {name: 'b', possibleValues: ['3', '4'], type: 'number'},
          // 'c' is missing
        ],
        hint: 'Add a, b, and c.',
      };

      const solution = {
        decimalPrecision: 0,
        upperLimit: 10,
        lowerLimit: 0,
        expression: '<NumExpr>a + b + c</NumExpr>',
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(
        /not found in parameters|not found in context/i,
      );
    });
    it('should fail to create a question with a NumExpr tag referencing a non-number parameter', async () => {
      const questionData: IQuestion = {
        text: 'Calculate: <NumExpr>a + b</NumExpr>',
        type: 'NUMERIC_ANSWER_TYPE',
        points: 5,
        timeLimitSeconds: 30,
        isParameterized: true,
        parameters: [
          {name: 'a', possibleValues: ['1', '2'], type: 'number'},
          {name: 'b', possibleValues: ['foo', 'bar'], type: 'string'}, // not a number
        ],
        hint: 'Add a and b.',
      };

      const solution = {
        decimalPrecision: 0,
        upperLimit: 10,
        lowerLimit: 0,
        expression: '<NumExpr>a + b</NumExpr>',
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/must be of type 'number'/i);
    });
    it('should fail to create a question with a NumExprTex tag referencing missing parameter', async () => {
      const questionData: IQuestion = {
        text: 'Render: <NumExprTex>a + b + c</NumExprTex>',
        type: 'NUMERIC_ANSWER_TYPE',
        points: 5,
        timeLimitSeconds: 30,
        isParameterized: true,
        parameters: [
          {name: 'a', possibleValues: ['1', '2'], type: 'number'},
          {name: 'b', possibleValues: ['3', '4'], type: 'number'},
          // 'c' is missing
        ],
        hint: 'Render a, b, and c.',
      };

      const solution = {
        decimalPrecision: 0,
        upperLimit: 10,
        lowerLimit: 0,
        expression: '<NumExprTex>a + b + c</NumExprTex>',
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(
        /not found in parameters|not found in context/i,
      );
    });
    it('should fail to create a question with a NumExprTex tag referencing a non-number parameter', async () => {
      const questionData: IQuestion = {
        text: 'Render: <NumExprTex>a + b</NumExprTex>',
        type: 'NUMERIC_ANSWER_TYPE',
        points: 5,
        timeLimitSeconds: 30,
        isParameterized: true,
        parameters: [
          {name: 'a', possibleValues: ['1', '2'], type: 'number'},
          {name: 'b', possibleValues: ['foo', 'bar'], type: 'string'}, // not a number
        ],
        hint: 'Render a and b.',
      };

      const solution = {
        decimalPrecision: 0,
        upperLimit: 10,
        lowerLimit: 0,
        expression: '<NumExprTex>a + b</NumExprTex>',
      };

      const body: CreateQuestionBody = {question: questionData, solution};
      const response = await request(app).post('/questions').send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/must be of type 'number'/i);
    });
  });
});
