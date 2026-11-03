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
import { usersModuleOptions } from '#users/index.js';
import { faker } from '@faker-js/faker';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { FirebaseAuthService } from '#root/modules/auth/services/FirebaseAuthService.js';
import { notificationsContainerModule } from '#root/modules/notifications/container.js';
import { anomaliesContainerModule } from '#root/modules/anomalies/container.js';
import { settingContainerModule } from '#root/modules/setting/container.js';
import { courseRegistrationContainerModule } from '#root/modules/courseRegistration/container.js';
import { projectsContainerModule } from '#root/modules/projects/container.js';
import { reportsContainerModule } from '#root/modules/reports/container.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { hpSystemContainerModule } from '#root/modules/hpSystem/container.js';
import { ejectionPolicyContainerModule } from '#root/modules/ejectionPolicy/container.js';
import { emotionsContainerModule } from '#root/modules/emotions/container.js';
import { genAIContainerModule } from '#root/modules/genAI/container.js';
import { studentQuestionsContainerModule } from '#root/modules/studentQuestions/container.js';
import { announcementsContainerModule } from '#root/modules/announcements/container.js';
import { auditTrailsContainerModule } from '#root/modules/auditTrails/container.js';
import { UserRepository } from '#root/shared/database/providers/mongo/repositories/UserRepository.js';
import { ObjectId } from 'mongodb';

/**
 * End-to-end HTTP-level reproduction of the Guru Setu feedback-submission
 * bug (production 403 on "Gurusetu Pilot (FDP for Faculty)"), exercising
 * the real Express app, real DI-wired AttemptController -> AttemptService,
 * and a real MongoDB (mongodb-memory-server) -- not a mocked unit test.
 *
 * Only Firebase token verification is mocked (the established pattern in
 * this test suite), so the real @Ability decorator, real routing, and real
 * service logic all run exactly as they do against a live backend.
 */

const GURU_SETU_COURSE_ID = '6981df886e100cfe04f9c4ad';
const GURU_SETU_VERSION_ID = '6981df886e100cfe04f9c4ae';

