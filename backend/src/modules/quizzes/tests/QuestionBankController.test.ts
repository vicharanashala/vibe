import { sharedContainerModule } from '#root/container.js';
import Express from 'express';
import { RoutingControllersOptions, useContainer, useExpressServer } from 'routing-controllers';
import { quizzesContainerModule } from '../container.js';
import { coursesContainerModule } from '#root/modules/courses/container.js';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { quizzesModuleOptions } from '../index.js';
import { coursesModuleOptions } from '#root/modules/courses/index.js';
import request from 'supertest';
import { beforeAll, describe, it, expect } from 'vitest';


describe('QuestionBankController', () => {
  const appInstance = Express();
  let app: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(
      sharedContainerModule,
      quizzesContainerModule,
      coursesContainerModule,
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    const options: RoutingControllersOptions = {
      controllers: [...(quizzesModuleOptions.controllers as Function[]), ...(coursesModuleOptions.controllers as Function[])],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
    };
    app = useExpressServer(appInstance, options);
  }, 900000);

  describe('POST /quizzes/question-bank', () => {
    it('success: creates a question bank', async () => {
      const courseRes = await request(app).post('/courses').send({
        name: 'Course for Bank A',
        description: 'Course for POST success',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for POST success',
        });
      expect(versionRes.status).toBe(201);
      const courseVersionId = versionRes.body._id;

      const res = await request(app).post('/quizzes/question-bank').send({
        courseId,
        courseVersionId,
        questions: [],
        title: 'Bank A',
        description: 'Bank for POST success',
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('questionBankId');
    });

    it('failure: missing required fields', async () => {
      const res = await request(app).post('/quizzes/question-bank').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /quizzes/question-bank/:questionBankId', () => {
    it('success: gets a question bank by id', async () => {
      const courseRes = await request(app).post('/courses/').send({
        name: 'Course for Bank B',
        description: 'Course for GET success',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for GET success',
        });
      expect(versionRes.status).toBe(201);
      const courseVersionId = versionRes.body._id;

      const createRes = await request(app).post('/quizzes/question-bank').send({
        courseId,
        courseVersionId,
        questions: [],
        title: 'Bank B',
        description: 'Bank for GET success',
      });
      const bankId = createRes.body.questionBankId;
      const res = await request(app).get(`/quizzes/question-bank/${bankId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('title', 'Bank B');
    });

    it('failure: invalid id', async () => {
      const res = await request(app).get('/quizzes/question-bank/invalidid');
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /quizzes/question-bank/:questionBankId/questions/:questionId/add', () => {
    it('success: adds a question to the bank', async () => {
      const courseRes = await request(app).post('/courses/').send({
        name: 'Course for Bank C',
        description: 'Course for ADD success',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for ADD success',
        });
      expect(versionRes.status).toBe(201);
      const courseVersionId = versionRes.body._id;

      const bankRes = await request(app).post('/quizzes/question-bank').send({
        courseId,
        courseVersionId,
        questions: [],
        title: 'Bank C',
        description: 'Bank for ADD success',
      });

      const questionRes = await request(app).post('/quizzes/questions').send({
        question: {
          text: 'Question C',
          type: 'SELECT_ONE_IN_LOT',
          points: 5,
          timeLimitSeconds: 30,
          isParameterized: false,
          parameters: [],
          hint: 'Hint C',
        },
        solution: {
          correctLotItem: { text: 'Correct', explaination: 'Correct' },
          incorrectLotItems: [],
        },
      });
      const bankId = bankRes.body.questionBankId;
      const questionId = questionRes.body.questionId;
      const res = await request(app)
        .patch(`/quizzes/question-bank/${bankId}/questions/${questionId}/add`);
      expect(res.status).toBe(200);
      expect(res.body.questions).toContain(questionId);
    });

    it('failure: invalid ids', async () => {
      const res = await request(app)
        .patch('/quizzes/question-bank/invalidbank/questions/invalidquestion/add');
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /quizzes/question-bank/:questionBankId/questions/:questionId/remove', () => {
    it('success: removes a question from the bank', async () => {
      const courseRes = await request(app).post('/courses/').send({
        name: 'Course for Bank D',
        description: 'Course for REMOVE success',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for REMOVE success',
        });
      expect(versionRes.status).toBe(201);
      const courseVersionId = versionRes.body._id;

      const bankRes = await request(app).post('/quizzes/question-bank').send({
        courseId,
        courseVersionId,
        questions: [],
        title: 'Bank D',
        description: 'Bank for REMOVE success',
      });

      const questionRes = await request(app).post('/quizzes/questions').send({
        question: {
          text: 'Question D',
          type: 'SELECT_ONE_IN_LOT',
          points: 5,
          timeLimitSeconds: 30,
          isParameterized: false,
          parameters: [],
          hint: 'Hint D',
        },
        solution: {
          correctLotItem: { text: 'Correct', explaination: 'Correct' },
          incorrectLotItems: [],
        },
      });
      const bankId = bankRes.body.questionBankId;
      const questionId = questionRes.body.questionId;
      // Add first
      await request(app)
        .patch(`/quizzes/question-bank/${bankId}/questions/${questionId}/add`);
      // Remove
      const res = await request(app)
        .patch(`/quizzes/question-bank/${bankId}/questions/${questionId}/remove`);
      expect(res.status).toBe(200);
      expect(res.body.questions).not.toContain(questionId);
    });

    it('failure: invalid ids', async () => {
      const res = await request(app)
        .patch('/quizzes/question-bank/invalidbank/questions/invalidquestion/remove');
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /quizzes/question-bank/:questionBankId/questions/:questionId/replace-duplicate', () => {
    it('success: replaces a question with its duplicate', async () => {
      const courseRes = await request(app).post('/courses/').send({
        name: 'Course for Bank E',
        description: 'Course for REPLACE success',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for REPLACE success',
        });
      expect(versionRes.status).toBe(201);
      const courseVersionId = versionRes.body._id;

      const bankRes = await request(app).post('/quizzes/question-bank').send({
        courseId,
        courseVersionId,
        questions: [],
        title: 'Bank E',
        description: 'Bank for REPLACE success',
      });

      const questionRes = await request(app).post('/quizzes/questions').send({
        question: {
          text: 'Question E',
          type: 'SELECT_ONE_IN_LOT',
          points: 5,
          timeLimitSeconds: 30,
          isParameterized: false,
          parameters: [],
          hint: 'Hint E',
        },
        solution: {
          correctLotItem: { text: 'Correct', explaination: 'Correct' },
          incorrectLotItems: [],
        },
      });
      const bankId = bankRes.body.questionBankId;
      const questionId = questionRes.body.questionId;
      // Add first
      await request(app)
        .patch(`/quizzes/question-bank/${bankId}/questions/${questionId}/add`);
      // Replace
      const res = await request(app)
        .patch(`/quizzes/question-bank/${bankId}/questions/${questionId}/replace-duplicate`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('newQuestionId');
      expect(res.body.newQuestionId).not.toBe(questionId);
    });

    it('failure: invalid ids', async () => {
      const res = await request(app)
        .patch('/quizzes/question-bank/invalidbank/questions/invalidquestion/replace-duplicate');
      expect(res.status).toBe(400);
    });
  });
});
