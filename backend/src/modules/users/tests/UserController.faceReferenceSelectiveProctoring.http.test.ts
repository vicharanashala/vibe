import Express from 'express';
import {
  RoutingControllersOptions,
  useContainer,
  useExpressServer,
} from 'routing-controllers';
import request from 'supertest';
import {faker} from '@faker-js/faker';
import {Container} from 'inversify';
import {describe, it, expect, beforeAll, vi} from 'vitest';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {coursesContainerModules} from '#root/modules/courses/index.js';
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
import {CourseController} from '#root/modules/courses/controllers/CourseController.js';
import {CourseVersionController} from '#root/modules/courses/controllers/CourseVersionController.js';
import {ModuleController} from '#root/modules/courses/controllers/ModuleController.js';
import {SectionController} from '#root/modules/courses/controllers/SectionController.js';
import {ItemController} from '#root/modules/courses/controllers/ItemController.js';
import {EnrollmentController} from '#root/modules/users/controllers/EnrollmentController.js';
import {UserController} from '#root/modules/users/controllers/UserController.js';
import {CourseSettingController} from '#root/modules/setting/controllers/CourseSettingController.js';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {currentUserChecker} from '#root/shared/functions/currentUserChecker.js';
import {UserRepository} from '#root/shared/database/providers/mongo/repositories/UserRepository.js';
import {ProctoringComponent} from '#root/shared/database/interfaces/ISettingRepository.js';
import {ItemType} from '#root/shared/interfaces/models.js';

/**
 * End-to-end HTTP reproduction of the face-reference selective-proctoring
 * bug: a real Express app, real DI-wired UserController -> UserService /
 * CourseSettingService / ItemRepo / CourseRepo, and a real MongoDB
 * (mongodb-memory-server) -- not a mocked unit test.
 *
 * Unlike SelectiveProctoring.test.ts, every authenticated request here sets
 * its own Authorization header directly (that file's shared
 * creationFunctions.ts helpers never do, which 401s every call under its
 * header-only authorizationChecker -- a pre-existing, unrelated gap,
 * confirmed by reverting to an unmodified checkout and seeing the same
 * failure). Building course/version/module/section/item structure locally
 * here, with real headers, avoids that gap entirely.
 */
function allDetectors(enabledDetectorNames: ProctoringComponent[] = []) {
  return Object.values(ProctoringComponent).map(detectorName => ({
    detectorName,
    settings: {enabled: enabledDetectorNames.includes(detectorName)},
  }));
}

