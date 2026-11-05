import { coursesContainerModules, coursesModuleOptions } from '../index.js';
import { useExpressServer, useContainer, RoutingControllersOptions } from 'routing-controllers';
import { anomaliesContainerModule } from '#root/modules/anomalies/container.js';
import { settingContainerModule } from '#root/modules/setting/container.js';
import { courseRegistrationContainerModule } from '#root/modules/courseRegistration/container.js';
import { projectsContainerModule } from '#root/modules/projects/container.js';
import { reportsContainerModule } from '#root/modules/reports/container.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { hpSystemContainerModule } from '#root/modules/hpSystem/container.js';
import { ejectionPolicyContainerModule } from '#root/modules/ejectionPolicy/container.js';
import { emotionsContainerModule } from '#root/modules/emotions/container.js';
import { genAIContainerModule } from '#root/modules/genAI/container.js';
import { studentQuestionsContainerModule } from '#root/modules/studentQuestions/container.js';
import { announcementsContainerModule } from '#root/modules/announcements/container.js';
import { auditTrailsContainerModule } from '#root/modules/auditTrails/container.js';
import Express from 'express';
import request from 'supertest';
import {
  createCourse,
  createVersion,
  createModule,
  createSection,
  createQuizItem,
} from './utils/creationFunctions.js';
import { faker } from '@faker-js/faker';
import {
  describe,
  it,
  expect,
  beforeAll,
  vi,
} from 'vitest';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { Container } from 'inversify';
import { CourseController } from '../controllers/CourseController.js';
import { CourseVersionController } from '../controllers/CourseVersionController.js';
import { ItemController } from '../controllers/ItemController.js';
import { ModuleController } from '../controllers/ModuleController.js';
import { SectionController } from '../controllers/SectionController.js';
import { EnrollmentController } from '#root/modules/users/controllers/EnrollmentController.js';
import { CourseSettingController } from '#root/modules/setting/controllers/CourseSettingController.js';
import { AnomalyController } from '#root/modules/anomalies/controllers/AnomalyController.js';
import { AnomalyType } from '#root/modules/anomalies/classes/transformers/Anomaly.js';
import { CloudStorageService } from '#root/modules/anomalies/services/CloudStorageService.js';
import { FirebaseAuthService } from '#root/modules/auth/services/FirebaseAuthService.js';
import { currentUserChecker } from '#root/shared/functions/currentUserChecker.js';
import { UserRepository } from '#root/shared/database/providers/mongo/repositories/UserRepository.js';
import { ProctoringComponent } from '#root/shared/database/interfaces/ISettingRepository.js';

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

const validImageBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

// A course-settings PUT payload must list every ProctoringComponent
// (enforced by @containsAllDetectors) even when the test only cares about
// one detector's on/off state. Item/module override PUTs share the same
// constraint (both validated by the same containsAllDetectors decorator).
function allDetectors(enabledDetectorNames: ProctoringComponent[] = []) {
  return Object.values(ProctoringComponent).map(detectorName => ({
    detectorName,
    settings: { enabled: enabledDetectorNames.includes(detectorName) },
  }));
}

/**
 * Bypasses Firebase entirely (no `/auth/signup`, no real token verification)
 * -- same technique as ProgressService.attemptedItemBypassDeadlock.test.ts:
 * a real user doc via `userRepo.create`, `authorizationChecker: async () =>
 * true` so `@Authorized()` never touches Firebase, and a token->identity map
 * mocked directly on `FirebaseAuthService.getCurrentUserFromToken` (which
 * both `@CurrentUser()` and `@Ability()` resolve through). 'Bearer
 * test-token' resolving to a global admin matches every other suite in this
 * module, so course/module/item setup calls need no per-test re-mocking.
 */
