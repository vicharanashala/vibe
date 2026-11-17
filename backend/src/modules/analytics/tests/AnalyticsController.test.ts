import Express from 'express';
import {
  RoutingControllersOptions,
  useContainer,
  useExpressServer,
} from 'routing-controllers';
import request from 'supertest';
import {Container} from 'inversify';
import {ObjectId, Collection} from 'mongodb';
import {describe, it, expect, beforeAll, vi, afterEach} from 'vitest';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {coursesContainerModules} from '#root/modules/courses/index.js';
import {settingContainerModule} from '#root/modules/setting/container.js';
import {anomaliesContainerModule} from '#root/modules/anomalies/container.js';
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
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {currentUserChecker} from '#root/shared/functions/currentUserChecker.js';
import {analyticsContainerModule} from '../container.js';
import {AnalyticsController} from '../controllers/AnalyticsController.js';
import {ANALYTICS_TYPES} from '../types.js';
import type {AnalyticsProjector} from '../services/AnalyticsProjector.js';
import type {AnalyticsQueryService} from '../services/AnalyticsQueryService.js';
import type {AnalyticsRepository} from '../repositories/AnalyticsRepository.js';
import {addStudent, seedCourse, watch} from './fixtures.js';

describe('AnalyticsController', () => {
  const App = Express();
  let app: any;
  let raw: any;
  let container: Container;
  let course: Awaited<ReturnType<typeof seedCourse>>;
  let other: Awaited<ReturnType<typeof seedCourse>>;
  const tokens = new Map<string, any>();

  async function person(
    token: string,
    roles: string,
    enrolments: {c: string; v: string; role: string}[],
  ) {
    const _id = new ObjectId();
    const user = {
      _id,
      firebaseUID: `analytics-${token}-${_id.toHexString()}`,
      email: `${token}-${_id.toHexString()}@example.com`,
      firstName: token,
      lastName: 'X',
      roles,
    };
    await raw.collection('users').insertOne(user);
    for (const e of enrolments)
      await raw.collection('enrollment').insertOne({
        userId: _id,
        courseId: new ObjectId(e.c),
        courseVersionId: new ObjectId(e.v),
        role: e.role,
        status: 'ACTIVE',
        enrollmentDate: new Date(),
        percentCompleted: 0,
      });
    tokens.set(token, user);
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    container = new Container();
    await container.load(
      ...coursesContainerModules,
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
      analyticsContainerModule,
    );
    useContainer(new InversifyAdapter(container));
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();
    raw = db.database;

    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockImplementation(async (token: string) => {
      const u = tokens.get(token);
      if (!u) throw new Error('unknown token');
      return u;
    });
    const options: RoutingControllersOptions = {
      controllers: [AnalyticsController],
      authorizationChecker: async action =>
        !!action.request.headers['authorization']?.split(' ')[1],
      currentUserChecker,
      defaultErrorHandler: true,
      validation: true,
    };
    app = useExpressServer(App, options);

    course = await seedCourse(raw);
    other = await seedCourse(raw);
    const s = await addStudent(raw, course);
    await watch(
      raw,
      course,
      s,
      course.v1,
      new Date(Date.now() - 3600_000),
      new Date(Date.now() - 3000_000),
    );
    await person('instructor', 'user', [
      {c: course.courseId, v: course.versionId, role: 'INSTRUCTOR'},
    ]);
    await person('ta', 'user', [
      {c: course.courseId, v: course.versionId, role: 'TA'},
    ]);
    await person('student', 'user', [
      {c: course.courseId, v: course.versionId, role: 'STUDENT'},
    ]);
    await person('otherInstructor', 'user', [
      {c: other.courseId, v: other.versionId, role: 'INSTRUCTOR'},
    ]);
    await person('admin', 'admin', []);
  });

  afterEach(() => vi.restoreAllMocks);

  const overview = (token: string, range: string | number = 30, c = course) =>
    request(app)
      .get(
        `/analytics/courses/${c.courseId}/versions/${c.versionId}/overview?range=${range}`,
      )
      .set('Authorization', `Bearer ${token}`);

  it('returns building before the first build, then the 30-day shape (5.1)', async () => {
    const before = await overview('instructor').expect(200);
    expect(before.body).toEqual({
      status: 'building',
      updatedAt: null,
      range: 30,
    });

    await container
      .get<AnalyticsProjector>(ANALYTICS_TYPES.AnalyticsProjector)
      .rebuildVersion(course.courseId, course.versionId);
    const res = await overview('instructor').expect(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.range).toBe(30);
    expect(res.body.daily).toHaveLength(30);
    expect(res.body.heatmap).toHaveLength(7);
    expect(res.body.heatmap[0]).toHaveLength(24);
    for (const key of [
      'headline',
      'progressBands',
      'funnel',
      'whereNow',
      'quizzes',
      'videos',
      'checkOn',
      'proctoring',
      'studyMode',
    ])
      expect(res.body).toHaveProperty(key);
    // The seeded student plus the 'student' account enrolled above.
    expect(res.body.headline.students.current).toBe(2);
    expect(res.body.funnel.map((m: any) => m.name)).toEqual([
      'Module 1',
      'Module 2',
    ]);
    expect(res.body.videos.map((v: any) => v.name)).toEqual([
      'Intro video',
      'Second video',
    ]);
  });

  it('rejects an unsupported range (5.1)', async () => {
    await overview('instructor', 14).expect(400);
  });

  it('answers with at most 5 database reads (5.1)', async () => {
    const query = container.get<AnalyticsQueryService>(
      ANALYTICS_TYPES.AnalyticsQueryService,
    );
    await container
      .get<AnalyticsRepository>(ANALYTICS_TYPES.AnalyticsRepository)
      .init();
    // findOne is implemented on top of find, so counting find covers both.
    const spies = (
      ['find', 'aggregate', 'countDocuments', 'distinct'] as const
    ).map(m => vi.spyOn(Collection.prototype as any, m));
    await query.overview(course.versionId, 30);
    const reads = spies.reduce((n, s) => n + s.mock.calls.length, 0);
    spies.forEach(s => s.mockRestore());
    expect(reads).toBeGreaterThan(0);
    expect(reads).toBeLessThanOrEqual(5);
  });

  it('allows staff of the course and refuses a student or another course’s instructor (5.2)', async () => {
    await overview('instructor').expect(200);
    await overview('ta').expect(200);
    await overview('admin').expect(200);
    await overview('student').expect(403);
    await overview('otherInstructor').expect(403);
  });

  it('lets an admin start a rebuild and refuses a non-admin instructor (5.3)', async () => {
    const repo = container.get<AnalyticsRepository>(
      ANALYTICS_TYPES.AnalyticsRepository,
    );
    const before = (await repo.getState(course.versionId))!.lastRefreshedAt!;
    await new Promise(r => setTimeout(r, 5));
    const url = `/analytics/courses/${course.courseId}/versions/${course.versionId}/rebuild`;
    await request(app)
      .post(url)
      .set('Authorization', 'Bearer instructor')
      .expect(403);
    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer admin')
      .expect(202);
    expect(res.body).toEqual({accepted: true});
    await vi.waitFor(
      async () => {
        const s = await repo.getState(course.versionId);
        expect(s!.lastRefreshedAt!.getTime()).toBeGreaterThan(before.getTime());
      },
      {timeout: 10000, interval: 100},
    );
  });
});