describe('UserController.getCurrentUserFaceReference -- selective proctoring, real HTTP', () => {
  const App = Express();
  let app: any;
  let courseId: string;
  let versionId: string;
  let moduleId: string;
  let sectionId: string;
  let studentToken: string;
  const embedding = Array.from({length: 128}, (_, i) => i / 128);

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

    const userRepo = container.get<UserRepository>(GLOBAL_TYPES.UserRepo);
    const tokenToUserId = new Map<string, string>();
    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockImplementation(async (token: string) => {
      const userId = tokenToUserId.get(token);
      if (!userId) throw new Error(`No mocked identity for token "${token}"`);
      // Re-reads the live document every call -- getCurrentUserFaceReference
      // reads profileImage/faceEmbedding straight off this return value, so
      // a static {_id, roles} stub (this test's first draft) always comes
      // back with neither, regardless of what PATCH /me/face-reference
      // actually saved.
      return await userRepo.findById(userId);
    });

    const options: RoutingControllersOptions = {
      controllers: [
        CourseController,
        CourseVersionController,
        ModuleController,
        SectionController,
        ItemController,
        EnrollmentController,
        UserController,
        CourseSettingController,
      ],
      authorizationChecker: async action =>
        !!action.request.headers['authorization']?.split(' ')[1],
      currentUserChecker,
      defaultErrorHandler: true,
      validation: true,
    };
    app = useExpressServer(App, options);

    const instructorId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: 'Instructor',
      lastName: 'Account',
      // Course/module/item/proctoring-setting creation is admin-only
      // platform-wide, not unlocked by instructor status.
      roles: 'admin',
    } as any);
    tokenToUserId.set('test-token', instructorId);

    // Real course/version/module/section, created through the real HTTP
    // endpoints (unlike creationFunctions.ts, every call here is
    // authenticated).
    const courseRes = await request(app)
      .post('/courses')
      .send({
        name: 'Selective Proctoring Face Ref Test Course',
        description: 'Covers the face-reference selective-proctoring bug',
        versionName: 'Version 1',
        versionDescription: 'Initial version',
      })
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    courseId = courseRes.body._id;

    const versionRes = await request(app)
      .post(`/courses/${courseId}/versions`)
      .send({version: '1.0', description: 'v1'})
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    versionId = versionRes.body._id;

    // Course-wide proctoring: FACE_RECOGNITION off by default. Each test
    // below sets the item-level override it actually needs. Set before any
    // module/item creation -- module creation reads the course's HP-system
    // flag (CourseVersionService -> SettingRepository.getisHpSystemEnabled),
    // which null-derefs on a version with no courseSettings doc yet; a real
    // deployment always has one by the time a module gets added, a fresh
    // test DB doesn't unless it's seeded first.
    await request(app)
      .put(`/setting/course-setting/${courseId}/${versionId}/proctoring`)
      .set('Authorization', 'Bearer test-token')
      .send({
        detectors: allDetectors([]),
        linearProgressionEnabled: false,
        seekForwardEnabled: true,
      })
      .expect(200);

    const moduleRes = await request(app)
      .post(`/courses/versions/${versionId}/modules`)
      .send({name: 'Module 1', description: 'Module 1'})
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    moduleId = moduleRes.body.version.modules[0].moduleId;

    const sectionRes = await request(app)
      .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
      .send({name: 'Section 1', description: 'Section 1'})
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

    // Real student, enrolled, with a real registered face.
    const studentId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: 'Test',
      lastName: 'Student',
      roles: 'user',
    } as any);
    studentToken = `student-token-${studentId}`;
    tokenToUserId.set(studentToken, studentId);

    await request(app)
      .post(
        `/users/${studentId}/enrollments/courses/${courseId}/versions/${versionId}`,
      )
      .set('Authorization', 'Bearer test-token')
      .send({role: 'STUDENT'})
      .expect(200);

    await request(app)
      .patch('/users/me/face-reference')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        profileImage: 'data:image/png;base64,iVBORw0KGgo=',
        faceEmbedding: embedding,
      })
      .expect(200);
  }, 120000);

  async function createItem() {
    const res = await request(app)
      .post(
        `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
      )
      .send({
        name: 'Quiz Item',
        description: 'Quiz Item',
        type: ItemType.QUIZ,
        quizDetails: {
          questionVisibility: 3,
          allowPartialGrading: true,
          allowSkip: false,
          deadline: faker.date.future(),
          allowHint: true,
          maxAttempts: 5,
          releaseTime: faker.date.future(),
          quizType: 'DEADLINE',
          showCorrectAnswersAfterSubmission: true,
          showExplanationAfterSubmission: true,
          showScoreAfterSubmission: true,
          approximateTimeToComplete: '00:30:00',
          passThreshold: 0.7,
        },
      })
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    const items = res.body.itemsGroup.items;
    return items[items.length - 1]._id as string;
  }

  async function putItemDetectors(
    itemId: string,
    detectors: ReturnType<typeof allDetectors> | null,
  ) {
    await request(app)
      .put(`/courses/versions/${versionId}/items/${itemId}/proctoring`)
      .set('Authorization', 'Bearer test-token')
      .send({detectors})
      .expect(200);
  }

  async function putModuleDetectors(
    detectors: ReturnType<typeof allDetectors> | null,
  ) {
    await request(app)
      .put(`/courses/versions/${versionId}/modules/${moduleId}/proctoring`)
      .set('Authorization', 'Bearer test-token')
      .send({detectors})
      .expect(200);
  }

  async function getFaceReference(itemId?: string, moduleIdForQuery?: string) {
    const query: Record<string, string> = {courseId, versionId};
    if (itemId) query.itemId = itemId;
    if (moduleIdForQuery) query.moduleId = moduleIdForQuery;
    const res = await request(app)
      .get('/users/me/face-reference')
      .set('Authorization', `Bearer ${studentToken}`)
      .query(query)
      .expect(200);
    return res.body as {faceEmbedding: number[] | null};
  }

  it('course-level FACE_RECOGNITION off, item override turns it on -> embedding only returned when itemId is supplied', async () => {
    const itemId = await createItem();
    await putItemDetectors(
      itemId,
      allDetectors([ProctoringComponent.FACERECOGNITION]),
    );

    const withoutItemId = await getFaceReference();
    expect(withoutItemId.faceEmbedding).toBeNull();

    const withItemId = await getFaceReference(itemId);
    expect(withItemId.faceEmbedding).toEqual(embedding);

    // Clean up this item's override so later tests in this file see the
    // course-wide default again.
    await putItemDetectors(itemId, null);
  }, 60000);

  it('course-level FACE_RECOGNITION off, item override turns it off too -> embedding stays withheld with itemId supplied', async () => {
    const itemId = await createItem();
    await putItemDetectors(itemId, allDetectors([]));

    const withItemId = await getFaceReference(itemId);
    expect(withItemId.faceEmbedding).toBeNull();
  }, 60000);

  it('module override enables FACE_RECOGNITION, item unset -> resolves through the module tier via moduleId', async () => {
    const itemId = await createItem();
    await putModuleDetectors(
      allDetectors([ProctoringComponent.FACERECOGNITION]),
    );

    const withoutModuleId = await getFaceReference(itemId);
    expect(withoutModuleId.faceEmbedding).toBeNull();

    const withModuleId = await getFaceReference(itemId, moduleId);
    expect(withModuleId.faceEmbedding).toEqual(embedding);

    await putModuleDetectors(null);
  }, 60000);
});
