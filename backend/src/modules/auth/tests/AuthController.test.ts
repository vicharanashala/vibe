import 'reflect-metadata';
import request from 'supertest';
import Express from 'express';
import {useExpressServer, useContainer} from 'routing-controllers';
import {Container} from 'inversify';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {faker} from '@faker-js/faker';
import {SignUpBody} from '#auth/classes/validators/AuthValidators.js';
import {authContainerModule} from '#auth/container.js';
import {sharedContainerModule} from '#root/container.js';
import {usersContainerModule} from '#root/modules/users/container.js';
import {coursesContainerModule} from '#root/modules/courses/container.js';
import {quizzesContainerModule} from '#root/modules/quizzes/container.js';
import {notificationsContainerModule} from '#root/modules/notifications/container.js';
import {anomaliesContainerModule} from '#root/modules/anomalies/container.js';
import {settingContainerModule} from '#root/modules/setting/container.js';
import {courseRegistrationContainerModule} from '#root/modules/courseRegistration/container.js';
import {projectsContainerModule} from '#root/modules/projects/container.js';
import {reportsContainerModule} from '#root/modules/reports/container.js';
import {hpSystemContainerModule} from '#root/modules/hpSystem/container.js';
import {ejectionPolicyContainerModule} from '#root/modules/ejectionPolicy/container.js';
import {emotionsContainerModule} from '#root/modules/emotions/container.js';
import {genAIContainerModule} from '#root/modules/genAI/container.js';
import {studentQuestionsContainerModule} from '#root/modules/studentQuestions/container.js';
import {announcementsContainerModule} from '#root/modules/announcements/container.js';
import {auditTrailsContainerModule} from '#root/modules/auditTrails/container.js';
import {describe, it, expect, beforeAll, beforeEach} from 'vitest';
import {HttpErrorHandler} from '#shared/index.js';
import {AuthController} from '../controllers/AuthController.js';

describe('Auth Controller Integration Tests', () => {
  const appInstance = Express();
  let app;

  beforeAll(async () => {
    const container = new Container();
    await container.load(
      sharedContainerModule,
      authContainerModule,
      usersContainerModule,
      coursesContainerModule,
      quizzesContainerModule,
      notificationsContainerModule,
      anomaliesContainerModule,
      settingContainerModule,
      courseRegistrationContainerModule,
      projectsContainerModule,
      reportsContainerModule,
      hpSystemContainerModule,
      ejectionPolicyContainerModule,
      emotionsContainerModule,
      genAIContainerModule,
      studentQuestionsContainerModule,
      announcementsContainerModule,
      auditTrailsContainerModule,
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();
    app = useExpressServer(appInstance, {
      controllers: [AuthController],
      validation: true,
      defaultErrorHandler: false,
      middlewares: [HttpErrorHandler],
    });
  }, 30000);

  describe('Sign Up Test', () => {
    it('should sign up a new user successfully', async () => {
      const signUpBody: SignUpBody = {
        email: faker.internet.email(),
        password: faker.internet.password(),
        firstName: faker.person.firstName('male').replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
        recaptchaToken: 'mock-token',
      };
      const response = await request(app)
        .post('/auth/signup/')
        .send(signUpBody);
      expect(response.status).toBe(201);
    }, 30000); // <-- timeout for this test

    it('should return 400 for invalid email', async () => {
      const signUpBody: SignUpBody = {
        email: 'invalid-email',
        password: faker.internet.password(),
        firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
        recaptchaToken: 'mock-token',
      };
      const response = await request(app)
        .post('/auth/signup/')
        .send(signUpBody);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0].constraints.isEmail).toBeDefined();
      expect(response.body.errors[0].constraints.isEmail).toBe(
        'email must be an email',
      );
    }, 30000);

    it('should return 400 for missing required fields', async () => {
      const signUpBody: SignUpBody = {
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        recaptchaToken: '',
      };
      const response = await request(app)
        .post('/auth/signup/')
        .send(signUpBody);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    }, 30000);

    it('should return 400 for weak password', async () => {
      const signUpBody: SignUpBody = {
        email: faker.internet.email(),
        password: '123',
        firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
        recaptchaToken: 'mock-token',
      };
      const response = await request(app)
        .post('/auth/signup/')
        .send(signUpBody);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    }, 30000);
  });
});
