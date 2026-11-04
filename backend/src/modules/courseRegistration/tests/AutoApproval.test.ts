import 'reflect-metadata';
import {coursesContainerModules, coursesModuleOptions} from '#courses/index.js';
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
import request from 'supertest';
import {faker} from '@faker-js/faker';
import {describe, it, expect, beforeAll, beforeEach, vi} from 'vitest';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container} from 'inversify';
import {ObjectId} from 'mongodb';
import {CourseController} from '#courses/controllers/CourseController.js';
import {CourseVersionController} from '#courses/controllers/CourseVersionController.js';
import {ItemController} from '#courses/controllers/ItemController.js';
import {ModuleController} from '#courses/controllers/ModuleController.js';
import {SectionController} from '#courses/controllers/SectionController.js';
import {CourseRegistrationController} from '../controllers/CourseRegistrationController.js';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {MailService} from '#root/modules/notifications/services/MailService.js';
import {currentUserChecker} from '#root/shared/functions/currentUserChecker.js';
import {UserRepository} from '#root/shared/database/providers/mongo/repositories/UserRepository.js';
import {ItemType} from '#root/shared/interfaces/models.js';

/**
 * Auto-approval on registration (spec
 * backend/course-registration-auto-approval), through the real endpoints.
 * Same Firebase-free harness as courses/tests/StudyMode.test.ts. Mail is
 * stubbed because approving sends the status email.
 */
