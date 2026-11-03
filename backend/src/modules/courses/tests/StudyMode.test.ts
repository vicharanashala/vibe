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
import {describe, it, expect, beforeAll, vi} from 'vitest';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container} from 'inversify';
import {CourseController} from '../controllers/CourseController.js';
import {CourseVersionController} from '../controllers/CourseVersionController.js';
import {ItemController} from '../controllers/ItemController.js';
import {ModuleController} from '../controllers/ModuleController.js';
import {SectionController} from '../controllers/SectionController.js';
import {EnrollmentController} from '#root/modules/users/controllers/EnrollmentController.js';
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
  CourseSettingController,
  AnomalyController,
];

/**
 * Study-mode setting on modules, sections and items (spec backend/study-mode).
 * Same Firebase-free harness as SelectiveProctoring.test.ts: 'Bearer
 * test-token' is a global admin; students get their own mocked tokens.
 */
describe('Study mode', () => {
  const App = Express();
  let app;
  let courseId: string;
  let versionId: string;
  let moduleId: string;
  let sectionId: string;
  let userRepo: UserRepository;
  let itemRepo: IItemRepository;
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
    useContainer(new InversifyAdapter(container));
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
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

  describe('teacher endpoints', () => {
    it('sets and clears the setting on a module, a section and an item, and the structure reports each own value', async () => {
      await seedCourse();
      const itemId = await addVideo();

      await putModule(false).expect(200);
      await putSection(true).expect(200);
      const itemRes = await putItem(itemId, false).expect(200);
      expect(itemRes.body).toEqual({itemId, studyModeEnabled: false});

      let s = await readStructure();
      expect(s.module.studyModeEnabled).toBe(false);
      expect(s.section.studyModeEnabled).toBe(true);
      expect(s.items.find((i: any) => i._id === itemId).studyModeEnabled).toBe(
        false,
      );

      await putModule(null).expect(200);
      await putSection(null).expect(200);
      await putItem(itemId, null).expect(200);

      s = await readStructure();
      expect(s.module.studyModeEnabled ?? null).toBeNull();
      expect(s.section.studyModeEnabled ?? null).toBeNull();
      expect(
        s.items.find((i: any) => i._id === itemId).studyModeEnabled ?? null,
      ).toBeNull();
    }, 90000);

    it('keeps an item setting when the section item list is read and written back (as hide and reorder do)', async () => {
      await seedCourse();
      const kept = await addVideo();
      const other = await addVideo();
      await putItem(kept, false).expect(200);

      // readItemsGroup rebuilds refs from an allowlist and updateItemsGroup
      // writes the whole array back -- the cycle every hide/reorder runs.
      const version = (
        await admin(request(app).get(`/courses/versions/${versionId}`)).expect(
          200,
        )
      ).body;
      const groupId = version.modules[0].sections[0].itemsGroupId.toString();
      const group = await itemRepo.readItemsGroup(groupId);
      group.items.find(i => i._id.toString() === other).isHidden = true;
      await itemRepo.updateItemsGroup(groupId, group, undefined);

      const {items} = await readStructure();
      expect(items.find((i: any) => i._id === kept).studyModeEnabled).toBe(
        false,
      );
    }, 90000);

    it('rejects a student with 403 and changes nothing', async () => {
      await seedCourse();
      const itemId = await addVideo();
      const {token} = await enrollStudent();

      await putModule(false, token).expect(403);
      await putSection(false, token).expect(403);
      await putItem(itemId, false, token).expect(403);

      const s = await readStructure();
      expect(s.module.studyModeEnabled ?? null).toBeNull();
      expect(s.section.studyModeEnabled ?? null).toBeNull();
      expect(s.items[0].studyModeEnabled ?? null).toBeNull();
    }, 90000);

    it('rejects an unknown module, section or item with 404', async () => {
      await seedCourse();
      const unknown = new ObjectId().toString();
      await putModule(false, 'test-token', unknown).expect(404);
      await putSection(false, 'test-token', unknown).expect(404);
      await putItem(unknown, false).expect(404);
    }, 90000);

    it('rejects a value that is not a boolean or null with 400', async () => {
      await seedCourse();
      await admin(
        request(app).put(
          `/courses/versions/${versionId}/modules/${moduleId}/study-mode`,
        ),
      )
        .send({studyModeEnabled: 'no'})
        .expect(400);
    }, 90000);
  });
  describe('study-mode lesson read', () => {
    it('reads ahead in a linear course without changing progress, while a normal read of the same item is still locked', async () => {
      await seedCourse();
      const first = await addVideo();
      await addVideo();
      const third = await addVideo();
      const {token, studentId} = await enrollStudent();
      const before = await progressOf(studentId);
      expect(before.currentItem).toBe(first);

      // Linear progression is on by default for a new course.
      const locked = await readLesson(third, token);
      expect(locked.status).toBe(403);
      expect(locked.body.name).toBe('ForbiddenError');

      const study = await readLesson(third, token, true);
      expect(study.status).toBe(201);
      expect(study.body.item._id).toBe(third);
      expect(study.body.item.studyMode).toEqual({
        allowed: true,
        source: 'default',
      });

      expect(await progressOf(studentId)).toEqual(before);
    }, 90000);

    it('reports the effective study mode on an ordinary read', async () => {
      await seedCourse();
      const first = await addVideo();
      const {token} = await enrollStudent();
      await putModule(false).expect(200);
      const res = await readLesson(first, token);
      expect(res.status).toBe(201);
      expect(res.body.item.studyMode).toEqual({
        allowed: false,
        source: 'module',
      });
    }, 90000);

    it('refuses an item whose study mode is disallowed, naming the level, and leaves progress alone', async () => {
      await seedCourse();
      await addVideo();
      const second = await addVideo();
      const {token, studentId} = await enrollStudent();
      const before = await progressOf(studentId);

      await putSection(false).expect(200);
      let res = await readLesson(second, token, true);
      expect(res.status).toBe(403);
      expect(res.body.name).toBe('STUDY_MODE_DISABLED');
      expect(res.body.details).toEqual({source: 'section'});

      // An item allowed inside the disallowed section opens.
      await putItem(second, true).expect(200);
      res = await readLesson(second, token, true);
      expect(res.status).toBe(201);
      expect(res.body.item.studyMode).toEqual({allowed: true, source: 'item'});

      expect(await progressOf(studentId)).toEqual(before);
    }, 90000);

    it('refuses a quiz in study mode', async () => {
      await seedCourse();
      const quiz = await addQuiz();
      const {token} = await enrollStudent();
      const res = await readLesson(quiz, token, true);
      expect(res.status).toBe(403);
      expect(res.body.name).toBe('STUDY_MODE_QUIZ');
    }, 90000);

    it('rejects a user who is not enrolled exactly as a normal read does', async () => {
      await seedCourse();
      const first = await addVideo();
      const outsiderId = await userRepo.create({
        firebaseUID: faker.string.uuid(),
        email: faker.internet.email(),
        firstName: 'Not',
        lastName: 'Enrolled',
        roles: 'user',
      });
      const token = `outsider-${outsiderId}`;
      registerTestUser(token, outsiderId, 'user');

      const normal = await readLesson(first, token);
      const study = await readLesson(first, token, true);
      expect(normal.status).toBeGreaterThanOrEqual(400);
      expect(study.status).toBe(normal.status);
      expect(study.body.message).toBe(normal.body.message);
    }, 90000);
  });
});
