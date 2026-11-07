import 'reflect-metadata';
import {coursesContainerModules, coursesModuleOptions} from '../index.js';
import {
  useExpressServer,
  useContainer,
  RoutingControllersOptions,
} from 'routing-controllers';
import {anomaliesContainerModule} from '#root/modules/anomalies/container.js';
import {settingContainerModule} from '#root/modules/setting/container.js';
import {courseRegistrationContainerModule} from '#root/modules/courseRegistration/container.js';
import {projectsContainerModule} from '#root/modules/projects/container.js';
import {reportsContainerModule} from '#root/modules/reports/container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {hpSystemContainerModule} from '#root/modules/hpSystem/container.js';
import {ejectionPolicyContainerModule} from '#root/modules/ejectionPolicy/container.js';
import {emotionsContainerModule} from '#root/modules/emotions/container.js';
import {genAIContainerModule} from '#root/modules/genAI/container.js';
import {studentQuestionsContainerModule} from '#root/modules/studentQuestions/container.js';
import {announcementsContainerModule} from '#root/modules/announcements/container.js';
import {auditTrailsContainerModule} from '#root/modules/auditTrails/container.js';
import Express from 'express';
import {ObjectId} from 'mongodb';
import request from 'supertest';
import {faker} from '@faker-js/faker';
import {describe, it, expect, beforeAll, beforeEach, vi} from 'vitest';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container} from 'inversify';
import {CourseController} from '../controllers/CourseController.js';
import {CourseVersionController} from '../controllers/CourseVersionController.js';
import {ItemController} from '../controllers/ItemController.js';
import {ModuleController} from '../controllers/ModuleController.js';
import {SectionController} from '../controllers/SectionController.js';
import {EnrollmentController} from '#root/modules/users/controllers/EnrollmentController.js';
import {ProgressController} from '#root/modules/users/controllers/ProgressController.js';
import {AttemptController} from '#root/modules/quizzes/controllers/AttemptController.js';
import {ProjectController} from '#root/modules/projects/controllers/projectController.js';
import {CourseSettingController} from '#root/modules/setting/controllers/CourseSettingController.js';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {currentUserChecker} from '#root/shared/functions/currentUserChecker.js';
import {UserRepository} from '#root/shared/database/providers/mongo/repositories/UserRepository.js';
import {ItemType} from '#root/shared/interfaces/models.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {ProgressRepository} from '#root/shared/database/providers/mongo/repositories/ProgressRepository.js';

// ProgressService reads the course settings through the app-wide container.
const app_ = vi.hoisted(() => ({container: null as any}));
vi.mock('#root/bootstrap/loadModules.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  getContainer: () => app_.container,
}));

/**
 * Locking modules, sections and lessons (spec backend/content-locking), through
 * the real endpoints. Same Firebase-free harness as StudyMode.test.ts: 'Bearer
 * test-token' is a global admin; students get their own mocked tokens.
 */
