import request from 'supertest';
import Express from 'express';
import {useContainer, useExpressServer} from 'routing-controllers';
import {authModuleOptions} from '#auth/index.js';
import {coursesModuleOptions} from '#courses/index.js';
import {usersModuleOptions} from '../index.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {setContainer} from '#root/bootstrap/loadModules.js';
import {Container} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {authContainerModule} from '#auth/container.js';
import {coursesContainerModule} from '#courses/container.js';
import {usersContainerModule} from '../container.js';
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
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {UserRepository} from '#shared/database/providers/mongo/repositories/UserRepository.js';
import {IWatchTime, ItemType} from '#shared/interfaces/models.js';
import {CreateItemBody} from '#courses/classes/validators/index.js';
import {Collection, ObjectId} from 'mongodb';
import {faker} from '@faker-js/faker';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {appConfig} from '#root/config/app.js';
import {describe, it, expect, beforeAll, beforeEach, afterEach, vi} from 'vitest';
import {createEnrollment} from './utils/createEnrollment.js';

/**
 * D-08 end-to-end regression: /jobs/recover-orphaned-watchtimes lets an
 * external scheduler (Cloud Scheduler) trigger the recovery sweep on
 * demand, since node-cron is an unreliable in-process timer on Cloud Run
 * (confirmed live earlier: it fired once, then never again). This test
 * drives the REAL HTTP route through the real DI container -- not just the
 * service method directly (see ProgressService.recoverOrphanedWatchTimes.
 * blogHeartbeat.test.ts for that) -- so it actually proves: the route is
 * wired into the app, ApiKeyAuthMiddleware genuinely guards it (no key /
 * wrong key both rejected), and a correct key reaches the real
 * ProgressService and produces a real database change.
 */
describe('JobsController POST /jobs/recover-orphaned-watchtimes (D-08)', {timeout: 90000}, () => {
  const appInstance = Express();
  let app;
  let userRepo: UserRepository;
  let watchTimeCollection: Collection<IWatchTime>;
  const testTokenUserId = faker.database.mongodbObjectId();
  const originalIntegrationConfig = {...appConfig.integration};
  const TEST_API_KEY = 'd08-test-key-' + faker.string.alphanumeric(8);

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
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    setContainer(container);
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    userRepo = container.get<UserRepository>(GLOBAL_TYPES.UserRepo);
    watchTimeCollection = await db.getCollection<IWatchTime>('watchTime');

    app = useExpressServer(appInstance, {
      controllers: [
        ...(usersModuleOptions.controllers as Function[]),
        ...(authModuleOptions.controllers as Function[]),
        ...(coursesModuleOptions.controllers as Function[]),
      ],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
    });

    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockImplementation(async (token: string): Promise<any> => {
      if (token === 'test-token') {
        return {_id: testTokenUserId, roles: 'admin'};
      }
      return {_id: faker.database.mongodbObjectId(), roles: 'user'};
    });
  });

  beforeEach(() => {
    appConfig.integration.apiKey = TEST_API_KEY;
    appConfig.integration.apiKeys = undefined;
  });

  afterEach(() => {
    Object.assign(appConfig.integration, originalIntegrationConfig);
  });

  it('rejects a request with no X-API-Key header', async () => {
    await request(app).post('/jobs/recover-orphaned-watchtimes').expect(401);
  });

  it('rejects a request with the wrong API key', async () => {
    await request(app)
      .post('/jobs/recover-orphaned-watchtimes')
      .set('X-API-Key', 'not-the-real-key')
      .expect(401);
  });

  it('accepts the correct key, actually recovers a real orphaned session, and reports it in the response', async () => {
    const studentUserId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      roles: 'user',
    });

    const courseRes = await request(app)
      .post('/courses')
      .send({
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        versionName: 'Version 1',
        versionDescription: 'Initial version',
      })
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    const courseId = courseRes.body._id;

    const versionRes = await request(app)
      .post(`/courses/${courseId}/versions`)
      .send({version: '1.0', description: 'Initial version'})
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    const versionId = versionRes.body._id;

    const moduleRes = await request(app)
      .post(`/courses/versions/${versionId}/modules`)
      .send({name: faker.commerce.productName(), description: 'module'})
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    const moduleId = moduleRes.body.version.modules[0].moduleId;

    const sectionRes = await request(app)
      .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
      .send({name: faker.commerce.productName(), description: 'section'})
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

    // BLOG needs no heartbeat to be recoverable (D-07) -- simplest possible
    // real orphan for proving D-08's wiring, independent of D-07's own logic.
    const itemPayload: CreateItemBody = {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      type: ItemType.BLOG,
      blogDetails: {
        content: 'Sample blog content for D-08 job-endpoint test.',
        estimatedReadTimeInMinutes: 2,
        tags: undefined as unknown as string[],
        points: '10.00' as unknown as number,
      },
    } as CreateItemBody;

    const itemRes = await request(app)
      .post(
        `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
      )
      .send(itemPayload)
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    const itemId = itemRes.body.itemsGroup.items[0]._id;

    await createEnrollment(
      app,
      studentUserId,
      courseId,
      versionId,
      moduleId,
      sectionId,
      itemId,
    );

    const watchTimeDoc: IWatchTime = {
      userId: new ObjectId(studentUserId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(versionId),
      itemId: new ObjectId(itemId),
      startTime: new Date(Date.now() - 60 * 60 * 1000),
    } as IWatchTime;
    const insertResult = await watchTimeCollection.insertOne(watchTimeDoc);

    const response = await request(app)
      .post('/jobs/recover-orphaned-watchtimes')
      .query({olderThanMinutes: 0, batchSize: 500})
      .set('X-API-Key', TEST_API_KEY)
      .expect(200);

    expect(response.body.scanned).toBeGreaterThanOrEqual(1);
    expect(response.body.closed).toBeGreaterThanOrEqual(1);

    // The real proof this reached the real service, not just a 200 shell:
    // the actual watchTime document in the database is now closed.
    const record = await watchTimeCollection.findOne({
      _id: insertResult.insertedId,
    });
    expect(record?.endTime).toBeDefined();
  });
});
