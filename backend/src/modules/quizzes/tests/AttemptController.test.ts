import Express from 'express';
import { RoutingControllersOptions, useContainer, useExpressServer } from 'routing-controllers';
import { quizzesContainerModule, quizzesModuleOptions } from '..';
import { coursesContainerModule, coursesModuleOptions } from '#courses/index.js';
import { authContainerModule } from '#auth/container.js';
import { authModuleOptions } from '#auth/index.js';
import request from 'supertest';
import { jest } from '@jest/globals';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { Container } from 'inversify';
import { faker } from '@faker-js/faker';
import { ItemType } from '../../../shared/interfaces/models';
import { usersContainerModule } from '#users/container.js';

jest.setTimeout(30000);

describe('AttemptController', () => {
  const appInstance = Express();
  let app: any;
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(
      sharedContainerModule,
      quizzesContainerModule,
      coursesContainerModule,
      usersContainerModule,
      authContainerModule
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

    const options: RoutingControllersOptions = {
      controllers: [
        ...(quizzesModuleOptions.controllers as Function[]),
        ...(coursesModuleOptions.controllers as Function[]),
        ...(authModuleOptions.controllers as Function[]),
      ],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
      currentUserChecker: async () => {
        return userId
          ? { _id: userId, email: 'attempt_test_user@example.com', name: 'Attempt Test User' }
          : null;
      },
    };
    app = useExpressServer(appInstance, options);

    // Sign up a user and store the userId (using AuthController style)
    const signUpBody = {
      email: faker.internet.email(),
      password: 'TestPassword123!',
      firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
      lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
    };
    const signupRes = await request(app).post('/auth/signup').send(signUpBody);
    expect(signupRes.status).toBe(201);
    userId = signupRes.body;
    expect(userId).toBeTruthy();
  }, 900000);

  describe('POST /quizzes/:quizId/attempt', () => {
    it('should create an attempt for a quiz', async () => {
      // Create course
      const courseRes = await request(app).post('/courses').send({
        name: 'Course for Attempt',
        description: 'Course for attempt test',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      // Create course version
      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for attempt test',
        });
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body._id;

      // Create module
      const moduleRes = await request(app)
        .post(`/courses/versions/${versionId}/modules`)
        .send({
          name: 'Module for Attempt',
          description: 'Module for attempt test',
        });
      expect(moduleRes.status).toBe(201);
      const moduleId = moduleRes.body.version.modules[0].moduleId;

      // Create section
      const sectionRes = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .send({
          name: 'Section for Attempt',
          description: 'Section for attempt test',
        });
      expect(sectionRes.status).toBe(201);
      const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

      // Create quiz item
      const itemPayload = {
        name: 'Quiz Item for Attempt',
        description: 'Quiz item description',
        type: ItemType.QUIZ,
        quizDetails: {
          questionVisibility: 3,
          allowPartialGrading: true,
          deadline: faker.date.future(),
          allowHint: true,
          maxAttempts: 5,
          releaseTime: faker.date.future(),
          quizType: 'DEADLINE',
          showCorrectAnswersAfterSubmission: true,
          showExplanationAfterSubmission: true,
          showScoreAfterSubmission: true,
          approximateTimeToComplete: '00:30:00',
          passThreshold: 0.7,
        },
      };

      const itemRes = await request(app)
        .post(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`
        )
        .send(itemPayload);
      expect(itemRes.status).toBe(201);
      const quizId = itemRes.body.createdItem._id;

      // Create attempt
      const res = await request(app)
        .post(`/quizzes/${quizId}/attempt`)
        .send();
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('attemptId');
    });
  });

  describe('POST /quizzes/:quizId/attempt/:attemptId/save', () => {
    it('should save answers for an attempt with a real question from a question bank', async () => {
      // 1. Create course
      const courseRes = await request(app).post('/courses').send({
        name: 'Course for Attempt Save Real',
        description: 'Course for attempt save test (real question)',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      // 2. Create course version
      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for attempt save test (real question)',
        });
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body._id;

      // 3. Create module
      const moduleRes = await request(app)
        .post(`/courses/versions/${versionId}/modules`)
        .send({
          name: 'Module for Attempt Save Real',
          description: 'Module for attempt save test (real question)',
        });
      expect(moduleRes.status).toBe(201);
      const moduleId = moduleRes.body.version.modules[0].moduleId;

      // 4. Create section
      const sectionRes = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .send({
          name: 'Section for Attempt Save Real',
          description: 'Section for attempt save test (real question)',
        });
      expect(sectionRes.status).toBe(201);
      const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

      // 5. Create a real question
      const questionData = {
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
      const questionRes = await request(app).post('/questions').send({
        question: questionData,
        solution,
      });
      expect(questionRes.status).toBe(201);
      const questionId = questionRes.body.questionId;

      // 6. Create question bank with the question
      const bankRes = await request(app).post('/question-bank').send({
        courseId,
        courseVersionId: versionId,
        questions: [questionId],
        title: 'Bank for Attempt Save Real',
        description: 'Bank for attempt save test (real question)',
      });
      expect(bankRes.status).toBe(200);
      const questionBankId = bankRes.body.questionBankId;

      // 7. Create quiz item referencing the question bank
      const itemPayload = {
        name: 'Quiz Item for Attempt Save Real',
        description: 'Quiz item description',
        type: ItemType.QUIZ,
        quizDetails: {
          questionBankIds: [questionBankId],
          questionVisibility: 3,
          allowPartialGrading: true,
          deadline: faker.date.future(),
          allowHint: true,
          maxAttempts: 5,
          releaseTime: faker.date.future(),
          quizType: 'DEADLINE',
          showCorrectAnswersAfterSubmission: true,
          showExplanationAfterSubmission: true,
          showScoreAfterSubmission: true,
          approximateTimeToComplete: '00:30:00',
          passThreshold: 0.7,
        },
      };

      const itemRes = await request(app)
        .post(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`
        )
        .send(itemPayload);
      expect(itemRes.status).toBe(201);
      const quizId = itemRes.body.createdItem._id;

      // 8. Create attempt
      const attemptRes = await request(app)
        .post(`/quizzes/${quizId}/attempt`)
        .send();
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;

      // 9. Save answers for the real question
      const saveRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/save`)
        .send({
          answers: [
            {
              questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 4},
            },
          ],
        });
      expect(saveRes.status).toBe(200);

      // Optionally, fetch the attempt and check the answer is saved (if your API supports it)
    });
  });

    describe('POST /quizzes/:quizId/attempt/:attemptId/submit', () => {
    it('should submit answers for an attempt with a real question from a question bank', async () => {
      // 1. Create course
      const courseRes = await request(app).post('/courses').send({
        name: 'Course for Attempt Submit Real',
        description: 'Course for attempt submit test (real question)',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;
  
      // 2. Create course version
      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for attempt submit test (real question)',
        });
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body._id;
  
      // 3. Create module
      const moduleRes = await request(app)
        .post(`/courses/versions/${versionId}/modules`)
        .send({
          name: 'Module for Attempt Submit Real',
          description: 'Module for attempt submit test (real question)',
        });
      expect(moduleRes.status).toBe(201);
      const moduleId = moduleRes.body.version.modules[0].moduleId;
  
      // 4. Create section
      const sectionRes = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .send({
          name: 'Section for Attempt Submit Real',
          description: 'Section for attempt submit test (real question)',
        });
      expect(sectionRes.status).toBe(201);
      const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;
  
      // 5. Create a real question
      const questionData = {
        text: 'What is 3 + 3?',
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
        value: 6,
      };
      const questionRes = await request(app).post('/questions').send({
        question: questionData,
        solution,
      });
      expect(questionRes.status).toBe(201);
      const questionId = questionRes.body.questionId;
  
      // 6. Create question bank with the question
      const bankRes = await request(app).post('/question-bank').send({
        courseId,
        courseVersionId: versionId,
        questions: [questionId],
        title: 'Bank for Attempt Submit Real',
        description: 'Bank for attempt submit test (real question)',
      });
      expect(bankRes.status).toBe(200);
      const questionBankId = bankRes.body.questionBankId;
  
      // 7. Create quiz item referencing the question bank
      const itemPayload = {
        name: 'Quiz Item for Attempt Submit Real',
        description: 'Quiz item description',
        type: ItemType.QUIZ,
        quizDetails: {
          questionVisibility: 3,
          allowPartialGrading: true,
          deadline: faker.date.future(),
          allowHint: true,
          maxAttempts: 5,
          releaseTime: faker.date.future(),
          quizType: 'DEADLINE',
          showCorrectAnswersAfterSubmission: true,
          showExplanationAfterSubmission: true,
          showScoreAfterSubmission: true,
          approximateTimeToComplete: '00:30:00',
          passThreshold: 0.7,
        },
      };
  
      const itemRes = await request(app)
        .post(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`
        )
        .send(itemPayload);
      expect(itemRes.status).toBe(201);
      const quizId = itemRes.body.createdItem._id;

      // Add question bank to quiz item
      const updateQuizRes = await request(app).post(`/quiz/${quizId}/bank`).send({
        bankId: questionBankId,
        count: 1,
      });
      expect(updateQuizRes.status).toBe(201);

      // 8. Create attempt
      const attemptRes = await request(app)
        .post(`/quizzes/${quizId}/attempt`)
        .send();
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;
  
      // 9. Submit answers for the real question
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: { value: 6 },
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      console.log(submitRes.body);
      expect(submitRes.body).toHaveProperty('totalScore');
      expect(submitRes.body.totalScore).toBeGreaterThanOrEqual(0);
    });
  });
});