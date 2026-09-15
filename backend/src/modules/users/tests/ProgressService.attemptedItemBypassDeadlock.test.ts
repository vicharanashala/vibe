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
import {USERS_TYPES} from '../types.js';
import {UserRepository} from '#shared/database/providers/mongo/repositories/UserRepository.js';
import {IProgress} from '#shared/interfaces/models.js';
import {Collection, ObjectId} from 'mongodb';
import {faker} from '@faker-js/faker';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {ProgressService} from '../services/ProgressService.js';
import {describe, it, expect, beforeAll, vi} from 'vitest';
import {
  createCourseWithModulesSectionsAndItems,
  CourseData,
} from './utils/createCourse.js';
import {createEnrollment} from './utils/createEnrollment.js';
import {startStopAndUpdateProgress} from './utils/startStopAndUpdateProgress.js';

/**
 * D-09 end-to-end regression: an item carrying an open (never-stopped)
 * watchTime row is "already attempted", which readItem's own bypass
 * (ItemService.readItem) lets through WITHOUT advancing progress.currentItem
 * -- by design, since it has no completion to award. But verifyProgress
 * (called by startItem) previously required an exact triple-match against
 * that same un-advanced pointer, so a student who was already let into the
 * lesson by readItem got refused by startItem for the very same item --
 * permanently, since nothing in the live path ever moves the pointer for
 * them. This test reproduces that exact state directly (an orphaned open
 * row on item2, pointer still parked on the completed item1) and asserts
 * startItem now succeeds, matching the condition readItem already accepts.
 */
describe('ProgressService — attempted-item bypass no longer deadlocks startItem (D-09)', {timeout: 90000}, () => {
  const appInstance = Express();
  let app;
  let userId: string;
  let courseData: CourseData;
  let progressCollection: Collection<IProgress>;
  const testTokenUserId = faker.database.mongodbObjectId();

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
    progressCollection = await db.getCollection<IProgress>('progress');
    const userRepo = container.get<UserRepository>(GLOBAL_TYPES.UserRepo);

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

    userId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      roles: 'user',
    });

    vi.spyOn(
      FirebaseAuthService.prototype,
      'getUserIdFromReq',
    ).mockImplementation(async () => userId);
    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockImplementation(async (token: string): Promise<any> => {
      if (token === 'test-token') {
        return {_id: testTokenUserId, roles: 'admin'};
      }
      return {_id: userId, roles: 'user'};
    });

    // 1 module, 1 section, 2 items: item1 gets genuinely completed, item2 is
    // the one that ends up with an orphaned open row.
    courseData = await createCourseWithModulesSectionsAndItems(1, 1, 2, app);

    const enrollmentResponse = await createEnrollment(
      app,
      userId,
      courseData.courseId,
      courseData.courseVersionId,
      courseData.modules[0].moduleId,
      courseData.modules[0].sections[0].sectionId,
      courseData.modules[0].sections[0].items[0].itemId,
    );
    expect(enrollmentResponse).toBeTruthy();
  });

  it('lets startItem admit an already-attempted item once the previous item is completed, instead of permanently refusing it', async () => {
    const [item1, item2] = courseData.modules[0].sections[0].items;
    const moduleId = courseData.modules[0].moduleId;
    const sectionId = courseData.modules[0].sections[0].sectionId;

    // Genuinely complete item1 -> pointer advances to item2.
    await startStopAndUpdateProgress({
      userId,
      courseId: courseData.courseId,
      courseVersionId: courseData.courseVersionId,
      itemId: item1.itemId,
      moduleId,
      sectionId,
      app,
    });

    // Start item2 for real (creates a genuine open watchTime row), but never
    // stop it -- exactly what a lost STOP call leaves behind.
    vi.spyOn(ProgressService.prototype as any, 'isValidWatchTime')
      .mockReset()
      .mockReturnValue(true);
    const startItem2Response = await request(app)
      .post(
        `/users/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/start`,
      )
      .set('Authorization', 'Bearer default')
      .send({itemId: item2.itemId, moduleId, sectionId})
      .expect(200);
    expect(startItem2Response.body.watchItemId).toBeTruthy();

    // Reproduce readItem's own bypass state directly: isItemAlreadyAttempted
    // (an open row exists) lets a student back into item2 without ever
    // advancing the pointer, so it stays on item2's own predecessor's
    // successor -- i.e. still item2 itself in this two-item course, which is
    // already true here since item1 just completed. To reproduce the actual
    // deadlock (pointer behind the attempted item), roll the pointer back to
    // item1 -- the exact state left behind when an EARLIER attempted item's
    // bypass fired for something further along than the immediate next item.
    await progressCollection.updateOne(
      {userId: new ObjectId(userId), courseId: new ObjectId(courseData.courseId)},
      {$set: {currentItem: new ObjectId(item1.itemId)}},
    );

    // Before the fix: verifyProgress's strict triple-match rejects this
    // outright (currentItem is item1, but the request is for item2) even
    // though item1 -- the actual predecessor -- is completed, which is
    // exactly the condition readItem itself already accepts. This is the
    // permanent deadlock: the student can be shown item2 by readItem, but
    // can never start tracking on it again.
    const retryStartResponse = await request(app)
      .post(
        `/users/progress/courses/${courseData.courseId}/versions/${courseData.courseVersionId}/start`,
      )
      .set('Authorization', 'Bearer default')
      .send({itemId: item2.itemId, moduleId, sectionId})
      .expect(200);

    expect(retryStartResponse.body.watchItemId).toBeTruthy();
  });
});