describe('Selective Proctoring Integration Tests', () => {
  const App = Express();
  let app;
  let courseId: string;
  let versionId: string;
  let moduleId: string;
  let sectionId: string;
  let studentToken: string;
  let instructorId: string;
  let userRepo: UserRepository;
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
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    userRepo = container.get<UserRepository>(GLOBAL_TYPES.UserRepo);
    const tokenToUser = new Map<string, { _id: string; roles: string }>();
    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockImplementation(async (token: string) => {
      const user = tokenToUser.get(token);
      if (!user) throw new Error(`No mocked identity for token "${token}"`);
      return user as any;
    });
    registerTestUser = (token: string, id: string, roles: string) =>
      tokenToUser.set(token, { _id: id, roles });

    const options: RoutingControllersOptions = {
      controllers: controllers,
      middlewares: coursesModuleOptions.middlewares,
      defaultErrorHandler: coursesModuleOptions.defaultErrorHandler,
      // Real token verification needs Firebase (deliberately not used in
      // this suite -- see the class doc comment). Checking for a token's
      // mere presence still gives @Authorized() the same true/false shape a
      // real checker would, so a request with no Authorization header still
      // 401s the way it does in production, instead of reaching @Ability's
      // own (differently-typed) missing-token error.
      authorizationChecker: async action =>
        !!action.request.headers['authorization']?.split(' ')[1],
      currentUserChecker,
      validation: coursesModuleOptions.validation,
    };
    app = useExpressServer(App, options);

    instructorId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: 'Instructor',
      lastName: 'Account',
      roles: 'user',
    });
    registerTestUser('test-token', instructorId, 'admin');

    // uploadAnomaly hits real Google Cloud Storage, which has no credentials
    // in this test environment -- mock it so the AnomalyController tests
    // below only exercise the FACE_RECOGNITION gate, not real cloud storage
    // (same technique AnomalyController.test.ts already uses).
    vi.spyOn(CloudStorageService.prototype, 'uploadAnomaly').mockResolvedValue(
      'mock/anomaly/path.jpg',
    );
  }, 90000);

  async function seedCourseStructure() {
    const course = await createCourse(app);
    courseId = course._id.toString();
    // CourseVersionController.create auto-enrolls its caller as INSTRUCTOR
    // for the version it just made, so no separate enrollment call is needed
    // for the instructor here.
    const version = await createVersion(app, courseId);
    versionId = (version as any)._id.toString();
    const moduleResponse = await createModule(app, versionId);
    moduleId = moduleResponse.version.modules[0].moduleId.toString();
    const sectionResponse = await createSection(app, versionId, moduleId);
    sectionId =
      sectionResponse.version.modules[0].sections[0].sectionId.toString();
  }

  async function enrollStudent() {
    const studentId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: 'Student',
      lastName: 'Account',
      roles: 'user',
    });
    studentToken = `student-token-${studentId}`;
    registerTestUser(studentToken, studentId, 'user');

    // Enrollment always seeds progress at the course's actual first item,
    // regardless of which item this student cares about -- readItem doesn't
    // require the item under test to be the student's "current" item as long
    // as linear progression is off (every test here sets it off), so no
    // itemId/sectionId argument is needed, unlike createEnrollment's helper
    // (which asserts progress against a caller-supplied "first item" and so
    // only fits a student who's actually meant to start there).
    await request(app)
      .post(`/users/${studentId}/enrollments/courses/${courseId}/versions/${versionId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ role: 'STUDENT' })
      .expect(200);
    return studentToken;
  }

  async function setUniversalProctoring(enabledDetectorNames: ProctoringComponent[]) {
    await request(app)
      .put(`/setting/course-setting/${courseId}/${versionId}/proctoring`)
      .set('Authorization', 'Bearer test-token')
      .send({
        detectors: allDetectors(enabledDetectorNames),
        linearProgressionEnabled: false,
        seekForwardEnabled: true,
      })
      .expect(200);
  }

  async function putItemDetectors(itemId: string, detectors: ReturnType<typeof allDetectors> | null) {
    await request(app)
      .put(`/courses/versions/${versionId}/items/${itemId}/proctoring`)
      .set('Authorization', 'Bearer test-token')
      .send({ detectors })
      .expect(200);
  }

  async function putModuleDetectors(id: string, detectors: ReturnType<typeof allDetectors> | null) {
    await request(app)
      .put(`/courses/versions/${versionId}/modules/${id}/proctoring`)
      .set('Authorization', 'Bearer test-token')
      .send({ detectors })
      .expect(200);
  }

  async function getItemAsStudent(
    itemId: string,
    itemSectionId = sectionId,
    token = studentToken,
  ) {
    const res = await request(app)
      .get(
        `/courses/${courseId}/versions/${versionId}/modules/${moduleId}/sections/${itemSectionId}/item/${itemId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return res.body.item;
  }

  function isProctored(item: any) {
    return (item.proctoringDetectors ?? []).some((d: any) => d.settings.enabled);
  }

  it('universal proctoring on, no overrides -> item resolves proctored for the student', async () => {
    await seedCourseStructure();
    const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemId = (itemResponse as any).itemsGroup.items[0]._id;

    await setUniversalProctoring([ProctoringComponent.CAMERAMICRO]);
    await enrollStudent();
    const item = await getItemAsStudent(itemId);
    expect(isProctored(item)).toBe(true);
  }, 90000);

  it('universal off, item override enables a specific detector -> resolves proctored with exactly that subset', async () => {
    await seedCourseStructure();
    const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemId = (itemResponse as any).itemsGroup.items[0]._id;

    await setUniversalProctoring([]);
    await putItemDetectors(itemId, allDetectors([ProctoringComponent.BLURDETECTION]));

    await enrollStudent();
    const item = await getItemAsStudent(itemId);
    expect(item.proctoringDetectors).toEqual(allDetectors([ProctoringComponent.BLURDETECTION]));
    expect(isProctored(item)).toBe(true);
  }, 90000);

  it('universal on, item override to all-off -> resolves not proctored (selective exception)', async () => {
    await seedCourseStructure();
    const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemId = (itemResponse as any).itemsGroup.items[0]._id;

    await setUniversalProctoring([ProctoringComponent.CAMERAMICRO]);
    await putItemDetectors(itemId, allDetectors([]));

    await enrollStudent();
    const item = await getItemAsStudent(itemId);
    expect(isProctored(item)).toBe(false);
  }, 90000);

  it('module override present, item unset, universal off -> resolves proctored (module tier applies)', async () => {
    await seedCourseStructure();
    const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemId = (itemResponse as any).itemsGroup.items[0]._id;

    await setUniversalProctoring([]);
    await putModuleDetectors(moduleId, allDetectors([ProctoringComponent.FACECOUNTDETECTION]));

    await enrollStudent();
    const item = await getItemAsStudent(itemId);
    expect(item.proctoringDetectors).toEqual(allDetectors([ProctoringComponent.FACECOUNTDETECTION]));
  }, 90000);

  it('item override wins over a conflicting module override, which wins over universal', async () => {
    await seedCourseStructure();
    const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemId = (itemResponse as any).itemsGroup.items[0]._id;

    await setUniversalProctoring([]);
    await putModuleDetectors(moduleId, allDetectors([]));
    await putItemDetectors(itemId, allDetectors([ProctoringComponent.VOICEDETECTION]));

    await enrollStudent();
    const item = await getItemAsStudent(itemId);
    expect(item.proctoringDetectors).toEqual(allDetectors([ProctoringComponent.VOICEDETECTION]));
  }, 90000);

  it('two items in the same module with different explicit overrides resolve independently', async () => {
    await seedCourseStructure();
    const itemA = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemAId = (itemA as any).itemsGroup.items[0]._id;
    // A second section in the same module -- createQuizItem's own helper
    // asserts a single-item itemsGroup, so a second item needs a fresh
    // itemsGroup (i.e. section) rather than reusing sectionId.
    const sectionB = await createSection(app, versionId, moduleId);
    const sectionBId = (
      sectionB.version.modules[0].sections.find(
        (s: any) => s.sectionId !== sectionId,
      ).sectionId as {toString(): string}
    ).toString();
    const itemB = await createQuizItem(app, versionId, moduleId, sectionBId);
    const itemBId = (itemB as any).itemsGroup.items[0]._id;

    await setUniversalProctoring([]);
    await putItemDetectors(itemAId, allDetectors([ProctoringComponent.CAMERAMICRO]));
    await putItemDetectors(itemBId, allDetectors([]));

    // Read back as the instructor (bypasses readItem's student-only
    // linear-progression eligibility gate, which is unrelated to what this
    // test checks) to confirm the two items' overrides were persisted and
    // stayed isolated from each other rather than one write clobbering the
    // other's stored value.
    const rereadItemA = await request(app)
      .get(`/courses/${courseId}/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/item/${itemAId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    const rereadItemB = await request(app)
      .get(`/courses/${courseId}/versions/${versionId}/modules/${moduleId}/sections/${sectionBId}/item/${itemBId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    expect(rereadItemA.body.item.proctoringDetectors).toEqual(allDetectors([ProctoringComponent.CAMERAMICRO]));
    expect(rereadItemB.body.item.proctoringDetectors).toEqual(allDetectors([]));
  }, 90000);

  it('an item with no override field at all (pre-existing content) resolves exactly as universal alone dictates', async () => {
    await seedCourseStructure();
    const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemId = (itemResponse as any).itemsGroup.items[0]._id;
    // No PUT .../proctoring call at all -- item/module fields stay absent,
    // exactly like every item that existed before this feature shipped.

    await setUniversalProctoring([ProctoringComponent.CAMERAMICRO]);
    await enrollStudent();
    expect(isProctored(await getItemAsStudent(itemId))).toBe(true);

    await setUniversalProctoring([]);
    expect(isProctored(await getItemAsStudent(itemId))).toBe(false);
  }, 90000);

  it('clearing an item override (detectors: null) reverts to inherited value', async () => {
    await seedCourseStructure();
    const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemId = (itemResponse as any).itemsGroup.items[0]._id;

    await setUniversalProctoring([ProctoringComponent.CAMERAMICRO]);
    await putItemDetectors(itemId, allDetectors([]));
    await putItemDetectors(itemId, null);

    await enrollStudent();
    const item = await getItemAsStudent(itemId);
    expect(isProctored(item)).toBe(true);
  }, 90000);

  it('rejects a STUDENT-role caller on both new PUT endpoints, and an unauthenticated caller', async () => {
    await seedCourseStructure();
    const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemId = (itemResponse as any).itemsGroup.items[0]._id;
    await enrollStudent();

    await request(app)
      .put(`/courses/versions/${versionId}/items/${itemId}/proctoring`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ detectors: allDetectors([ProctoringComponent.CAMERAMICRO]) })
      .expect(403);
    await request(app)
      .put(`/courses/versions/${versionId}/modules/${moduleId}/proctoring`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ detectors: allDetectors([ProctoringComponent.CAMERAMICRO]) })
      .expect(403);

    await request(app)
      .put(`/courses/versions/${versionId}/items/${itemId}/proctoring`)
      .send({ detectors: allDetectors([ProctoringComponent.CAMERAMICRO]) })
      .expect(401);
    await request(app)
      .put(`/courses/versions/${versionId}/modules/${moduleId}/proctoring`)
      .send({ detectors: allDetectors([ProctoringComponent.CAMERAMICRO]) })
      .expect(401);
  }, 90000);

  it('an INSTRUCTOR succeeds on both new PUT endpoints', async () => {
    await seedCourseStructure();
    const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
    const itemId = (itemResponse as any).itemsGroup.items[0]._id;

    await putItemDetectors(itemId, allDetectors([ProctoringComponent.CAMERAMICRO]));
    await putModuleDetectors(moduleId, allDetectors([ProctoringComponent.CAMERAMICRO]));
  }, 90000);

  describe('AnomalyController FACE_RECOGNITION gate respects item-level overrides', () => {
    async function postFaceRecognitionAnomaly(itemId: string, moduleIdForBody?: string) {
      return request(app)
        .post('/anomalies/record/image')
        .set('Authorization', 'Bearer test-token')
        .field('type', AnomalyType.FACE_RECOGNITION)
        .field('courseId', courseId)
        .field('versionId', versionId)
        .field('itemId', itemId)
        .field('moduleId', moduleIdForBody ?? moduleId)
        .attach('image', validImageBuffer, 'test-image.png');
    }

    it('course-level FACE_RECOGNITION on, item override turns it off -> rejected', async () => {
      await seedCourseStructure();
      const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
      const itemId = (itemResponse as any).itemsGroup.items[0]._id;

      await setUniversalProctoring([ProctoringComponent.FACERECOGNITION]);
      await putItemDetectors(itemId, allDetectors([])); // explicitly off for this item

      const res = await postFaceRecognitionAnomaly(itemId);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Face recognition is disabled/i);
    }, 90000);

    it('course-level FACE_RECOGNITION off, item override turns it on -> accepted', async () => {
      await seedCourseStructure();
      const itemResponse = await createQuizItem(app, versionId, moduleId, sectionId);
      const itemId = (itemResponse as any).itemsGroup.items[0]._id;

      await setUniversalProctoring([]);
      await putItemDetectors(itemId, allDetectors([ProctoringComponent.FACERECOGNITION]));

      const res = await postFaceRecognitionAnomaly(itemId);
      expect(res.status).toBe(201);
    }, 90000);
  });
});