describe('Content locking', () => {
  const App = Express();
  let app: any;
  let db: MongoDatabase;
  let courseId: string;
  let versionId: string;
  let moduleId: string;
  let sectionId: string;
  let userRepo: UserRepository;
  let progressRepo: ProgressRepository;
  let registerTestUser: (token: string, id: string, roles: string) => void;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
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
    );
    app_.container = container;
    useContainer(new InversifyAdapter(container));
    db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();
    userRepo = container.get<UserRepository>(GLOBAL_TYPES.UserRepo);
    progressRepo = container.get<ProgressRepository>(USERS_TYPES.ProgressRepo);

    const tokenToUser = new Map<string, {_id: string; roles: string}>();
    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockImplementation(async (token: string) => {
      const user = tokenToUser.get(token);
      if (!user) throw new Error(`No mocked identity for token "${token}"`);
      return user as any;
    });
    registerTestUser = (token, id, roles) =>
      tokenToUser.set(token, {_id: id, roles});

    const options: RoutingControllersOptions = {
      controllers: [
        CourseController,
        CourseVersionController,
        ModuleController,
        SectionController,
        ItemController,
        EnrollmentController,
        ProgressController,
        AttemptController,
        ProjectController,
        CourseSettingController,
      ],
      middlewares: coursesModuleOptions.middlewares,
      defaultErrorHandler: coursesModuleOptions.defaultErrorHandler,
      authorizationChecker: async action =>
        !!action.request.headers['authorization']?.split(' ')[1],
      currentUserChecker,
      validation: coursesModuleOptions.validation,
    };
    app = useExpressServer(App, options);

    const adminId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: 'Instructor',
      lastName: 'Account',
      roles: 'user',
    });
    registerTestUser('test-token', adminId, 'admin');
  }, 90000);

  const admin = (r: request.Test) =>
    r.set('Authorization', 'Bearer test-token');
  const ok = (status: number) => (res: request.Response) => {
    if (res.status !== status) {
      throw new Error(
        `${(res as any).req.method} ${(res as any).req.path}: expected ${status}, got ${res.status} ${JSON.stringify(res.body)}`,
      );
    }
  };
  const as = (token: string, r: request.Test) =>
    r.set('Authorization', `Bearer ${token}`);

  async function addModule(): Promise<string> {
    const mod = await admin(
      request(app).post(`/courses/versions/${versionId}/modules`),
    )
      .send({name: faker.commerce.productName(), description: 'A module'})
      .expect(ok(201));
    return mod.body.version.modules.at(-1).moduleId.toString();
  }

  async function addSection(m = moduleId): Promise<string> {
    const res = await admin(
      request(app).post(`/courses/versions/${versionId}/modules/${m}/sections`),
    )
      .send({name: faker.commerce.productName(), description: 'A section'})
      .expect(ok(201));
    return res.body.version.modules
      .find((x: any) => x.moduleId === m)
      .sections.at(-1)
      .sectionId.toString();
  }

  // Two seconds long: the stop endpoint's watch-time check passes at once.
  async function addVideo(section = sectionId, m = moduleId): Promise<string> {
    const res = await admin(
      request(app).post(
        `/courses/versions/${versionId}/modules/${m}/sections/${section}/items`,
      ),
    )
      .send({
        name: faker.commerce.productName(),
        description: 'A video',
        type: ItemType.VIDEO,
        videoDetails: {
          URL: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          startTime: '00:00:00',
          endTime: '00:00:02',
          points: 1,
        },
      })
      .expect(ok(201));
    return res.body.itemsGroup.items.at(-1)._id.toString();
  }

  async function addQuiz(section = sectionId): Promise<string> {
    const res = await admin(
      request(app).post(
        `/courses/versions/${versionId}/modules/${moduleId}/sections/${section}/items`,
      ),
    )
      .send({
        name: faker.commerce.productName(),
        description: 'A quiz',
        type: ItemType.QUIZ,
        quizDetails: {
          questionVisibility: 3,
          allowPartialGrading: true,
          allowSkip: false,
          deadline: faker.date.future(),
          allowHint: true,
          maxAttempts: 5,
          releaseTime: faker.date.past(),
          quizType: 'DEADLINE',
          showCorrectAnswersAfterSubmission: true,
          showExplanationAfterSubmission: true,
          showScoreAfterSubmission: true,
          approximateTimeToComplete: '00:30:00',
          passThreshold: 0,
        },
      })
      .expect(ok(201));
    return res.body.itemsGroup.items.at(-1)._id.toString();
  }

  async function enroll(role = 'STUDENT') {
    const studentId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: 'Student',
      lastName: 'Account',
      roles: 'user',
    });
    const token = `user-token-${studentId}`;
    registerTestUser(token, studentId, 'user');
    await admin(
      request(app).post(
        `/users/${studentId}/enrollments/courses/${courseId}/versions/${versionId}`,
      ),
    )
      .send({role})
      .expect(200);
    return {token, studentId};
  }

  const lockModule = (
    value: boolean | null,
    token = 'test-token',
    m = moduleId,
  ) =>
    as(
      token,
      request(app).put(`/courses/versions/${versionId}/modules/${m}/lock`),
    ).send({
      isLocked: value,
    });
  const lockSection = (value: boolean | null, s = sectionId) =>
    admin(
      request(app).put(
        `/courses/versions/${versionId}/modules/${moduleId}/sections/${s}/lock`,
      ),
    ).send({isLocked: value});
  const lockItem = (
    value: boolean | null,
    itemId: string,
    token = 'test-token',
  ) =>
    as(
      token,
      request(app).put(`/courses/versions/${versionId}/items/${itemId}/lock`),
    ).send({
      isLocked: value,
    });

  const read = (
    token: string,
    itemId: string,
    {study = false, m = moduleId, s = sectionId} = {},
  ) =>
    as(
      token,
      request(app).get(
        `/courses/${courseId}/versions/${versionId}/modules/${m}/sections/${s}/item/${itemId}${study ? '?mode=study' : ''}`,
      ),
    );

  const startBody = (itemId: string, s = sectionId, m = moduleId) => ({
    itemId,
    moduleId: m,
    sectionId: s,
  });
  const start = (token: string, itemId: string, s = sectionId, m = moduleId) =>
    as(
      token,
      request(app).post(
        `/users/progress/courses/${courseId}/versions/${versionId}/start`,
      ),
    ).send(startBody(itemId, s, m));
  const stop = (
    token: string,
    itemId: string,
    watchItemId: string,
    s = sectionId,
    m = moduleId,
    extra: Record<string, unknown> = {},
  ) =>
    as(
      token,
      request(app).post(
        `/users/progress/courses/${courseId}/versions/${versionId}/stop`,
      ),
    ).send({watchItemId, ...startBody(itemId, s, m), ...extra});

  async function complete(token: string, itemId: string) {
    const started = await start(token, itemId).expect(ok(200));
    await stop(token, itemId, started.body.watchItemId).expect(ok(200));
  }

  const expectLocked = (res: request.Response, source: string) => {
    expect(res.status).toBe(403);
    expect(res.body.name).toBe('CONTENT_LOCKED');
    expect(res.body.details?.source).toBe(source);
  };

  const progressOf = async (studentId: string) => {
    const p = await progressRepo.findProgress(studentId, courseId, versionId);
    return {
      currentItem: p?.currentItem?.toString(),
      completed: p?.completed,
    };
  };

  const percentOf = async (token: string) =>
    (
      await as(
        token,
        request(app).get(
          `/users/progress/courses/${courseId}/versions/${versionId}/percentage`,
        ),
      ).expect(ok(200))
    ).body;

  const setLinear = async (linear: boolean) => {
    const settings = await db.getCollection<any>('courseSettings');
    await settings.updateOne(
      {courseVersionId: new ObjectId(versionId)},
      {$set: {'settings.linearProgressionEnabled': linear}},
    );
  };

  beforeEach(async () => {
    const course = await admin(request(app).post('/courses'))
      .send({
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        versionName: 'Version one',
        versionDescription: 'First version',
      })
      .expect(ok(201));
    courseId = course.body._id.toString();
    versionId = course.body.versions[0].toString();
    moduleId = await addModule();
    sectionId = await addSection();
  });

  describe('setting the lock', () => {
    it('sets and clears the lock at every level', async () => {
      const item = await addVideo();
      await lockModule(true).expect(ok(200));
      await lockSection(false).expect(ok(200));
      const res = await lockItem(true, item).expect(ok(200));
      expect(res.body).toEqual({itemId: item, isLocked: true});

      const version = await admin(
        request(app).get(`/courses/versions/${versionId}`),
      ).expect(ok(200));
      const mod = version.body.modules.find(
        (m: any) => m.moduleId === moduleId,
      );
      expect(mod.isLocked).toBe(true);
      expect(mod.sections[0].isLocked).toBe(false);

      await lockModule(null).expect(ok(200));
      await lockSection(null).expect(ok(200));
      await lockItem(null, item).expect(ok(200));
      const after = await admin(
        request(app).get(`/courses/versions/${versionId}`),
      ).expect(ok(200));
      const cleared = after.body.modules.find(
        (m: any) => m.moduleId === moduleId,
      );
      expect(cleared.isLocked ?? null).toBeNull();
      expect(cleared.sections[0].isLocked ?? null).toBeNull();
    });

    it('refuses callers who cannot modify the version', async () => {
      const item = await addVideo();
      const {token} = await enroll();
      await lockModule(true, token).expect(ok(403));
      await lockItem(true, item, token).expect(ok(403));
    });

    it('answers 404 for targets that are not in the version', async () => {
      await lockModule(true, 'test-token', new ObjectId().toString()).expect(
        ok(404),
      );
      await lockSection(true, new ObjectId().toString()).expect(ok(404));
      await lockItem(true, new ObjectId().toString()).expect(ok(404));
    });

    it('refuses changes on an archived version', async () => {
      const versions = await db.getCollection<any>('newCourseVersion');
      await versions.updateOne(
        {_id: new ObjectId(versionId)},
        {$set: {versionStatus: 'archived'}},
      );
      await lockModule(true).expect(ok(403));
    });

    it("keeps a lesson's lock when another lesson is hidden", async () => {
      const locked = await addVideo();
      const other = await addVideo();
      await lockItem(true, locked).expect(ok(200));

      await admin(
        request(app).put(
          `/courses/${courseId}/versions/${versionId}/items/${other}/toggle-visibility`,
        ),
      )
        .send({hide: true})
        .expect(ok(200));

      const {token} = await enroll();
      expectLocked(await read(token, locked), 'item');
    });
  });

  describe('the outline', () => {
    it('keeps locked content listed for students, with its setting', async () => {
      const item = await addVideo();
      await lockSection(true).expect(ok(200));
      await lockItem(false, item).expect(ok(200));
      const {token} = await enroll();

      const version = await as(
        token,
        request(app).get(`/courses/versions/${versionId}`),
      ).expect(ok(200));
      const section = version.body.modules
        .find((m: any) => m.moduleId === moduleId)
        .sections.find((s: any) => s.sectionId === sectionId);
      expect(section.isLocked).toBe(true);

      const items = await as(
        token,
        request(app).get(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        ),
      ).expect(ok(200));
      const list = items.body.items ?? items.body;
      expect(list.map((i: any) => [i._id, i.isLocked])).toEqual([
        [item, false],
      ]);
    });
  });

  describe('reading', () => {
    it('refuses strict and study reads, naming the level', async () => {
      const item = await addVideo();
      const {token} = await enroll();

      await lockModule(true).expect(ok(200));
      expectLocked(await read(token, item), 'module');
      expectLocked(await read(token, item, {study: true}), 'module');

      await lockSection(true).expect(ok(200));
      expectLocked(await read(token, item), 'section');

      await lockItem(true, item).expect(ok(200));
      expectLocked(await read(token, item), 'item');
    });

    it('returns no lesson content in the refusal', async () => {
      const item = await addVideo();
      const {token} = await enroll();
      await lockItem(true, item).expect(ok(200));
      const res = await read(token, item);
      expect(JSON.stringify(res.body)).not.toContain('youtube');
    });

    it('closes a finished lesson, and opens it again on unlock', async () => {
      const first = await addVideo();
      await addVideo();
      const {token} = await enroll();
      await complete(token, first);

      await lockItem(true, first).expect(ok(200));
      expectLocked(await read(token, first), 'item');

      await lockItem(null, first).expect(ok(200));
      await read(token, first).expect(ok(201));
    });

    it('keeps one lesson open inside a locked module', async () => {
      const open = await addVideo();
      const closed = await addVideo();
      const {token} = await enroll();
      await lockModule(true).expect(ok(200));
      await lockItem(false, open).expect(ok(200));

      await read(token, open).expect(ok(201));
      expectLocked(await read(token, closed), 'module');
    });

    it('ignores the module and section ids in the URL', async () => {
      const item = await addVideo();
      const otherModule = await addModule();
      const otherSection = await addSection(otherModule);
      await addVideo(otherSection, otherModule);
      const {token} = await enroll();
      await lockModule(true).expect(ok(200));

      expectLocked(
        await read(token, item, {study: true, m: otherModule, s: otherSection}),
        'module',
      );
    });

    it('exempts course staff', async () => {
      const item = await addVideo();
      const {token} = await enroll('INSTRUCTOR');
      await lockModule(true).expect(ok(200));
      await read(token, item).expect(ok(201));
    });
  });

  describe('working on a locked lesson', () => {
    it('refuses start and creates no watch time', async () => {
      const item = await addVideo();
      const {token, studentId} = await enroll();
      await lockItem(true, item).expect(ok(200));

      expectLocked(await start(token, item), 'item');

      const watchTime = await db.getCollection<any>('watchTime');
      expect(
        await watchTime.countDocuments({userId: new ObjectId(studentId)}),
      ).toBe(0);
    });

    it('refuses stop for a video locked mid-watch', async () => {
      const item = await addVideo();
      await addVideo();
      const {token, studentId} = await enroll();
      const started = await start(token, item).expect(ok(200));
      const before = await progressOf(studentId);

      await lockItem(true, item).expect(ok(200));
      expectLocked(await stop(token, item, started.body.watchItemId), 'item');

      expect(await progressOf(studentId)).toEqual(before);
    });

    it('refuses skip', async () => {
      const item = await addVideo();
      await addVideo();
      const {token, studentId} = await enroll();
      const before = await progressOf(studentId);
      await lockItem(true, item).expect(ok(200));

      expectLocked(
        await as(token, request(app).post(`/users/items/${item}/skip`)).send(
          {},
        ),
        'item',
      );
      expect(await progressOf(studentId)).toEqual(before);
    });

    it('refuses a new attempt and uses none up', async () => {
      const quiz = await addQuiz();
      const {token, studentId} = await enroll();
      await lockItem(true, quiz).expect(ok(200));

      expectLocked(
        await as(token, request(app).post(`/quizzes/${quiz}/attempt`)).send({}),
        'item',
      );

      const metrics = await db.getCollection<any>('user_quiz_metrics');
      expect(
        await metrics.countDocuments({userId: new ObjectId(studentId)}),
      ).toBe(0);
    });

    it('refuses a study view and stores nothing', async () => {
      const item = await addVideo();
      const {token, studentId} = await enroll();
      await lockItem(true, item).expect(ok(200));

      expectLocked(
        await as(
          token,
          request(app).post(
            `/users/progress/courses/${courseId}/versions/${versionId}/study-views`,
          ),
        ).send(startBody(item)),
        'item',
      );

      const views = await db.getCollection<any>('studyViews');
      expect(
        await views.countDocuments({userId: new ObjectId(studentId)}),
      ).toBe(0);
    });

    it('refuses feedback and project submissions', async () => {
      const item = await addVideo();
      const {token, studentId} = await enroll();
      await lockItem(true, item).expect(ok(200));

      expectLocked(
        await as(
          token,
          request(app).post(`/quizzes/${item}/feedback/submit`),
        ).send({
          details: {answer: 'x'},
          courseId,
          courseVersionId: versionId,
          sectionId,
        }),
        'item',
      );
      expectLocked(
        await as(token, request(app).post('/project')).send({
          projectId: item,
          courseId,
          versionId,
          moduleId,
          sectionId,
          watchItemId: new ObjectId().toString(),
          submissionURL: 'https://example.com/work',
          comment: 'Done',
        }),
        'item',
      );

      const submissions = await db.getCollection<any>('project_submissions');
      expect(
        await submissions.countDocuments({userId: new ObjectId(studentId)}),
      ).toBe(0);
    });
  });

  describe('an attempt started before the lock', () => {
    it('can still be saved, submitted and stopped', async () => {
      const quiz = await addQuiz();
      await addVideo();
      const {token} = await enroll();
      const started = await start(token, quiz).expect(ok(200));
      const attempt = await as(
        token,
        request(app).post(`/quizzes/${quiz}/attempt`),
      )
        .send({})
        .expect(ok(200));
      const {attemptId} = attempt.body;

      await lockItem(true, quiz).expect(ok(200));

      const answers = {answers: []};
      await as(
        token,
        request(app).post(`/quizzes/${quiz}/attempt/${attemptId}/save`),
      )
        .send(answers)
        .expect(ok(200));
      await as(
        token,
        request(app).post(`/quizzes/${quiz}/attempt/${attemptId}/submit`),
      )
        .send({
          ...answers,
          courseId,
          courseVersionId: versionId,
          watchItemId: started.body.watchItemId,
          moduleId,
          sectionId,
        })
        .expect(ok(200));

      await stop(token, quiz, started.body.watchItemId, sectionId, moduleId, {
        attemptId,
      }).expect(ok(200));
    });

    it('still refuses stop when the attempt was never submitted', async () => {
      const quiz = await addQuiz();
      const {token} = await enroll();
      const started = await start(token, quiz).expect(ok(200));
      const attempt = await as(
        token,
        request(app).post(`/quizzes/${quiz}/attempt`),
      )
        .send({})
        .expect(ok(200));

      await lockItem(true, quiz).expect(ok(200));

      expectLocked(
        await stop(token, quiz, started.body.watchItemId, sectionId, moduleId, {
          attemptId: attempt.body.attemptId,
        }),
        'item',
      );
    });
  });

  describe('progress', () => {
    it('leaves progress and totals alone when locking and unlocking', async () => {
      const first = await addVideo();
      const second = await addVideo();
      const third = await addVideo();
      const {token, studentId} = await enroll();
      await complete(token, first);
      await complete(token, second);
      const progress = await progressOf(studentId);
      const percent = await percentOf(token);
      expect(progress.currentItem).toBe(third);

      await lockItem(true, first).expect(ok(200));
      await lockItem(true, second).expect(ok(200));
      expect(await progressOf(studentId)).toEqual(progress);
      expect(await percentOf(token)).toEqual(percent);

      await lockItem(null, first).expect(ok(200));
      await lockItem(null, second).expect(ok(200));
      expect(await progressOf(studentId)).toEqual(progress);
      expect(await percentOf(token)).toEqual(percent);
    });
  });

  describe('linear courses', () => {
    it('waits at a locked lesson, then continues after unlocking', async () => {
      const first = await addVideo();
      const second = await addVideo();
      const third = await addVideo();
      const {token, studentId} = await enroll();
      await lockItem(true, second).expect(ok(200));

      await complete(token, first);

      expect(await progressOf(studentId)).toMatchObject({
        currentItem: second,
        completed: false,
      });
      expectLocked(await read(token, second), 'item');
      const beyond = await read(token, third);
      expect(beyond.status).toBe(403);
      expect(beyond.body.name).not.toBe('CONTENT_LOCKED');
      expect(await progressOf(studentId)).toMatchObject({currentItem: second});

      await lockItem(null, second).expect(ok(200));
      await read(token, second).expect(ok(201));
      await complete(token, second);
      await read(token, third).expect(ok(201));
    });

    it('does not mark the course complete at a locked last lesson', async () => {
      const first = await addVideo();
      const last = await addVideo();
      const {token, studentId} = await enroll();
      await lockItem(true, last).expect(ok(200));

      await complete(token, first);

      expect(await progressOf(studentId)).toMatchObject({
        currentItem: last,
        completed: false,
      });
    });
  });

  describe('non-linear courses', () => {
    it('closes only the locked lessons', async () => {
      await addVideo();
      const locked = await addVideo();
      const later = await addVideo();
      await setLinear(false);
      const {token} = await enroll();
      await lockItem(true, locked).expect(ok(200));

      expectLocked(await read(token, locked), 'item');
      await read(token, later).expect(ok(201));
    });
  });
});
