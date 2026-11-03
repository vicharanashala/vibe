import request from 'supertest';
import Express from 'express';
import {describe, it, expect, beforeAll, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {Container} from 'inversify';
import {useContainer, useExpressServer} from 'routing-controllers';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {sharedContainerModule} from '#root/container.js';
import {usersContainerModule} from '../container.js';
import {usersModuleOptions} from '../index.js';
import {coursesContainerModule} from '#root/modules/courses/container.js';
import {quizzesContainerModule} from '#root/modules/quizzes/container.js';
import {projectsContainerModule} from '#root/modules/projects/container.js';
import {authContainerModule} from '#root/modules/auth/container.js';
import {notificationsContainerModule} from '#root/modules/notifications/container.js';
import {anomaliesContainerModule} from '#root/modules/anomalies/container.js';
import {settingContainerModule} from '#root/modules/setting/container.js';
import {courseRegistrationContainerModule} from '#root/modules/courseRegistration/container.js';
import {reportsContainerModule} from '#root/modules/reports/container.js';
import {hpSystemContainerModule} from '#root/modules/hpSystem/container.js';
import {ejectionPolicyContainerModule} from '#root/modules/ejectionPolicy/container.js';
import {emotionsContainerModule} from '#root/modules/emotions/container.js';
import {genAIContainerModule} from '#root/modules/genAI/container.js';
import {studentQuestionsContainerModule} from '#root/modules/studentQuestions/container.js';
import {announcementsContainerModule} from '#root/modules/announcements/container.js';
import {auditTrailsContainerModule} from '#root/modules/auditTrails/container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';

/**
 * Route-level checks for the two rewatch endpoints: request validation, the
 * same enrollment-bound permission as the start-item route, and that a learner
 * can only update their own rewatch record.
 *
 * The bearer token stands in for the user id, so each request chooses who is
 * calling.
 */

describe('Progress Controller rewatch routes', {timeout: 90000}, () => {
  let app: Express.Express;
  let db: MongoDatabase;

  const learnerId = new ObjectId();
  const outsiderId = new ObjectId();
  const courseId = new ObjectId();
  const courseVersionId = new ObjectId();
  const completedItemId = new ObjectId();
  const openItemId = new ObjectId();

  const startUrl = `/users/progress/courses/${courseId}/versions/${courseVersionId}/rewatch/start`;
  const heartbeatUrl = '/users/rewatch/heartbeat';
  const as = (userId: ObjectId) => `Bearer ${userId.toString()}`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
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
    useContainer(new InversifyAdapter(container));
    db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    app = useExpressServer(Express(), {
      controllers: usersModuleOptions.controllers as Function[],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
    });

    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockImplementation(
      async (token: string) => ({_id: token, roles: 'user'}) as any,
    );

    // Only the learner is enrolled; the outsider has no enrollment at all.
    const enrollment = await db.getCollection('enrollment');
    await enrollment.insertOne({
      userId: learnerId,
      courseId,
      courseVersionId,
      role: 'STUDENT',
      status: 'ACTIVE',
      enrollmentDate: new Date(),
      isDeleted: false,
    } as any);

    const watchTime = await db.getCollection('watchTime');
    const startTime = new Date(Date.now() - 10 * 60 * 1000);
    await watchTime.insertMany([
      {
        userId: learnerId,
        courseId,
        courseVersionId,
        itemId: completedItemId,
        startTime,
        endTime: new Date(startTime.getTime() + 5 * 60 * 1000),
        isDeleted: false,
      },
      {
        userId: learnerId,
        courseId,
        courseVersionId,
        itemId: openItemId,
        startTime,
        isDeleted: false,
      },
    ] as any[]);
  });

  it('starts a rewatch of a completed item and accepts heartbeats on it', async () => {
    const quizId = new ObjectId().toString();
    const attemptId = new ObjectId().toString();
    const attempts = await db.getCollection('quiz_attempts');
    await attempts.insertOne({
      _id: new ObjectId(attemptId),
      userId: learnerId,
      quizId: new ObjectId(quizId),
      questionDetails: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const start = await request(app)
      .post(startUrl)
      .set('Authorization', as(learnerId))
      .send({itemId: completedItemId.toString(), quizId, attemptId})
      .expect(200);

    const {rewatchId} = start.body;
    expect(ObjectId.isValid(rewatchId)).toBe(true);

    await request(app)
      .post(heartbeatUrl)
      .set('Authorization', as(learnerId))
      .send({rewatchId})
      .expect(200);

    const closing = await request(app)
      .post(heartbeatUrl)
      .set('Authorization', as(learnerId))
      .send({rewatchId, ended: true})
      .expect(200);
    expect(closing.body.rewatchId).toBe(rewatchId);

    const rewatchTime = await db.getCollection('rewatchTime');
    const record = await rewatchTime.findOne({_id: new ObjectId(rewatchId)});
    expect(record?.heartbeatCount).toBe(1);
    expect(record?.endTime).toBeInstanceOf(Date);
    expect(record?.quizId?.toString()).toBe(quizId);
    expect(record?.attemptId?.toString()).toBe(attemptId);
  });

  it('returns an empty rewatchId for an item that is not completed', async () => {
    const start = await request(app)
      .post(startUrl)
      .set('Authorization', as(learnerId))
      .send({itemId: openItemId.toString()})
      .expect(200);

    expect(start.body.rewatchId).toBe('');
  });

  it('refuses a learner who is not enrolled in the course version', async () => {
    await request(app)
      .post(startUrl)
      .set('Authorization', as(outsiderId))
      .send({itemId: completedItemId.toString()})
      .expect(403);
  });

  it("returns 404 for a heartbeat on another learner's rewatch record", async () => {
    const start = await request(app)
      .post(startUrl)
      .set('Authorization', as(learnerId))
      .send({itemId: completedItemId.toString()})
      .expect(200);

    await request(app)
      .post(heartbeatUrl)
      .set('Authorization', as(outsiderId))
      .send({rewatchId: start.body.rewatchId})
      .expect(404);
  });

  it('rejects malformed ids', async () => {
    await request(app)
      .post(startUrl)
      .set('Authorization', as(learnerId))
      .send({itemId: 'not-an-id'})
      .expect(400);

    await request(app)
      .post(heartbeatUrl)
      .set('Authorization', as(learnerId))
      .send({rewatchId: 'not-an-id'})
      .expect(400);
  });
});
