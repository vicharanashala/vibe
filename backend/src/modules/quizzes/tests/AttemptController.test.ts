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
    it('should save answers for an attempt', async () => {
      // Create course
      const courseRes = await request(app).post('/courses').send({
        name: 'Course for Attempt Save',
        description: 'Course for attempt save test',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      // Create course version
      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for attempt save test',
        });
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body._id;

      // Create module
      const moduleRes = await request(app)
        .post(`/courses/versions/${versionId}/modules`)
        .send({
          name: 'Module for Attempt Save',
          description: 'Module for attempt save test',
        });
      expect(moduleRes.status).toBe(201);
      const moduleId = moduleRes.body.version.modules[0].moduleId;

      // Create section
      const sectionRes = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .send({
          name: 'Section for Attempt Save',
          description: 'Section for attempt save test',
        });
      expect(sectionRes.status).toBe(201);
      const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

      // Create quiz item
      const itemPayload = {
        name: 'Quiz Item for Attempt Save',
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
      const quizId = itemRes.body.itemsGroup.items[0].quizDetails.quizId || itemRes.body.itemsGroup.items[0].quizId;

      // Create attempt
      const attemptRes = await request(app)
        .post(`/quizzes/${quizId}/attempt`)
        .send();
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;

      // Save answers (simulate at least one question)
      const saveRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/save`)
        .send({
          answers: [
            {
              questionId: faker.database.mongodbObjectId(),
              answer: 'Correct',
            },
          ],
        });
      expect(saveRes.status).toBe(200);
    });
  });

  describe('POST /quizzes/:quizId/attempt/:attemptId/submit', () => {
    it('should submit answers for an attempt', async () => {
      // Create course
      const courseRes = await request(app).post('/courses').send({
        name: 'Course for Attempt Submit',
        description: 'Course for attempt submit test',
      });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      // Create course version
      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .send({
          version: 'v1',
          description: 'Version for attempt submit test',
        });
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body._id;

      // Create module
      const moduleRes = await request(app)
        .post(`/courses/versions/${versionId}/modules`)
        .send({
          name: 'Module for Attempt Submit',
          description: 'Module for attempt submit test',
        });
      expect(moduleRes.status).toBe(201);
      const moduleId = moduleRes.body.version.modules[0].moduleId;

      // Create section
      const sectionRes = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .send({
          name: 'Section for Attempt Submit',
          description: 'Section for attempt submit test',
        });
      expect(sectionRes.status).toBe(201);
      const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

      // Create quiz item
      const itemPayload = {
        name: 'Quiz Item for Attempt Submit',
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
      const quizId = itemRes.body.itemsGroup.items[0].quizDetails.quizId || itemRes.body.itemsGroup.items[0].quizId;

      // Create attempt
      const attemptRes = await request(app)
        .post(`/quizzes/${quizId}/attempt`)
        .send();
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;

      // Submit answers (simulate at least one question)
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId: faker.database.mongodbObjectId(),
              answer: 'Correct',
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      expect(submitRes.body).toHaveProperty('score');
    });
  });
});
