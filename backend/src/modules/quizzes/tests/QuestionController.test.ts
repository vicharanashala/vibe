import {useExpressServer, RoutingControllersOptions} from 'routing-controllers';
import request from 'supertest';
import Express from 'express';
import {quizzesModuleOptions, setupQuizzesContainer} from '../index.js';
import {describe, it, expect, beforeAll, beforeEach} from 'vitest';
import {IUser} from '#root/shared/interfaces/models.js';
import {CourseData} from '#root/modules/users/tests/utils/createCourse.js';
import {
  DESquestionData,
  DESsolution,
  NATquestionData,
  NATsolution,
  OTLquestionData,
  OTLsolution,
  SMLquestionData,
  SMLsolution,
  SOLquestionData,
  SOLsolution,
} from './SamleQuestionBody.js';
import {
  IQuestion,
  ISOLSolution,
  ISMLSolution,
  IOTLSolution,
} from '#root/shared/interfaces/quiz.js';
import {QuestionBody} from '../classes/index.js';

describe('Progress Controller Integration Tests', () => {
  const appInstance = Express();
  let app;
  let user: IUser;
  let courseData: CourseData;

  beforeAll(async () => {
    //Set env variables
    process.env.NODE_ENV = 'test';
    // setupQuizzesModuleDependencies();
    await setupQuizzesContainer();

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

  beforeEach(async () => {}, 10000);

  describe('Create Question', () => {
    it('should create a question', async () => {
      const body: QuestionBody = {
        question: SOLquestionData,
        solution: SOLsolution,
      };
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(201);
    });
    it('should create an SML question', async () => {
      const body: QuestionBody = {
        question: SMLquestionData,
        solution: SMLsolution,
      };
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(201);
    });
    it('should create an OTL question', async () => {
      const body: QuestionBody = {
        question: OTLquestionData,
        solution: OTLsolution,
      };
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(201);
    });
    it('should create a NAT question', async () => {
      const body: QuestionBody = {
        question: NATquestionData,
        solution: NATsolution,
      };
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(201);
    });
    it('should create a DES question', async () => {
      const body: QuestionBody = {
        question: DESquestionData,
        solution: DESsolution,
      };
      const response = await request(app).post('/quizzes/questions').send(body);
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
      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
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
      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
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
      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
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
      const body: QuestionBody = {
        question: questionData,
        solution: solution as ISOLSolution,
      };
      const response = await request(app).post('/quizzes/questions').send(body);
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
      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(500);
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

      const body: QuestionBody = {
        question: questionData,
        solution: solution,
      };

      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(201);
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

      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(500);
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

      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(500);
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

      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(500);
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

      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(500);
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

      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(500);
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

      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(500);
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

      const body: QuestionBody = {question: questionData, solution};
      const response = await request(app).post('/quizzes/questions').send(body);
      expect(response.status).toBe(500);
      expect(response.body.message).toMatch(/must be of type 'number'/i);
    });
  });

  describe('Get Question', () => {
    // NAT
    it('should get a NAT question by ID', async () => {
      const body: QuestionBody = {
        question: NATquestionData,
        solution: NATsolution,
      };
      const createRes = await request(app)
        .post('/quizzes/questions')
        .send(body);
      expect(createRes.status).toBe(201);
      const questionId = createRes.body.questionId;

      const res = await request(app).get(`/quizzes/questions/${questionId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('text');
      console.log(res.body);
    });
    // SOL
    it('should get a SOL question by ID', async () => {
      const body: QuestionBody = {
        question: SOLquestionData,
        solution: SOLsolution,
      };
      const createRes = await request(app)
        .post('/quizzes/questions')
        .send(body);
      expect(createRes.status).toBe(201);
      const questionId = createRes.body.questionId;

      const res = await request(app).get(`/quizzes/questions/${questionId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('text');
      console.log(res.body);
    });
    // SML
    it('should get a SML question by ID', async () => {
      const body: QuestionBody = {
        question: SMLquestionData,
        solution: SMLsolution,
      };
      const createRes = await request(app)
        .post('/quizzes/questions')
        .send(body);
      expect(createRes.status).toBe(201);
      const questionId = createRes.body.questionId;

      const res = await request(app).get(`/quizzes/questions/${questionId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('text');
      console.log(res.body);
    });
    // OTL
    it('should get an OTL question by ID', async () => {
      const body: QuestionBody = {
        question: OTLquestionData,
        solution: OTLsolution,
      };
      const createRes = await request(app)
        .post('/quizzes/questions')
        .send(body);
      expect(createRes.status).toBe(201);
      const questionId = createRes.body.questionId;

      const res = await request(app).get(`/quizzes/questions/${questionId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('text');
      console.log(res.body);
    });
    // DES
    it('should get a DES question by ID', async () => {
      const body: QuestionBody = {
        question: DESquestionData,
        solution: DESsolution,
      };
      const createRes = await request(app)
        .post('/quizzes/questions')
        .send(body);
      expect(createRes.status).toBe(201);
      const questionId = createRes.body.questionId;

      const res = await request(app).get(`/quizzes/questions/${questionId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('text');
      console.log(res.body);
    });
    it('should return 404 for non-existent question', async () => {
      const res = await request(app).get(
        '/quizzes/questions/507f1f77bcf86cd799439011',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('Update Question', () => {
    const originalQuestion: IQuestion = {
      text: 'Original question',
      type: 'NUMERIC_ANSWER_TYPE',
      points: 2,
      timeLimitSeconds: 20,
      isParameterized: false,
      parameters: [],
      hint: 'Original hint',
    };
    const originalSolution = {
      decimalPrecision: 0,
      upperLimit: 10,
      lowerLimit: 0,
      value: 3,
    };

    it('should update a question by ID', async () => {
      // Create a question first
      const createBody: QuestionBody = {
        question: originalQuestion,
        solution: originalSolution,
      };
      const createRes = await request(app)
        .post('/quizzes/questions')
        .send(createBody);
      expect(createRes.status).toBe(201);
      const questionId = createRes.body.questionId;

      // Now update it
      const updatedQuestion: IQuestion = {
        ...originalQuestion,
        text: 'Updated question',
        points: 5,
        hint: 'Updated hint',
      };
      const updatedSolution = {...originalSolution, value: 7};
      const updateBody: QuestionBody = {
        question: updatedQuestion,
        solution: updatedSolution,
      };
      const res = await request(app)
        .put(`/quizzes/questions/${questionId}`)
        .send(updateBody);
      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Updated question');
      expect(res.body.points).toBe(5);
    });

    it('should return 404 for non-existent question', async () => {
      const updatedQuestion = {...originalQuestion, text: 'Does not matter'};
      const updatedSolution = {...originalSolution, value: 0};
      const body: QuestionBody = {
        question: updatedQuestion,
        solution: updatedSolution,
      };
      const res = await request(app)
        .put('/quizzes/questions/507f1f77bcf86cd799439011')
        .send(body);
      expect(res.status).toBe(404);
    });
  });

  describe('Delete Question', () => {
    const questionData: IQuestion = {
      text: 'Delete this question',
      type: 'NUMERIC_ANSWER_TYPE',
      points: 2,
      timeLimitSeconds: 20,
      isParameterized: false,
      parameters: [],
      hint: 'Delete hint',
    };
    const solution = {
      decimalPrecision: 0,
      upperLimit: 10,
      lowerLimit: 0,
      value: 9,
    };

    it('should delete a question by ID and remove it from all question banks', async () => {
      // Create a question first
      const createBody: QuestionBody = {question: questionData, solution};
      const createRes = await request(app)
        .post('/quizzes/questions')
        .send(createBody);
      expect(createRes.status).toBe(201);
      const questionId = createRes.body.questionId;

      // Create a question bank with the question
      const bankRes = await request(app)
        .post('/quizzes/question-bank')
        .send({
          questions: [questionId],
          title: 'Bank for Delete Test',
          description: 'Bank for delete question test',
        });
      expect(bankRes.status).toBe(200);
      const questionBankId = bankRes.body.questionBankId;

      // Confirm the question is in the bank
      const bankGetRes = await request(app).get(
        `/quizzes/question-bank/${questionBankId}`,
      );
      expect(bankGetRes.status).toBe(200);
      expect(bankGetRes.body.questions).toContain(questionId);

      // Now delete the question
      const res = await request(app).delete(`/quizzes/questions/${questionId}`);
      expect(res.status).toBe(204);

      // Confirm deletion
      const getRes = await request(app).get(`/quizzes/questions/${questionId}`);
      expect(getRes.status).toBe(404);

      // Confirm the question is removed from the bank
      const bankGetResAfter = await request(app).get(
        `/quizzes/question-bank/${questionBankId}`,
      );
      expect(bankGetResAfter.status).toBe(200);
      // expect(bankGetResAfter.body.questions).not.toContain(questionId);
    });

    it('should return 404 for non-existent question', async () => {
      const res = await request(app).delete(
        '/quizzes/questions/507f1f77bcf86cd799439011',
      );
      expect(res.status).toBe(404);
    });
  });
});
