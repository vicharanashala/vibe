import 'reflect-metadata';
import Express from 'express';
import { RoutingControllersOptions, useContainer, useExpressServer } from 'routing-controllers';
import { faker } from '@faker-js/faker';
import { MailService, notificationsContainerModule, notificationsModuleOptions } from '../index.js';
import { describe, it, expect, beforeAll, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { InviteBody } from '../classes/validators/InviteValidators.js';
import { createCourse, createVersion } from '#root/modules/courses/tests/utils/creationFunctions.js';
import { coursesModuleControllers } from '#root/modules/courses/index.js';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { coursesContainerModule } from '#root/modules/courses/container.js';
import { usersContainerModule } from '#root/modules/users/container.js';
import { Container, ContainerModule } from 'inversify';
import { SignUpBody } from '#root/modules/auth/classes/validators/AuthValidators.js';
import { authContainerModule } from '#root/modules/auth/container.js';
import { authModuleControllers } from '#root/modules/auth/index.js';
import { usersModuleControllers } from '#root/modules/users/index.js';

const notificationsContainerModules: ContainerModule[] = [
  notificationsContainerModule,
  sharedContainerModule,
  usersContainerModule,
  coursesContainerModule,
  authContainerModule
];

describe('InviteController', () => {
  let app: any;
  let courseId: string;
  let version: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(...notificationsContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    app = Express();
    const options: RoutingControllersOptions = {
      controllers: [...(notificationsModuleOptions.controllers as Function[]), ...(coursesModuleControllers as Function[]), ...(authModuleControllers as Function[]), ...(usersModuleControllers as Function[])],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
    };
    useExpressServer(app, options);
  }, 900000);

  beforeEach(async () => {
    vi.spyOn(MailService.prototype, 'sendMail').mockResolvedValue({
      accepted: [faker.internet.email(), faker.internet.email(), faker.internet.email()],
      rejected: [],
      envelope: {},
      messageId: 'mocked-message-id',
      response: '250 OK: message queued',
    });
    const course = await createCourse(app);
    courseId = course._id.toString();
    version = await createVersion(app, courseId);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
  
  // Helper to create valid invite body
  function createInviteBody(email?: string, role?: any): InviteBody {
    return {
      inviteData: [
        {
          email: email || faker.internet.email(),
          role: role || 'STUDENT',
        },
      ],
    };
  }
  async function createInvite(email?: string, role?: any): Promise<any> {
    const body = createInviteBody(email, role);
    const res = await request(app)
      .post(`/notifications/invite/courses/${courseId}/versions/${version._id.toString()}`)
      .send(body);
    return res;
  }

  describe('POST /notifications/invite/courses/:courseId/versions/:courseVersionId', () => {
    it('invites users with valid email and role', async () => {
      const res = await createInvite();
      expect(res.status).toBe(200);
      expect(res.body.invites).toBeInstanceOf(Array);
      expect(res.body.invites[0]).toHaveProperty('email');
      expect(res.body.invites[0]).toHaveProperty('inviteStatus');
    });
    
    it('returns "ALREADY_ENROLLED" when user is already enrolled in the course', async () => {
      const email = faker.internet.email();
      const signUpBody: SignUpBody = {
        email: email,
        password: faker.internet.password(),
        firstName: faker.person.firstName('male').replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
      };
      const signUpResponse = await request(app)
      .post('/auth/signup/')
      .send(signUpBody);
      expect(signUpResponse.status).toBe(201);
      const userId = signUpResponse.body.userId;
      const enrollmentResponse = await request(app)
        .post(
          `/users/${userId}/enrollments/courses/${courseId}/versions/${version._id.toString()}`,
        )
        .send({
          role: 'STUDENT',
        });
      expect(enrollmentResponse.status).toBe(200);
      const res = await createInvite(email);
      expect(res.status).toBe(200);
      expect(res.body.invites[0].inviteStatus).toBe('ALREADY_ENROLLED');
    });
    
    it('fails because of invalid email', async () => {
      const body = createInviteBody('not-an-email');
      const res = await request(app)
        .post(`/notifications/invite/courses/${courseId}/versions/${version._id.toString()}`)
        .send(body);
      expect(res.status).toBe(400);
    });

    it('fails because of missing inviteData', async () => {
      const res = await request(app)
        .post(`/notifications/invite/courses/${courseId}/versions/${version._id.toString()}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /notifications/invite/courses/:courseId/versions/:courseVersionId', () => {
    it('fetches all invites for a specific course version', async () => {
      const res = await request(app)
        .get(`/notifications/invite/courses/${courseId}/versions/${version._id.toString()}`);
      expect(res.status).toBe(200);
      expect(res.body.invites).toBeInstanceOf(Array);
    });
  });

  describe('GET /notifications/invite/:inviteId', () => {
    it('accepts invite for unregistered user and links it after signup', async () => {
      // You may need to create an invite first and get its ID
      const email = faker.internet.email();
      const inviteResponse = await createInvite(email);
      const inviteId = inviteResponse.body.invites[0].inviteId;
      const res = await request(app).get(`/notifications/invite/${inviteId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Your invite acceptance has been acknowledged. Please sign up to access the course.');
      // send again
      const resendRes = await request(app).get(`/notifications/invite/${inviteId}`);
      expect(resendRes.body.message).toBe('You have already accepted this invite.');
      // now create a user
      const signUpBody: SignUpBody = {
        email: email,
        password: faker.internet.password(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };
      const signUpResponse = await request(app)
        .post('/auth/signup/')
        .send(signUpBody);
      expect(signUpResponse.status).toBe(201);
      expect(signUpResponse.body.invites[0].inviteId).toBe(inviteId);
      expect(signUpResponse.body.invites[0].inviteStatus).toBe('ACCEPTED');
    });

    it('enrolls registered user via invite, fails if tried to accept again and then fetch user enrollemnts for verification', async () => {
      // You may need to create an invite first and get its ID
      const email = faker.internet.email();
      const signUpBody: SignUpBody = {
        email: email,
        password: faker.internet.password(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };
      const signUpResponse = await request(app)
        .post('/auth/signup/')
        .send(signUpBody);
      expect(signUpResponse.status).toBe(201);
      const inviteResponse = await createInvite(email, 'INSTRUCTOR');
      const inviteId = inviteResponse.body.invites[0].inviteId;
      const res = await request(app).get(`/notifications/invite/${inviteId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('You have been successfully enrolled in the course as INSTRUCTOR.');
      // send again
      const resendRes = await request(app).get(`/notifications/invite/${inviteId}`);
      expect(resendRes.body.message).toBe('You have already accepted this invite.');
      // check if user is enrolled
      const userId = signUpResponse.body.userId;
      const getEnrollmentsResponse = await request(app).get(
        `/users/${userId}/enrollments?page=1&limit=1`,
      );
      expect(getEnrollmentsResponse.status).toBe(200);
      expect(getEnrollmentsResponse.body.enrollments).toBeInstanceOf(Array);
      expect(getEnrollmentsResponse.body.enrollments[0].courseId).toBe(courseId);
      expect(getEnrollmentsResponse.body.enrollments[0].role).toBe('INSTRUCTOR');
    });

    it('returns 400 for malformed or invalid inviteId', async () => {
      const res = await request(app).get('/notifications/invite/invalid-id');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /notifications/invite/resend/:inviteId', () => {
    it('takes invite id and resends invite email to user', async () => {
      const inviteResponse = await createInvite();
      const inviteId = inviteResponse.body.invites[0].inviteId;
      const res = await request(app).post(`/notifications/invite/resend/${inviteId}`);
      expect(res.status).toBe(200);
    });

    it('fails to resend because of invalid inviteId', async () => {
      const res = await request(app).post('/notifications/invite/resend/invalid-id');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /notifications/invite/cancel/:inviteId', () => {
    it('cancels invite and fails if tried to accept later', async () => {
      const inviteResponse = await createInvite();
      const inviteId = inviteResponse.body.invites[0].inviteId;
      const res = await request(app).post(`/notifications/invite/cancel/${inviteId}`);
      expect(res.status).toBe(200);
      const res2 = await request(app).get(`/notifications/invite/${inviteId}`);
      expect(res2.body.message).toBe('This invite has been cancelled.');
    });

    it('returns 400 when cancelling with invalid inviteId', async () => {
      const res = await request(app).post('/notifications/invite/cancel/invalid-id');
      expect(res.status).toBe(400);
    });
  });

  it('send multiple invite to users, after user accepts one invite, it should throw an error when user tries to accept another invite for the same course', async () => {
    const email = faker.internet.email();
      const signUpBody: SignUpBody = {
        email: email,
        password: faker.internet.password(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };
      const signUpResponse = await request(app)
        .post('/auth/signup/')
        .send(signUpBody);
      expect(signUpResponse.status).toBe(201);
      const inviteResponse1 = await createInvite(email, 'STUDENT');
      const inviteId1 = inviteResponse1.body.invites[0].inviteId;
      const inviteResponse2 = await createInvite(email, 'STUDENT');
      const inviteId2 = inviteResponse2.body.invites[0].inviteId;
      const res = await request(app).get(`/notifications/invite/${inviteId1}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('You have been successfully enrolled in the course as STUDENT.');
      // send on inviteId2
      const resendRes = await request(app).get(`/notifications/invite/${inviteId2}`);
      expect(resendRes.body.message).toBe('You are already enrolled in this course.');
  });
});