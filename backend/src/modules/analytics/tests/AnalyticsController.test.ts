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

describe('AnalyticsController', {timeout: 30000}, () => {
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

  it('builds on the first requests, reporting progress, then returns the 30-day shape (5.1)', async () => {
    const projector = container.get<AnalyticsProjector>(
      ANALYTICS_TYPES.AnalyticsProjector,
    );
    // One learner per step so the building state is observable.
    projector.stepLearners = 1;
    const first = await overview('instructor').expect(200);
    expect(first.body).toMatchObject({
      status: 'building',
      buildProgress: 50,
      range: 30,
    });
    expect(first.body.headline).toBeUndefined();
    expect(Date.parse(first.body.updatedAt)).not.toBeNaN();

    const res = await overview('instructor').expect(200);
    projector.stepLearners = 500;
    expect(res.body.status).toBe('ready');
    expect(res.body.buildProgress).toBeUndefined();
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

  it('answers a ready overview from the read models only, with a bounded number of reads (5.1)', async () => {
    const query = container.get<AnalyticsQueryService>(
      ANALYTICS_TYPES.AnalyticsQueryService,
    );
    query.cacheMs = 0;
    await query.overview(course.courseId, course.versionId, 30); // warm caches
    const touched: string[] = [];
    // Count reads by wrapping without changing behaviour.
    const orig: Record<string, any> = {};
    const proto = Collection.prototype as any;
    for (const m of ['find', 'aggregate', 'countDocuments', 'distinct']) {
      orig[m] = proto[m];
      proto[m] = function (this: any, ...args: any[]) {
        touched.push(this.collectionName);
        return orig[m].apply(this, args);
      };
    }
    try {
      const res = await query.overview(course.courseId, course.versionId, 30);
      expect(res.status).toBe('ready');
    } finally {
      for (const m of Object.keys(orig)) proto[m] = orig[m];
    }
    expect(touched.length).toBeGreaterThan(0);
    expect(touched.length).toBeLessThanOrEqual(12);
    // No raw learning records are read to answer a ready overview.
    for (const raw of [
      'watchTime',
      'quiz_submission_results',
      'anomaly_records',
      'enrollment',
      'progress',
      'studyViews',
      'user_activity_events',
    ])
      expect(touched).not.toContain(raw);
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
    await overview('instructor').expect(200);
    const before = (await repo.getState(course.versionId))!;
    const url = `/analytics/courses/${course.courseId}/versions/${course.versionId}/rebuild`;
    await request(app)
      .post(url)
      .set('Authorization', 'Bearer instructor')
      .expect(403);
    expect(await repo.getState(course.versionId)).toMatchObject({
      status: before.status,
    });
    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer admin')
      .expect(202);
    expect(res.body).toEqual({accepted: true});
    expect(await repo.getState(course.versionId)).toBeNull();
    const again = await overview('instructor').expect(200);
    expect(again.body.status).toBe('ready'); // two learners: one step
    expect(again.body.headline.students.current).toBe(2);
  });
});
