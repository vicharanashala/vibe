import Express from 'express';
import {
  RoutingControllersOptions,
  useContainer,
  useExpressServer,
} from 'routing-controllers';
import { sharedContainerModule } from '#root/container.js';
import { quizzesContainerModule } from '../container.js';
import { coursesContainerModule } from '#courses/container.js';
import { usersContainerModule } from '#users/container.js';
import { authContainerModule } from '#auth/container.js';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import request from 'supertest';
import { quizzesModuleOptions } from '../index.js';
import { coursesModuleOptions } from '#courses/index.js';
import { authModuleOptions } from '#auth/index.js';
import { faker } from '@faker-js/faker';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { ItemType } from '#root/shared/interfaces/models.js';
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
import { FirebaseAuthService } from '#root/modules/auth/services/FirebaseAuthService.js';
import { notificationsContainerModule } from '#root/modules/notifications/container.js';

describe('AttemptController', async () => {
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
      authContainerModule,
      notificationsContainerModule
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
          ? {
            _id: userId,
            email: 'attempt_test_user@example.com',
            name: 'Attempt Test User',
          }
          : null;
      },
    };
    app = useExpressServer(appInstance, options);
    const signUpBody = {
      email: faker.internet.email(),
      password: 'TestPassword123!',
      firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
      lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
    };
    const signupRes = await request(app).post('/auth/signup').send(signUpBody);
    expect(signupRes.status).toBe(201);
    userId = signupRes.body.userId;
    expect(userId).toBeTruthy();
    vi.spyOn(FirebaseAuthService.prototype, 'getUserIdFromReq').mockResolvedValue(userId);
  }, 900000);

  describe('POST /quizzes/:quizId/attempt', () => {
    it('should create an attempt for a quiz', { timeout: 30000 }, async () => {
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
      const sectionId =
        sectionRes.body.version.modules[0].sections[0].sectionId;

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
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .send(itemPayload);
      expect(itemRes.status).toBe(201);
      const quizId = itemRes.body.createdItem._id;

      // Create attempt
      const res = await request(app).post(`/quizzes/${quizId}/attempt`).send();
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('attemptId');
    });
  });

  describe('POST /quizzes/:quizId/attempt/:attemptId/save', () => {
    it('should save and retrieve answers for an attempt with a question from a question bank', { timeout: 30000 }, async () => {
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
          description: 'Version for attempt save test',
        });
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body._id;

      // 3. Create module
      const moduleRes = await request(app)
        .post(`/courses/versions/${versionId}/modules`)
        .send({
          name: 'Module for Attempt Save Real',
          description: 'Module for attempt save test',
        });
      expect(moduleRes.status).toBe(201);
      const moduleId = moduleRes.body.version.modules[0].moduleId;

      // 4. Create section
      const sectionRes = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .send({
          name: 'Section for Attempt Save Real',
          description: 'Section for attempt save test',
        });
      expect(sectionRes.status).toBe(201);
      const sectionId =
        sectionRes.body.version.modules[0].sections[0].sectionId;

      const questionRes = await request(app).post('/quizzes/questions').send({
        question: NATquestionData,
        solution: NATsolution,
      });
      expect(questionRes.status).toBe(201);
      const questionId = questionRes.body.questionId;

      // 6. Create question bank with the question
      const bankRes = await request(app)
        .post('/quizzes/question-bank')
        .send({
          courseId,
          courseVersionId: versionId,
          questions: [questionId],
          title: 'Bank for Attempt Save Real',
          description: 'Bank for attempt save test',
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
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
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

      // 9. Save answers for the question
      const saveRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/save`)
        .send({
          answers: [
            {
              questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: { value: 4 },
            },
          ],
        });
      expect(saveRes.status).toBe(200);

      // 10. Retrieve the attempt to check saved answers
      const getAttemptRes = await request(app).get(
        `/quizzes/${quizId}/attempt/${attemptId}`,
      );
      expect(getAttemptRes.status).toBe(200);
      expect(getAttemptRes.body).toHaveProperty('answers');
    });
  });

  describe('POST /quizzes/:quizId/attempt/:attemptId/submit', () => {
    it('should submit answers for an attempt with a real question from a question bank', { timeout: 30000 }, async () => {
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
      const sectionId =
        sectionRes.body.version.modules[0].sections[0].sectionId;

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
      const questionRes = await request(app).post('/quizzes/questions').send({
        question: questionData,
        solution,
      });
      expect(questionRes.status).toBe(201);
      const questionId = questionRes.body.questionId;

      // 6. Create question bank with the question
      const bankRes = await request(app)
        .post('/quizzes/question-bank')
        .send({
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
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .send(itemPayload);
      expect(itemRes.status).toBe(201);
      const quizId = itemRes.body.createdItem._id;

      // Add question bank to quiz item
      const updateQuizRes = await request(app)
        .post(`/quizzes/quiz/${quizId}/bank`)
        .send({
          bankId: questionBankId,
          count: 1,
        });
      expect(updateQuizRes.status).toBe(200);

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

  describe('POST /quizzes/:quizId/attempt/:attemptId/submit', () => {
    it('should submit answers for all question types in a single quiz', { timeout: 30000 }, async () => {
      // 1. Create course
      const courseRes = await request(app).post('/courses').send({
        name: 'Course for Multi-Type Submit',
        description: 'Course for multi-type question submit test',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      // 2. Create course version
      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for multi-type submit test',
        });
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body._id;

      // 3. Create module
      const moduleRes = await request(app)
        .post(`/courses/versions/${versionId}/modules`)
        .send({
          name: 'Module for Multi-Type Submit',
          description: 'Module for multi-type submit test',
        });
      expect(moduleRes.status).toBe(201);
      const moduleId = moduleRes.body.version.modules[0].moduleId;

      // 4. Create section
      const sectionRes = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .send({
          name: 'Section for Multi-Type Submit',
          description: 'Section for multi-type submit test',
        });
      expect(sectionRes.status).toBe(201);
      const sectionId =
        sectionRes.body.version.modules[0].sections[0].sectionId;

      // 5. Create questions of each type
      const natRes = await request(app)
        .post('/quizzes/questions')
        .send({ question: NATquestionData, solution: NATsolution });
      expect(natRes.status).toBe(201);
      const natId = natRes.body.questionId;

      const solRes = await request(app)
        .post('/quizzes/questions')
        .send({ question: SOLquestionData, solution: SOLsolution });
      expect(solRes.status).toBe(201);
      const solId = solRes.body.questionId;

      const smlRes = await request(app)
        .post('/quizzes/questions')
        .send({ question: SMLquestionData, solution: SMLsolution });
      expect(smlRes.status).toBe(201);
      const smlId = smlRes.body.questionId;

      const otlRes = await request(app)
        .post('/quizzes/questions')
        .send({ question: OTLquestionData, solution: OTLsolution });
      expect(otlRes.status).toBe(201);
      const otlId = otlRes.body.questionId;

      const desRes = await request(app)
        .post('/quizzes/questions')
        .send({ question: DESquestionData, solution: DESsolution });
      expect(desRes.status).toBe(201);
      const desId = desRes.body.questionId;

      // 6. Create only two question banks
      const mainBankRes = await request(app)
        .post('/quizzes/question-bank')
        .send({
          courseId,
          courseVersionId: versionId,
          questions: [natId, solId, smlId, otlId],
          title: 'Main Bank',
          description: 'Bank for all types except DESCRIPTIVE',
        });
      expect(mainBankRes.status).toBe(200);
      const mainBankId = mainBankRes.body.questionBankId;

      const desBankRes = await request(app)
        .post('/quizzes/question-bank')
        .send({
          courseId,
          courseVersionId: versionId,
          questions: [desId],
          title: 'DES Bank',
          description: 'Bank for DESCRIPTIVE',
        });
      expect(desBankRes.status).toBe(200);
      const desBankId = desBankRes.body.questionBankId;

      // 7. Create quiz item (do NOT include questionBankIds here)
      const itemPayload = {
        name: 'Quiz Item for All Types',
        description: 'Quiz item with all types',
        type: ItemType.QUIZ,
        quizDetails: {
          questionVisibility: 5,
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
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .send(itemPayload);
      expect(itemRes.status).toBe(201);
      const quizId = itemRes.body.createdItem._id;

      // Add only the two banks to the quiz

      const updateQuizRes = await request(app)
        .post(`/quizzes/quiz/${quizId}/bank`)
        .send({ bankId: mainBankId, count: 4 });
      expect(updateQuizRes.status).toBe(200);
      const updateDesQuizRes = await request(app)
        .post(`/quizzes/quiz/${quizId}/bank`)
        .send({ bankId: desBankId, count: 1 });
      expect(updateDesQuizRes.status).toBe(200);

      // 8. Create attempt
      const attemptRes = await request(app)
        .post(`/quizzes/${quizId}/attempt`)
        .send();
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;

      const solDetails = await request(app).get(`/quizzes/questions/${solId}`);
      const smlDetails = await request(app).get(`/quizzes/questions/${smlId}`);
      const otlDetails = await request(app).get(`/quizzes/questions/${otlId}`);

      // For SOL (SELECT_ONE_IN_LOT)
      // Only the correct lot item will have the value of 'name' in its text
      const solNameValue = solDetails.body.parameterMap.name;
      const solCorrectLotItem = solDetails.body.lotItems.find((item: any) =>
        item.text.includes(solNameValue),
      );
      const solCorrectLotItemId = solCorrectLotItem?._id;

      // For SML (SELECT_MANY_IN_LOT)
      // Find lotItems whose text or explaination contains any correct parameter value
      const smlParamValues = [
        ...Object.values(
          smlDetails.body.parameterMap.animal
            ? { animal: smlDetails.body.parameterMap.animal }
            : {},
        ),
        ...Object.values(
          smlDetails.body.parameterMap.color
            ? { color: smlDetails.body.parameterMap.color }
            : {},
        ),
      ];
      const smlCorrectLotItemIds = smlDetails.body.lotItems
        .filter((item: any) =>
          smlParamValues.some(val => item.text.includes(val)),
        )
        .map((item: any) => item._id);

      // For OTL (ORDER_THE_LOTS)
      // Map step numbers to parameter values from parameterMap
      const otlStepMap = {
        1: otlDetails.body.parameterMap.step1,
        2: otlDetails.body.parameterMap.step2,
        3: otlDetails.body.parameterMap.step3,
        4: otlDetails.body.parameterMap.step4,
        5: otlDetails.body.parameterMap.step5,
      };

      // For each step, find the lotItem whose text matches the step and parameter value
      const otlOrders = Object.entries(otlStepMap).map(
        ([stepNum, stepValue]) => {
          const lotItem = otlDetails.body.lotItems.find(
            (item: any) =>
              item.text.includes(`Step ${stepNum}:`) &&
              item.text.includes(stepValue),
          );
          return {
            order: Number(stepNum),
            lotItemId: lotItem?._id,
          };
        },
      );

      // 9. Submit answers for all questions
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            // NUMERIC_ANSWER_TYPE
            {
              questionId: natId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: { value: 9 },
            },
            // SELECT_ONE_IN_LOT
            {
              questionId: solId,
              questionType: 'SELECT_ONE_IN_LOT',
              answer: { lotItemId: solCorrectLotItemId },
            },
            // SELECT_MANY_IN_LOT
            {
              questionId: smlId,
              questionType: 'SELECT_MANY_IN_LOT',
              answer: { lotItemIds: smlCorrectLotItemIds },
            },
            // ORDER_THE_LOTS
            {
              questionId: otlId,
              questionType: 'ORDER_THE_LOTS',
              answer: { orders: otlOrders },
            },
            // DESCRIPTIVE
            {
              questionId: desId,
              questionType: 'DESCRIPTIVE',
              answer: { answerText: 'Compiling is the process...' },
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      expect(submitRes.body).toHaveProperty('totalScore');
      expect(submitRes.body.totalScore).toBeGreaterThanOrEqual(0);
      console.log('Submit response:', submitRes.body);
    });
  });
});
