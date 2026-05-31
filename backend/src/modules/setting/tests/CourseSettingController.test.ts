import 'reflect-metadata';
import Express from 'express';
import {
  RoutingControllersOptions,
  useContainer,
  useExpressServer,
} from 'routing-controllers';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { ObjectId } from 'mongodb';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { sharedContainerModule } from '#root/container.js';
import { GLOBAL_TYPES } from '#root/types.js';
import type { ICourseRepository, ISettingRepository } from '#root/shared/index.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {
  settingContainerModule,
  settingModuleControllers,
} from '../index.js';
import { usersContainerModule } from '#root/modules/users/container.js';
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
import { authContainerModule } from '#root/modules/auth/container.js';

/**
 * Integration tests for the follow-up invite settings endpoint
 * (PUT /setting/course-setting/:courseId/:versionId/follow-up-invite).
 *
 * Courses/versions/cohorts are seeded directly through the repository instead
 * of the HTTP course-creation endpoints, since those require Firebase auth
 * (the endpoint under test does not). This keeps the test self-contained.
 */
describe('CourseSettingController — follow-up invite', () => {
  let app: any;
  let courseRepo: ICourseRepository;
  let settingRepo: ISettingRepository;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(
      settingContainerModule,
      usersContainerModule,
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

    // Establish the DB connection the repositories rely on.
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    courseRepo = container.get<ICourseRepository>(GLOBAL_TYPES.CourseRepo);
    settingRepo = container.get<ISettingRepository>(GLOBAL_TYPES.SettingRepo);

    app = Express();
    const options: RoutingControllersOptions = {
      controllers: settingModuleControllers as Function[],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
    };
    useExpressServer(app, options);
  }, 900000);

  // Seed a course + version (optionally with cohorts) straight into the DB.
  async function seedCourseVersion(
    cohortNames: string[] = [],
  ): Promise<{ courseId: string; versionId: string; cohortIds: string[] }> {
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

    let cohortIds: string[] = [];
    if (cohortNames.length) {
      const ids = await courseRepo.createCohorts(courseId, versionId, cohortNames, 0);
      await courseRepo.addCohortsToVersion(versionId, ids);
      cohortIds = ids.map(id => id.toString());
    }

    return { courseId, versionId, cohortIds };
  }

  let sourceCourseId: string;
  let sourceVersionId: string;
  let targetCourseId: string;
  let targetVersionId: string;

  beforeEach(async () => {
    const source = await seedCourseVersion();
    sourceCourseId = source.courseId;
    sourceVersionId = source.versionId;

    const target = await seedCourseVersion();
    targetCourseId = target.courseId;
    targetVersionId = target.versionId;
  });

  const followUpUrl = (courseId: string, versionId: string) =>
    `/setting/course-setting/${courseId}/${versionId}/follow-up-invite`;

  it('enables a follow-up invite to a valid target course (no cohorts) and persists it', async () => {
    const res = await request(app)
      .put(followUpUrl(sourceCourseId, sourceVersionId))
      .send({
        enabled: true,
        courseId: targetCourseId,
        courseVersionId: targetVersionId,
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify persistence via the repository (the HTTP response serializes
    // nested ObjectIds opaquely, so assert against the stored document).
    const stored = await settingRepo.readCourseSettings(sourceCourseId, sourceVersionId);
    const followUp = (stored as any)?.settings?.followUpInvite;
    expect(followUp?.enabled).toBe(true);
    expect(followUp?.courseId?.toString()).toBe(targetCourseId);
    expect(followUp?.courseVersionId?.toString()).toBe(targetVersionId);
  });

  it('rejects enabling without a target course/version (400)', async () => {
    await request(app)
      .put(followUpUrl(sourceCourseId, sourceVersionId))
      .send({ enabled: true })
      .expect(400);
  });

  it('returns 404 when the target course does not exist', async () => {
    await request(app)
      .put(followUpUrl(sourceCourseId, sourceVersionId))
      .send({
        enabled: true,
        courseId: new ObjectId().toString(),
        courseVersionId: new ObjectId().toString(),
      })
      .expect(404);
  });

  it('rejects enabling when the target version has cohorts but none is selected (400)', async () => {
    const target = await seedCourseVersion(['Cohort A', 'Cohort B']);

    await request(app)
      .put(followUpUrl(sourceCourseId, sourceVersionId))
      .send({
        enabled: true,
        courseId: target.courseId,
        courseVersionId: target.versionId,
        // cohortId intentionally omitted
      })
      .expect(400);
  });

  it('enables when the target version has cohorts and a valid cohort is selected (200)', async () => {
    const target = await seedCourseVersion(['Cohort A', 'Cohort B']);

    const res = await request(app)
      .put(followUpUrl(sourceCourseId, sourceVersionId))
      .send({
        enabled: true,
        courseId: target.courseId,
        courseVersionId: target.versionId,
        cohortId: target.cohortIds[0],
      })
      .expect(200);
    expect(res.body.success).toBe(true);

    const stored = await settingRepo.readCourseSettings(sourceCourseId, sourceVersionId);
    const followUp = (stored as any)?.settings?.followUpInvite;
    expect(followUp?.enabled).toBe(true);
    expect(followUp?.cohortId?.toString()).toBe(target.cohortIds[0]);
  });

  it('disables the follow-up invite without requiring a target (200)', async () => {
    await request(app)
      .put(followUpUrl(sourceCourseId, sourceVersionId))
      .send({
        enabled: true,
        courseId: targetCourseId,
        courseVersionId: targetVersionId,
      })
      .expect(200);

    const res = await request(app)
      .put(followUpUrl(sourceCourseId, sourceVersionId))
      .send({ enabled: false })
      .expect(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/setting/course-setting/${sourceCourseId}/${sourceVersionId}`)
      .expect(200);
    expect(getRes.body.settings?.followUpInvite?.enabled).toBe(false);
  });
});
