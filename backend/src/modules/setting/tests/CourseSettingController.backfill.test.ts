import 'reflect-metadata';
import Express from 'express';
import {
  RoutingControllersOptions,
  useContainer,
  useExpressServer,
} from 'routing-controllers';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { faker } from '@faker-js/faker';
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { sharedContainerModule } from '#root/container.js';
import { GLOBAL_TYPES } from '#root/types.js';
import type { ICourseRepository } from '#root/shared/index.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { IProgress, IEnrollment, IUser, ItemType } from '#shared/interfaces/models.js';
import { setContainer } from '#root/bootstrap/loadModules.js';
import {
  settingContainerModule,
  settingModuleControllers,
} from '../index.js';
import { usersContainerModule } from '#root/modules/users/container.js';
import { coursesContainerModule } from '#root/modules/courses/container.js';
import { authContainerModule } from '#root/modules/auth/container.js';
import { quizzesContainerModule } from '#root/modules/quizzes/container.js';
import { projectsContainerModule } from '#root/modules/projects/container.js';
import { notificationsContainerModule } from '#root/modules/notifications/container.js';
import { hpSystemContainerModule } from '#root/modules/hpSystem/container.js';
import { anomaliesContainerModule } from '#root/modules/anomalies/container.js';
import { courseRegistrationContainerModule } from '#root/modules/courseRegistration/container.js';
import { reportsContainerModule } from '#root/modules/reports/container.js';
import { ejectionPolicyContainerModule } from '#root/modules/ejectionPolicy/container.js';
import { emotionsContainerModule } from '#root/modules/emotions/container.js';
import { genAIContainerModule } from '#root/modules/genAI/container.js';
import { studentQuestionsContainerModule } from '#root/modules/studentQuestions/container.js';
import { announcementsContainerModule } from '#root/modules/announcements/container.js';
import { auditTrailsContainerModule } from '#root/modules/auditTrails/container.js';

/**
 * Integration tests for the follow-up invite *backfill* endpoint
 * (POST /setting/course-setting/:courseId/:versionId/follow-up-invite/backfill).
 *
 * The backfill re-sends the configured follow-up invite to every student who
 * already completed the source course version but isn't yet enrolled in the
 * target course — covering students who finished before the invite was set up.
 *
 * Everything is seeded directly through repositories / the DB (Firebase auth and
 * the @Ability-protected course endpoints aren't available in tests). The target
 * version is given a module → section → items-group → video item so it satisfies
 * the content checks the invite flow performs for STUDENT invites.
 */