describe('Registration auto-approval', () => {
  const App = Express();
  let app: any;
  let db: MongoDatabase;
  let courseId: string;
  let versionId: string;
  let userRepo: UserRepository;
  let registerTestUser: (token: string, id: string, roles: string) => void;
  let sendMail: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.IS_RECAPTCHA_ENABLED = 'false';
    sendMail = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(MailService.prototype, 'sendMail').mockImplementation(
      sendMail as any,
    );

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
        CourseRegistrationController,
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

  // Registering needs a course with content; approving enrols into it.
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
      .send({name: 'Module', description: 'A module'})
      .expect(ok(201));
    const moduleId = mod.body.version.modules[0].moduleId.toString();
    const sec = await admin(
      request(app).post(
        `/courses/versions/${versionId}/modules/${moduleId}/sections`,
      ),
    )
      .send({name: 'Section', description: 'A section'})
      .expect(ok(201));
    const sectionId = sec.body.version.modules[0].sections[0].sectionId;
    await admin(
      request(app).post(
        `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
      ),
    )
      .send({
        name: 'Video',
        description: 'A video',
        type: ItemType.VIDEO,
        videoDetails: {
          URL: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          startTime: '00:00:00',
          endTime: '00:05:00',
          points: 1,
        },
      })
      .expect(ok(201));
  }

  async function addCohort(): Promise<string> {
    await admin(
      request(app).post(`/courses/${courseId}/versions/${versionId}/cohorts`),
    )
      .send({newCohortName: faker.string.alpha(12).toLowerCase()})
      .expect(ok(200));
    const res = await admin(
      request(app).get(`/courses/${courseId}/versions/${versionId}/cohorts`),
    ).expect(ok(200));
    return res.body.cohorts[0].id ?? res.body.cohorts[0]._id;
  }

  const saveApproval = (body: Record<string, unknown>) =>
    admin(
      request(app).put(
        `/course/registration/auto-approval/version/${versionId}`,
      ),
    ).send(body);

  const readSettings = async () =>
    (
      await admin(
        request(app).get(
          `/course/registration/build-form/version/${versionId}`,
        ),
      ).expect(ok(200))
    ).body;

  async function register(
    email: string,
    form: Record<string, unknown> = {},
  ): Promise<{status: string; registrationId: string; studentId: string}> {
    const studentId = await userRepo.create({
      firebaseUID: faker.string.uuid(),
      email,
      firstName: 'Student',
      lastName: 'Account',
      roles: 'user',
    });
    const token = `student-${studentId}`;
    registerTestUser(token, studentId, 'user');
    const res = await request(app)
      .post(`/course/registration/version/${versionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({recaptchaToken: 'test', Name: 'Student', ...form})
      .expect(ok(201));
    return {...res.body, studentId};
  }

  const unique = () => faker.string.alphanumeric(10).toLowerCase();

  // Writes settings as a course saved before the mode existed would have them.
  async function storeLegacySettings(autoapproval_emails: string[]) {
    await db.getCollection('courseSettings').then(c =>
      c.updateOne(
        {courseVersionId: new ObjectId(versionId)},
        {
          $set: {
            'settings.registration.registrationsAutoApproved': true,
            'settings.registration.autoapproval_emails': autoapproval_emails,
          },
          $unset: {'settings.registration.autoApprovalMode': ''},
        },
      ),
    );
  }

  beforeEach(async () => {
    sendMail.mockClear();
    await seedCourse();
  });

  describe('registering', () => {
    it('approves and enrols a listed student, with the email', async () => {
      const email = `${unique()}@example.com`;
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [email],
      }).expect(ok(200));

      const {status, studentId} = await register(email);

      expect(status).toBe('APPROVED');
      expect(sendMail).toHaveBeenCalled();
      const enrollment = await db.getCollection('enrollment').then(c =>
        c.findOne({
          userId: new ObjectId(studentId),
          courseVersionId: new ObjectId(versionId),
        }),
      );
      expect(enrollment?.role).toBe('STUDENT');
    });

    it('keeps an address that only contains an entry pending', async () => {
      const entry = `${unique()}@example.com`;
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [entry],
      }).expect(ok(200));

      const {status} = await register(`jim${entry}`);

      expect(status).toBe('PENDING');
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('checks the account email, not one typed into the form', async () => {
      const listed = `${unique()}@example.com`;
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [listed],
      }).expect(ok(200));

      const {status} = await register(`${unique()}@other.com`, {
        Email: listed,
        email: listed,
      });

      expect(status).toBe('PENDING');
    });

    it('approves anyone with EVERYONE', async () => {
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'EVERYONE',
        autoapproval_emails: [],
      }).expect(ok(200));

      const {status} = await register(`${unique()}@other.com`);

      expect(status).toBe('APPROVED');
    });

    it('approves nobody with an empty LIST', async () => {
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [],
      }).expect(ok(200));

      const {status} = await register(`${unique()}@other.com`);

      expect(status).toBe('PENDING');
    });

    it('approves nobody when auto-approval is off', async () => {
      await saveApproval({
        registrationsAutoApproved: false,
        autoApprovalMode: 'EVERYONE',
        autoapproval_emails: [],
      }).expect(ok(200));

      const {status} = await register(`${unique()}@other.com`);

      expect(status).toBe('PENDING');
    });

    it('leaves a pending request alone when the list changes', async () => {
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [],
      }).expect(ok(200));
      const email = `${unique()}@example.com`;
      const {registrationId} = await register(email);

      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [email],
      }).expect(ok(200));

      const stored = await db
        .getCollection('course_registrations')
        .then(c => c.findOne({_id: new ObjectId(registrationId)}));
      expect(stored?.status).toBe('PENDING');
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('settings saved before the mode existed', () => {
    it('with no list: approves everyone, and reads as EVERYONE', async () => {
      await storeLegacySettings([]);

      expect((await readSettings()).autoApprovalMode).toBe('EVERYONE');
      expect((await register(`${unique()}@other.com`)).status).toBe('APPROVED');
    });

    it('with a list: reads as LIST and approves only matches', async () => {
      const email = `${unique()}@example.com`;
      await storeLegacySettings([email]);

      expect((await readSettings()).autoApprovalMode).toBe('LIST');
      expect((await register(`${unique()}@other.com`)).status).toBe('PENDING');
      expect((await register(email)).status).toBe('APPROVED');
    });
  });

  describe('saving', () => {
    it('normalises entries', async () => {
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [' Bob@Gmail.com ', 'bob@gmail.com'],
      }).expect(ok(200));

      expect((await readSettings()).autoapproval_emails).toEqual([
        'bob@gmail.com',
      ]);
    });

    it('rejects an invalid entry with 400 and changes nothing', async () => {
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: ['bob@gmail.com'],
      }).expect(ok(200));

      const res = await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: ['iitm'],
      }).expect(ok(400));

      expect(res.body.message).toContain('iitm');
      expect((await readSettings()).autoapproval_emails).toEqual([
        'bob@gmail.com',
      ]);
    });

    it('lets a teacher turn auto-approval off despite an old entry', async () => {
      await storeLegacySettings(['iitm']);

      await saveApproval({
        registrationsAutoApproved: false,
        autoapproval_emails: ['iitm'],
      }).expect(ok(200));

      const settings = await readSettings();
      expect(settings.registrationsAutoApproved).toBe(false);
      expect(settings.autoapproval_emails).toEqual(['iitm']);
    });

    it('gives a client that sends no mode the old meaning', async () => {
      await saveApproval({
        registrationsAutoApproved: true,
        autoapproval_emails: [],
      }).expect(ok(200));
      expect((await readSettings()).autoApprovalMode).toBe('EVERYONE');

      await saveApproval({
        registrationsAutoApproved: true,
        autoapproval_emails: ['a@b.com'],
      }).expect(ok(200));
      expect((await readSettings()).autoApprovalMode).toBe('LIST');
    });

    it('stores an empty list for EVERYONE', async () => {
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'EVERYONE',
        autoapproval_emails: ['a@b.com'],
      }).expect(ok(200));

      expect((await readSettings()).autoapproval_emails).toEqual([]);
    });
  });

  describe('saving the form', () => {
    const saveForm = (body: Record<string, unknown>) =>
      admin(
        request(app).put(
          `/course/registration/build-form/version/${versionId}`,
        ),
      ).send({
        jsonSchema: {type: 'object', properties: {}},
        uiSchema: {type: 'VerticalLayout', elements: []},
        ...body,
      });

    it('keeps auto-approval when the request has only the schemas', async () => {
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: ['bob@gmail.com'],
      }).expect(ok(200));

      await saveForm({}).expect(ok(200));

      const settings = await readSettings();
      expect(settings.registrationsAutoApproved).toBe(true);
      expect(settings.autoApprovalMode).toBe('LIST');
      expect(settings.autoapproval_emails).toEqual(['bob@gmail.com']);
    });

    it('keeps an empty LIST from becoming EVERYONE', async () => {
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [],
      }).expect(ok(200));

      await saveForm({}).expect(ok(200));

      expect((await readSettings()).autoApprovalMode).toBe('LIST');
    });

    it('still accepts a form saved with an older invalid entry', async () => {
      await storeLegacySettings(['iitm']);

      await saveForm({autoapproval_emails: ['iitm']}).expect(ok(200));

      expect((await readSettings()).autoapproval_emails).toEqual(['iitm']);
    });
  });

  describe('cohorts', () => {
    it('applies exact matching to the cohort list', async () => {
      const cohortId = await addCohort();
      const entry = `${unique()}@example.com`;
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [entry],
        cohortId,
      }).expect(ok(200));

      const miss = await register(`jim${entry}`, {cohort: cohortId});
      const hit = await register(entry, {cohort: cohortId});

      expect(miss.status).toBe('PENDING');
      expect(hit.status).toBe('APPROVED');
    });

    it('keeps an empty cohort LIST from approving anyone', async () => {
      const cohortId = await addCohort();
      await saveApproval({
        registrationsAutoApproved: true,
        autoApprovalMode: 'LIST',
        autoapproval_emails: [],
        cohortId,
      }).expect(ok(200));

      const {status} = await register(`${unique()}@other.com`, {
        cohort: cohortId,
      });

      expect(status).toBe('PENDING');
      expect(
        (await readSettings()).cohortSettingDetails[0].autoApprovalMode,
      ).toBe('LIST');
    });
  });
});