describe('AttemptController POST /quizzes/:itemId/feedback/submit (Guru Setu, real HTTP)', async () => {
  const appInstance = Express();
  let app: any;
  let userId: string;
  let courseVersionId: string;
  let moduleId: string;
  let sectionId: string;
  let feedbackItemId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(
      sharedContainerModule,
      quizzesContainerModule,
      coursesContainerModule,
      usersContainerModule,
      authContainerModule,
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

    const options: RoutingControllersOptions = {
      controllers: [
        ...(quizzesModuleOptions.controllers as Function[]),
        ...(coursesModuleOptions.controllers as Function[]),
        ...(authModuleOptions.controllers as Function[]),
        ...(usersModuleOptions.controllers as Function[]),
      ],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
      currentUserChecker: async () => {
        return userId
          ? { _id: userId, email: 'gurusetu_gate_test@example.com', name: 'Test Student' }
          : null;
      },
    };
    app = useExpressServer(appInstance, options);

    // Real user, created directly through the repository -- /auth/signup
    // hits real Firebase Admin, unavailable in this test environment (same
    // constraint documented elsewhere in this repo's tests).
    const userRepo = container.get<UserRepository>(GLOBAL_TYPES.UserRepo);
    userId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      firstName: 'Test',
      lastName: 'Student',
      // Admin: course creation (setup only) requires it -- not a role tier,
      // this platform makes it admin-only regardless of instructor status.
      // The feedback-submit calls under test don't check role at all.
      roles: 'admin',
    } as any);

    // @Ability() verifies the bearer token itself via getCurrentUserFromToken
    // -- mock it so 'Bearer test-token' resolves to this same user, same
    // pattern already established in AttemptController.test.ts.
    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockResolvedValue({
      _id: userId,
      email: 'gurusetu_gate_test@example.com',
      roles: 'admin',
    } as any);

    // Real course + version + module + section + a VIDEO item followed by a
    // FEEDBACK item, created through the real HTTP endpoints.
    const courseRes = await request(app)
      .post('/courses')
      .send({
        name: 'Guru Setu Gate Test Course',
        description: 'Reproduces the feedback video-watch gate bug',
        versionName: 'Version 1',
        versionDescription: 'Initial version',
      })
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    const courseId = courseRes.body._id;

    const versionRes = await request(app)
      .post(`/courses/${courseId}/versions`)
      .send({ version: '1.0', description: 'v1' })
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    courseVersionId = versionRes.body._id;

    // getCourseVersionStatus() 404s for any versionId with no matching
    // document, so the Guru Setu test case (which submits the real
    // production pilot's fixed version id in its request body) needs a
    // real document to exist under that exact _id too -- clone the version
    // just created, the same way the real pilot course's version genuinely
    // exists under GURU_SETU_VERSION_ID in production.
    const courseVersionCollection = await db.getCollection<any>(
      'newCourseVersion',
    );
    const realVersionDoc = await courseVersionCollection.findOne({
      _id: new ObjectId(courseVersionId),
    });
    await courseVersionCollection.insertOne({
      ...realVersionDoc,
      _id: new ObjectId(GURU_SETU_VERSION_ID),
    });

    // Module creation reads a courseSettings doc for this version (HP
    // system check); a real deployment always has one by this point, but a
    // fresh in-memory DB doesn't unless we seed it ourselves.
    const courseSettingsCollection = await db.getCollection<any>(
      'courseSettings',
    );
    await courseSettingsCollection.insertOne({
      courseVersionId: new ObjectId(courseVersionId),
      settings: {},
    });

    const moduleRes = await request(app)
      .post(`/courses/versions/${courseVersionId}/modules`)
      .send({ name: 'Module 1', description: 'Module 1' })
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    moduleId = moduleRes.body.version.modules[0].moduleId;

    const sectionRes = await request(app)
      .post(`/courses/versions/${courseVersionId}/modules/${moduleId}/sections`)
      .send({ name: 'Section 1', description: 'Section 1' })
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

    // VIDEO item -- deliberately never watched/stopped by this test, so no
    // watchTime completion record will exist for it.
    await request(app)
      .post(
        `/courses/versions/${courseVersionId}/modules/${moduleId}/sections/${sectionId}/items`,
      )
      .send({
        name: 'Unwatched Video',
        description: 'Unwatched Video',
        type: 'VIDEO',
        videoDetails: {
          URL: faker.internet.url(),
          startTime: '00:00:00',
          endTime: '00:00:40',
          points: 10,
        },
      })
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    // FEEDBACK item, immediately after the video.
    const feedbackItemRes = await request(app)
      .post(
        `/courses/versions/${courseVersionId}/modules/${moduleId}/sections/${sectionId}/items`,
      )
      .send({
        name: 'Feedback Form',
        description: 'Feedback Form',
        type: 'FEEDBACK',
        feedbackFormDetails: {
          jsonSchema: { type: 'object', properties: { rating: { type: 'number' } } },
          uiSchema: {},
        },
      })
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    const items = feedbackItemRes.body.itemsGroup.items;
    feedbackItemId = items[items.length - 1]._id;
  }, 900000);

  it('lets a Guru Setu student submit feedback with no watch-time record, over the real route', async () => {
    const res = await request(app)
      .post(`/quizzes/${feedbackItemId}/feedback/submit`)
      .send({
        details: { rating: 5 },
        courseId: GURU_SETU_COURSE_ID,
        courseVersionId: GURU_SETU_VERSION_ID,
        sectionId,
      })
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('successfully');
  });

  it('still 403s a normal course student with no watch-time record, over the real route', async () => {
    const res = await request(app)
      .post(`/quizzes/${feedbackItemId}/feedback/submit`)
      .send({
        details: { rating: 5 },
        courseId: '507f1f77bcf86cd799439011',
        courseVersionId: courseVersionId,
        sectionId,
      })
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body.message).toContain(
      'You must watch the previous video before submitting feedback.',
    );
  });
});