describe('CourseSettingController — follow-up invite backfill', () => {
  let app: any;
  let courseRepo: ICourseRepository;
  let progressCollection: Collection<IProgress>;
  let enrollmentCollection: Collection<IEnrollment>;
  let usersCollection: Collection<IUser>;
  let itemsGroupCollection: Collection<any>;
  let videosCollection: Collection<any>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(
      settingContainerModule,
      usersContainerModule,
      coursesContainerModule,
      quizzesContainerModule,
      projectsContainerModule,
      notificationsContainerModule,
      hpSystemContainerModule,
      anomaliesContainerModule,
      courseRegistrationContainerModule,
      reportsContainerModule,
      ejectionPolicyContainerModule,
      emotionsContainerModule,
      genAIContainerModule,
      studentQuestionsContainerModule,
      announcementsContainerModule,
      auditTrailsContainerModule,
      authContainerModule,
      sharedContainerModule,
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    // The backfill resolves ProgressService/InviteService via getContainer(), so
    // register this container as the global one.
    setContainer(container);

    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();
    courseRepo = container.get<ICourseRepository>(GLOBAL_TYPES.CourseRepo);
    progressCollection = await db.getCollection<IProgress>('progress');
    enrollmentCollection = await db.getCollection<IEnrollment>('enrollment');
    usersCollection = await db.getCollection<IUser>('users');
    itemsGroupCollection = await db.getCollection('itemsGroup');
    videosCollection = await db.getCollection('videos');

    app = Express();
    const options: RoutingControllersOptions = {
      controllers: settingModuleControllers as Function[],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
    };
    useExpressServer(app, options);
  }, 900000);

  // Insert a user straight into the DB (no Firebase round-trip).
  async function seedUser(): Promise<{ userId: string; email: string }> {
    const _id = new ObjectId();
    const email = faker.internet.email().toLowerCase();
    await usersCollection.insertOne({
      _id,
      email,
      firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
      lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
      roles: 'user',
    } as unknown as IUser);
    return { userId: _id.toString(), email };
  }

  // Seed a course + version whose first section has a single (video) item, so
  // the invite flow's content validation for STUDENT invites passes.
  async function seedContentCompleteVersion(): Promise<{
    courseId: string;
    versionId: string;
  }> {
    const now = new Date();
    const course = await courseRepo.create({
      name: `course-${new ObjectId().toString()}`,
      description: 'seeded course',
      versions: [],
      instructors: [],
      createdAt: now,
      updatedAt: now,
    } as any);
    const courseId = (course!._id as any).toString();

    const version = await courseRepo.createVersion({
      courseId: course!._id,
      version: 'v1',
      description: 'seeded version',
      modules: [],
      createdAt: now,
      updatedAt: now,
    } as any);
    const versionId = (version!._id as any).toString();

    // A video item + an items-group referencing it.
    const videoId = new ObjectId();
    await videosCollection.insertOne({
      _id: videoId,
      name: 'seeded video',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    } as any);

    const itemsGroupId = new ObjectId();
    const sectionId = new ObjectId();
    await itemsGroupCollection.insertOne({
      _id: itemsGroupId,
      sectionId,
      isDeleted: false,
      items: [
        { _id: videoId, type: ItemType.VIDEO, order: 'a', isHidden: false },
      ],
      createdAt: now,
      updatedAt: now,
    } as any);

    // Attach a module → section → items-group to the version.
    await (courseRepo as any).addModulesToVersion(versionId, [
      {
        moduleId: new ObjectId(),
        name: 'Module 1',
        description: 'seeded module',
        order: 'a',
        isHidden: false,
        sections: [
          {
            sectionId,
            name: 'Section 1',
            description: 'seeded section',
            order: 'a',
            itemsGroupId,
            isHidden: false,
          },
        ],
      },
    ]);

    return { courseId, versionId };
  }

  // Mark a user as having completed a course version (without going through the
  // completion endpoint, which would itself fire the live follow-up invite).
  async function markCompleted(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<void> {
    await progressCollection.insertOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      currentModule: new ObjectId(),
      currentSection: new ObjectId(),
      currentItem: new ObjectId(),
      completed: true,
      completedAt: new Date(),
    } as IProgress);
  }

  async function enrollActive(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<void> {
    await enrollmentCollection.insertOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      role: 'STUDENT',
      status: 'ACTIVE',
      enrollmentDate: new Date(),
      percentCompleted: 0,
    } as IEnrollment);
  }

  const backfillUrl = (courseId: string, versionId: string) =>
    `/setting/course-setting/${courseId}/${versionId}/follow-up-invite/backfill`;
  const followUpUrl = (courseId: string, versionId: string) =>
    `/setting/course-setting/${courseId}/${versionId}/follow-up-invite`;

  // Generous timeout: these tests do many sequential round-trips to a remote
  // Mongo (seeding courses/users/progress + the backfill transaction).
  const TEST_TIMEOUT = 30000;

  it('returns 400 when the source has no enabled follow-up invite', async () => {
    const source = await seedContentCompleteVersion();
    await request(app)
      .post(backfillUrl(source.courseId, source.versionId))
      .expect(400);
  }, TEST_TIMEOUT);

  it('invites past completers who are not yet enrolled, and skips enrolled ones', async () => {
    const source = await seedContentCompleteVersion();
    const target = await seedContentCompleteVersion();

    // Configure the follow-up invite: completing `source` invites to `target`.
    await request(app)
      .put(followUpUrl(source.courseId, source.versionId))
      .send({
        enabled: true,
        courseId: target.courseId,
        courseVersionId: target.versionId,
      })
      .expect(200);

    // Two completers not enrolled in the target → should be invited.
    const userA = await seedUser();
    const userB = await seedUser();
    // One completer already enrolled in the target → should be skipped.
    const userC = await seedUser();

    await markCompleted(userA.userId, source.courseId, source.versionId);
    await markCompleted(userB.userId, source.courseId, source.versionId);
    await markCompleted(userC.userId, source.courseId, source.versionId);
    await enrollActive(userC.userId, target.courseId, target.versionId);

    const res = await request(app)
      .post(backfillUrl(source.courseId, source.versionId))
      .expect(200);

    expect(res.body.completed).toBe(3);
    expect(res.body.alreadyEnrolled).toBe(1);
    expect(res.body.invited).toBe(2);
  }, TEST_TIMEOUT);
});
