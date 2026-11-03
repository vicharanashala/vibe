import {
  coursesContainerModules,
  coursesModuleOptions,
} from '#root/modules/courses/index.js';
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
import {describe, it, expect, beforeAll, vi} from 'vitest';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container} from 'inversify';
import {CourseController} from '#root/modules/courses/controllers/CourseController.js';
import {CourseVersionController} from '#root/modules/courses/controllers/CourseVersionController.js';
import {ItemController} from '#root/modules/courses/controllers/ItemController.js';
import {ModuleController} from '#root/modules/courses/controllers/ModuleController.js';
import {SectionController} from '#root/modules/courses/controllers/SectionController.js';
import {EnrollmentController} from '#root/modules/users/controllers/EnrollmentController.js';
import {ProgressController} from '#root/modules/users/controllers/ProgressController.js';
import {CourseSettingController} from '#root/modules/setting/controllers/CourseSettingController.js';
import {AnomalyController} from '#root/modules/anomalies/controllers/AnomalyController.js';
import {AnomalyType} from '#root/modules/anomalies/classes/transformers/Anomaly.js';
import {CloudStorageService} from '#root/modules/anomalies/services/CloudStorageService.js';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {currentUserChecker} from '#root/shared/functions/currentUserChecker.js';
import {UserRepository} from '#root/shared/database/providers/mongo/repositories/UserRepository.js';
import {ItemType} from '#root/shared/interfaces/models.js';
import {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';
import {COURSES_TYPES} from '#courses/types.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {ProgressRepository} from '#root/shared/database/providers/mongo/repositories/ProgressRepository.js';
import {ProctoringComponent} from '#root/shared/database/interfaces/ISettingRepository.js';

const controllers: Function[] = [
  CourseController,
  CourseVersionController,
  ModuleController,
  SectionController,
  ItemController,
  EnrollmentController,
  ProgressController,
  CourseSettingController,
  AnomalyController,
];

describe('Study progress', () => {
  const App = Express();
  let app;
  let courseId: string;
  let versionId: string;
  let moduleId: string;
  let sectionId: string;
  let userRepo: UserRepository;
  let itemRepo: IItemRepository;
  let progressRepo: ProgressRepository;
  let db: MongoDatabase;
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
    useContainer(new InversifyAdapter(container));
    db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    userRepo = container.get<UserRepository>(GLOBAL_TYPES.UserRepo);
    itemRepo = container.get<IItemRepository>(COURSES_TYPES.ItemRepo);
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
      controllers,
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

  // The shared creationFunctions helpers send no Authorization header, which
  // is why the suites built on them are on CI's known-broken list; this suite
  // authenticates every call instead.
  async function seedCourse() {
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
    const mod = await admin(
      request(app).post(`/courses/versions/${versionId}/modules`),
    )
      .send({
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
      })
      .expect(ok(201));
    moduleId = mod.body.version.modules[0].moduleId.toString();
    sectionId = await addSection();
  }

  async function addSection(): Promise<string> {
    const res = await admin(
      request(app).post(
        `/courses/versions/${versionId}/modules/${moduleId}/sections`,
      ),
    )
      .send({
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
      })
      .expect(ok(201));
    const sections = res.body.version.modules.find(
      (m: any) => m.moduleId === moduleId,
    ).sections;
    return sections[sections.length - 1].sectionId.toString();
  }

  async function addVideo(section = sectionId): Promise<string> {
    const res = await admin(
      request(app).post(
        `/courses/versions/${versionId}/modules/${moduleId}/sections/${section}/items`,
      ),
    ).send({
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      type: ItemType.VIDEO,
      videoDetails: {
        URL: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        startTime: '00:00:00',
        endTime: '00:05:00',
        points: 1,
      },
    });
    if (res.status !== 201)
      throw new Error(`addVideo ${res.status}: ${JSON.stringify(res.body)}`);
    const items = res.body.itemsGroup.items;
    return items[items.length - 1]._id.toString();
  }

  async function enrollStudent(): Promise<{token: string; studentId: string}> {
    const studentId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: 'Student',
      lastName: 'Account',
      roles: 'user',
    });
    const token = `student-token-${studentId}`;
    registerTestUser(token, studentId, 'user');
    await admin(
      request(app).post(
        `/users/${studentId}/enrollments/courses/${courseId}/versions/${versionId}`,
      ),
    )
      .send({role: 'STUDENT'})
      .expect(200);
    return {token, studentId};
  }

  async function addQuiz(section = sectionId): Promise<string> {
    const res = await admin(
      request(app).post(
        `/courses/versions/${versionId}/modules/${moduleId}/sections/${section}/items`,
      ),
    )
      .send({
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
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
          passThreshold: 0.7,
        },
      })
      .expect(ok(201));
    const items = res.body.itemsGroup.items;
    return items[items.length - 1]._id.toString();
  }

  /** GET the lesson as `token`; `study` adds ?mode=study. Returns the raw response. */
  const readLesson = (
    itemId: string,
    token: string,
    study = false,
    section = sectionId,
  ) =>
    request(app)
      .get(
        `/courses/${courseId}/versions/${versionId}/modules/${moduleId}/sections/${section}/item/${itemId}${study ? '?mode=study' : ''}`,
      )
      .set('Authorization', `Bearer ${token}`);

  const progressOf = async (studentId: string) => {
    const p = await progressRepo.findProgress(studentId, courseId, versionId);
    return {
      currentModule: p?.currentModule?.toString(),
      currentSection: p?.currentSection?.toString(),
      currentItem: p?.currentItem?.toString(),
      completed: p?.completed,
    };
  };

  const putModule = (
    value: boolean | null,
    token = 'test-token',
    id = moduleId,
  ) =>
    request(app)
      .put(`/courses/versions/${versionId}/modules/${id}/study-mode`)
      .set('Authorization', `Bearer ${token}`)
      .send({studyModeEnabled: value});
  const putSection = (
    value: boolean | null,
    token = 'test-token',
    id = sectionId,
  ) =>
    request(app)
      .put(
        `/courses/versions/${versionId}/modules/${moduleId}/sections/${id}/study-mode`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({studyModeEnabled: value});
  const putItem = (
    itemId: string,
    value: boolean | null,
    token = 'test-token',
  ) =>
    request(app)
      .put(`/courses/versions/${versionId}/items/${itemId}/study-mode`)
      .set('Authorization', `Bearer ${token}`)
      .send({studyModeEnabled: value});

  async function readStructure() {
    const body = (
      await admin(request(app).get(`/courses/versions/${versionId}`)).expect(
        200,
      )
    ).body;
    const version = body.modules ? body : body.version;
    const module = version.modules.find((m: any) => m.moduleId === moduleId);
    const section = module.sections.find((s: any) => s.sectionId === sectionId);
    const listed = (
      await admin(
        request(app).get(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        ),
      ).expect(200)
    ).body;
    const items = Array.isArray(listed) ? listed : listed.items;
    return {module, section, items};
  }

  const base = () =>
    `/users/progress/courses/${courseId}/versions/${versionId}`;
  const record = (token: string, itemId: string, at = {moduleId, sectionId}) =>
    request(app)
      .post(`${base()}/study-views`)
      .set('Authorization', `Bearer ${token}`)
      .send({itemId, ...at});
  const progress = (token: string) =>
    request(app)
      .get(`${base()}/study-progress`)
      .set('Authorization', `Bearer ${token}`);

  async function studyViewDocs() {
    const col = await db.getCollection<any>('studyViews');
    return col.find({courseVersionId: new ObjectId(versionId)}).toArray();
  }

  /** A strict-mode completion, as the watch-time pipeline records it. */
  async function completeInStrict(studentId: string, itemId: string) {
    const col = await db.getCollection<any>('watchTime');
    await col.insertOne({
      userId: new ObjectId(studentId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(versionId),
      itemId: new ObjectId(itemId),
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(),
      cohortId: null,
    });
  }

  describe('recording', () => {
    it('records a video once, keeps the first time, and leaves strict progress alone', async () => {
      await seedCourse();
      const video = await addVideo();
      const {token, studentId} = await enrollStudent();
      const before = await progressRepo.findProgress(
        studentId,
        courseId,
        versionId,
      );

      await record(token, video).expect(ok(200));
      const [first] = await studyViewDocs();
      expect(first.itemId.toString()).toBe(video);
      await record(token, video).expect(ok(200));
      const docs = await studyViewDocs();
      expect(docs).toHaveLength(1);
      expect(docs[0].firstStudiedAt).toEqual(first.firstStudiedAt);

      const after = await progressRepo.findProgress(
        studentId,
        courseId,
        versionId,
      );
      expect(after?.currentItem?.toString()).toBe(
        before?.currentItem?.toString(),
      );
      expect(after?.completed).toBe(before?.completed);
    }, 90000);

    it('rejects a quiz (400), a disabled lesson (403) and a lesson from elsewhere (404), storing nothing', async () => {
      await seedCourse();
      const quiz = await addQuiz();
      const video = await addVideo();
      const {token} = await enrollStudent();
      expect((await record(token, quiz)).status).toBe(400);
      await putModule(false).expect(200);
      const disabled = await record(token, video);
      expect(disabled.status).toBe(403);
      expect(disabled.body.name).toBe('STUDY_MODE_DISABLED');
      expect((await record(token, new ObjectId().toString())).status).toBe(404);
      expect(await studyViewDocs()).toHaveLength(0);
    }, 90000);

    it('rejects a user who is not enrolled', async () => {
      await seedCourse();
      const video = await addVideo();
      const outsiderId = await userRepo.create({
        firebaseUID: faker.string.uuid(),
        email: faker.internet.email(),
        firstName: 'Not',
        lastName: 'Enrolled',
        roles: 'user',
      });
      registerTestUser(`outsider-${outsiderId}`, outsiderId, 'user');
      expect((await record(`outsider-${outsiderId}`, video)).status).toBe(403);
      expect(await studyViewDocs()).toHaveLength(0);
    }, 90000);

    it('does not store a view for an instructor', async () => {
      await seedCourse();
      const video = await addVideo();
      const res = await record('test-token', video).expect(ok(200));
      expect(res.body).toEqual({recorded: false});
      expect(await studyViewDocs()).toHaveLength(0);
    }, 90000);
  });

  describe('progress', () => {
    it('counts study views and strict completions over study-allowed videos and articles only', async () => {
      await seedCourse();
      const v1 = await addVideo();
      const v2 = await addVideo();
      await addQuiz();
      const otherSection = await addSection();
      const strictOnly = await addVideo(otherSection);
      await putSection(false, 'test-token', otherSection).expect(200);
      const v3 = await addVideo();
      const {token, studentId} = await enrollStudent();

      await record(token, v1).expect(ok(200));
      await completeInStrict(studentId, v2);
      await completeInStrict(studentId, strictOnly);

      const res = await progress(token).expect(ok(200));
      expect(res.body).toMatchObject({
        studiedItems: 2,
        totalItems: 3,
        percentStudied: 67,
      });
      expect([...res.body.studiedItemIds].sort()).toEqual([v1, v2].sort());
      expect(res.body.studiedItemIds).not.toContain(v3);
    }, 90000);

    it('follows the teacher turning study mode off for a studied lesson', async () => {
      await seedCourse();
      const v1 = await addVideo();
      await addVideo();
      const {token} = await enrollStudent();
      await record(token, v1).expect(ok(200));
      await putItem(v1, false).expect(200);
      expect((await progress(token).expect(ok(200))).body).toMatchObject({
        studiedItems: 0,
        totalItems: 1,
      });
      await putItem(v1, null).expect(200);
      expect((await progress(token).expect(ok(200))).body).toMatchObject({
        studiedItems: 1,
        totalItems: 2,
      });
    }, 90000);

    it('shows each student’s study progress in the teacher’s enrollment list, progress unchanged', async () => {
      await seedCourse();
      const v1 = await addVideo();
      await addVideo();
      const {token, studentId} = await enrollStudent();
      await record(token, v1).expect(ok(200));
      const list = await admin(
        request(app).get(
          `/users/enrollments/courses/${courseId}/versions/${versionId}`,
        ),
      ).expect(ok(200));
      const entries = list.body.enrollments;
      const student = entries.find(
        (e: any) => e.user._id?.toString() === studentId,
      );
      expect(student.studyProgress).toEqual({
        studiedItems: 1,
        totalItems: 2,
        percentStudied: 50,
      });
      expect(student.progress).toBe(0);
      const staff = entries.find((e: any) => e.role !== 'STUDENT');
      if (staff) expect(staff.studyProgress).toBeNull();
    }, 90000);
  });
});
