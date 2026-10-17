import {beforeAll, describe, expect, it, vi} from 'vitest';
import {Container} from 'inversify';
import {ObjectId} from 'mongodb';
import {faker} from '@faker-js/faker';

import {coursesContainerModules} from '../index.js';
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
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {UserRepository} from '#root/shared/database/providers/mongo/repositories/UserRepository.js';
import {IItemRepository, ItemType, SettingRepository} from '#root/shared/index.js';
import {SETTING_TYPES} from '#root/modules/setting/types.js';
import {QUIZZES_TYPES} from '#root/modules/quizzes/types.js';
import {
  QuestionBankRepository,
  QuestionRepository,
} from '#root/modules/quizzes/repositories/index.js';
import {QuestionBank} from '#root/modules/quizzes/classes/transformers/QuestionBank.js';
import {CourseSetting} from '#root/modules/setting/index.js';
import {COURSES_TYPES} from '../types.js';
import {CourseTransferService} from '../services/CourseTransferService.js';
import {CourseBundle} from '../classes/validators/CourseTransferValidators.js';

describe('Course transfer (export / import)', () => {
  let container: Container;
  let transferService: CourseTransferService;
  let courseRepo: ICourseRepository;
  let itemRepo: IItemRepository;
  let questionBankRepo: QuestionBankRepository;
  let questionRepo: QuestionRepository;
  let settingsRepo: SettingRepository;
  let userRepo: UserRepository;

  let authorId: string;
  let importerId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    container = new Container();
    // coursesContainerModules already brings in shared/auth/users/quizzes/
    // notifications; loading them twice makes inversify ambiguous.
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

    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    transferService = container.get<CourseTransferService>(
      COURSES_TYPES.CourseTransferService,
    );
    courseRepo = container.get<ICourseRepository>(GLOBAL_TYPES.CourseRepo);
    itemRepo = container.get<IItemRepository>(COURSES_TYPES.ItemRepo);
    questionBankRepo = container.get<QuestionBankRepository>(
      QUIZZES_TYPES.QuestionBankRepo,
    );
    questionRepo = container.get<QuestionRepository>(QUIZZES_TYPES.QuestionRepo);
    settingsRepo = container.get<SettingRepository>(SETTING_TYPES.SettingRepo);
    userRepo = container.get<UserRepository>(GLOBAL_TYPES.UserRepo);

    authorId = await createUser();
    importerId = await createUser();
  });

  async function createUser(): Promise<string> {
    return userRepo.create({
      firebaseUID: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      roles: 'admin',
    } as any);
  }

  /**
   * Builds a course with two modules: one holding a video and a quiz, one
   * holding a second quiz that reuses the *same* question bank. Written
   * straight through the repositories so the fixture doesn't depend on the
   * auth stack.
   */
  async function seedCourse(name: string) {
    const course = await courseRepo.create({
      name,
      description: 'Source course',
      versions: [],
      instructors: [new ObjectId(authorId)],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    const courseId = course._id.toString();

    const version = await courseRepo.createVersion({
      courseId: new ObjectId(courseId),
      version: 'v1',
      description: 'Source version',
      modules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    const versionId = version._id.toString();

    const bankId = await questionBankRepo.create(
      new QuestionBank({
        courseId,
        courseVersionId: versionId,
        questions: [],
        title: 'Shared bank',
        description: 'Reused by two quizzes',
        tags: ['unit-1'],
        points: 10,
      }),
    );

    const questionIds: string[] = [];
    for (const text of ['What is 2 + 2?', 'Pick the primes']) {
      const id = await questionRepo.create({
        createdBy: new ObjectId(authorId),
        text,
        type: 'SELECT_ONE_IN_LOT',
        isParameterized: false,
        timeLimitSeconds: 60,
        points: 5,
        priority: 'LOW',
        incorrectLotItems: [
          {_id: new ObjectId(), text: 'wrong', explaination: 'no'},
        ],
        correctLotItem: {_id: new ObjectId(), text: 'right', explaination: 'yes'},
        isDeleted: false,
      } as any);
      questionIds.push(id);
    }
    await questionBankRepo.update(bankId, {questions: questionIds});

    const quizDetails = {
      questionBankRefs: [{bankId: new ObjectId(bankId), count: 1}],
      passThreshold: 0.7,
      maxAttempts: 3,
      quizType: 'NO_DEADLINE',
      releaseTime: new Date('2026-01-01T00:00:00.000Z'),
      questionVisibility: 1,
      approximateTimeToComplete: '00:10:00',
      allowPartialGrading: true,
      allowHint: true,
      showCorrectAnswersAfterSubmission: true,
      showExplanationAfterSubmission: true,
      showScoreAfterSubmission: true,
      allowSkip: false,
    };

    const makeSection = async (
      sectionName: string,
      items: Record<string, any>[],
    ) => {
      const created = await itemRepo.createItems(items as any);
      const sectionId = new ObjectId();
      const itemsGroup = await itemRepo.createItemsGroup({
        sectionId,
        items: created.map((item, index) => ({
          _id: new ObjectId(item._id.toString()),
          type: items[index].type,
          order: items[index].__order,
          name: items[index].name,
          isHidden: false,
        })),
      } as any);
      return {
        sectionId,
        name: sectionName,
        description: `${sectionName} description`,
        order: 'a0',
        isHidden: false,
        itemsGroupId: new ObjectId(itemsGroup._id.toString()),
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    };

    const sectionOne = await makeSection('Basics', [
      {
        name: 'Intro video',
        description: 'Watch this',
        type: ItemType.VIDEO,
        isHidden: false,
        isDeleted: false,
        details: {
          URL: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          startTime: '00:00:00',
          endTime: '00:05:00',
          points: 10,
        },
        __order: 'a0',
      },
      {
        name: 'Quiz one',
        description: 'First check',
        type: ItemType.QUIZ,
        isHidden: false,
        isDeleted: false,
        details: {...quizDetails},
        __order: 'a1',
      },
    ]);

    const sectionTwo = await makeSection('Recap', [
      {
        name: 'Quiz two',
        description: 'Second check, same bank',
        type: ItemType.QUIZ,
        isHidden: false,
        isDeleted: false,
        details: {...quizDetails},
        __order: 'a0',
      },
    ]);

    await courseRepo.addModulesToVersion(versionId, [
      {
        moduleId: new ObjectId(),
        name: 'Module one',
        description: 'First module',
        order: 'a0',
        isHidden: false,
        sections: [sectionOne],
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        moduleId: new ObjectId(),
        name: 'Module two',
        description: 'Second module',
        order: 'a1',
        isHidden: false,
        sections: [sectionTwo],
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    await courseRepo.addNewCourseVersionToCourse(courseId, versionId);

    await settingsRepo.createCourseSettings(
      new CourseSetting({
        courseId,
        courseVersionId: versionId,
        settings: {
          proctors: {detectors: []},
          linearProgressionEnabled: false,
          seekForwardEnabled: true,
          isPublic: true,
          // Real courses accumulate a settings-change audit log holding the
          // user ids of whoever changed them on this server.
          audit: [
            {userId: new ObjectId(authorId), action: 'UPDATE', at: new Date()},
          ],
          followUpInvite: {
            enabled: true,
            courseId: new ObjectId().toString(),
            courseVersionId: new ObjectId().toString(),
          },
        },
      } as any),
    );

    return {courseId, versionId, bankId, questionIds};
  }

  describe('Export', () => {
    it('produces a bundle with no ObjectIds and one entry per shared bank', async () => {
      const source = await seedCourse(faker.commerce.productName());
      const bundle = await transferService.exportCourseVersion(
        source.courseId,
        source.versionId,
      );

      expect(bundle.formatVersion).toBe(1);
      expect(bundle.modules).toHaveLength(2);
      expect(bundle.modules[0].sections[0].items.map(i => i.name)).toEqual([
        'Intro video',
        'Quiz one',
      ]);

      // Two quizzes, one bank.
      expect(bundle.questionBanks).toHaveLength(1);
      expect(bundle.questionBanks[0].questions).toHaveLength(2);
      const quizOne = bundle.modules[0].sections[0].items[1];
      const quizTwo = bundle.modules[1].sections[0].items[0];
      expect(quizOne.questionBankRefs[0].bankKey).toBe(
        quizTwo.questionBankRefs[0].bankKey,
      );

      // No id from the source server survives anywhere in the payload —
      // including the bank id, the question ids and the author's user id.
      const serialised = JSON.stringify(bundle.modules) +
        JSON.stringify(bundle.questionBanks) +
        JSON.stringify(bundle.settings);
      for (const id of [
        source.courseId,
        source.versionId,
        source.bankId,
        authorId,
        ...source.questionIds,
      ]) {
        expect(serialised).not.toContain(id);
      }
      expect(serialised).not.toMatch(/"_id"/);
      expect(serialised).not.toMatch(/"createdBy"/);
    });

    it('drops followUpInvite and forces isPublic false', async () => {
      const source = await seedCourse(faker.commerce.productName());
      const bundle = await transferService.exportCourseVersion(
        source.courseId,
        source.versionId,
      );

      expect(bundle.settings.followUpInvite).toBeUndefined();
      // The settings-change log names users on the source server.
      expect(bundle.settings.audit).toBeUndefined();
      expect(JSON.stringify(bundle.settings)).not.toContain(authorId);
      expect(bundle.settings.isPublic).toBe(false);
      // Authored settings still travel.
      expect(bundle.settings.seekForwardEnabled).toBe(true);
      expect(bundle.settings.proctors).toBeDefined();
    });

    it('rejects a version that belongs to another course', async () => {
      const a = await seedCourse(faker.commerce.productName());
      const b = await seedCourse(faker.commerce.productName());

      await expect(
        transferService.exportCourseVersion(a.courseId, b.versionId),
      ).rejects.toThrow(/does not belong/);
    });
  });

  describe('Import', () => {
    it('round-trips the course structure onto fresh ids', async () => {
      const source = await seedCourse(faker.commerce.productName());
      const bundle = await transferService.exportCourseVersion(
        source.courseId,
        source.versionId,
      );

      const created = await transferService.importCourse(bundle, importerId);
      expect(created.courseId).not.toBe(source.courseId);
      expect(created.versionId).not.toBe(source.versionId);

      const version = await courseRepo.readVersion(created.versionId);
      expect(version.modules).toHaveLength(2);
      expect(version.modules.map(m => m.name)).toEqual([
        'Module one',
        'Module two',
      ]);
      expect(version.totalItems).toBe(3);
      expect(version.itemCounts.VIDEO).toBe(1);
      expect(version.itemCounts.QUIZ).toBe(2);

      const section = version.modules[0].sections[0];
      expect(section.sectionId.toString()).not.toBe(
        (await courseRepo.readVersion(source.versionId)).modules[0].sections[0]
          .sectionId.toString(),
      );

      const itemsGroup = await itemRepo.readItemsGroup(
        section.itemsGroupId.toString(),
      );
      expect(itemsGroup.items.map(i => i.name)).toEqual([
        'Intro video',
        'Quiz one',
      ]);
      expect(itemsGroup.items.map(i => i.order)).toEqual(['a0', 'a1']);

      const video = await itemRepo.readItemById(
        itemsGroup.items[0]._id.toString(),
      );
      expect((video.details as any).URL).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );
      expect((video.details as any).endTime).toBe('00:05:00');

      const quiz = await itemRepo.readItemById(
        itemsGroup.items[1]._id.toString(),
      );
      const quizDetails = quiz.details as any;
      // Dates survive the JSON round trip as Dates, not strings.
      expect(quizDetails.releaseTime).toBeInstanceOf(Date);
      expect(quizDetails.passThreshold).toBe(0.7);

      // Both quizzes point at one newly created bank, and it is not the source's.
      const newBankId = quizDetails.questionBankRefs[0].bankId.toString();
      expect(newBankId).not.toBe(source.bankId);

      const secondGroup = await itemRepo.readItemsGroup(
        version.modules[1].sections[0].itemsGroupId.toString(),
      );
      const quizTwo = await itemRepo.readItemById(
        secondGroup.items[0]._id.toString(),
      );
      expect(
        (quizTwo.details as any).questionBankRefs[0].bankId.toString(),
      ).toBe(newBankId);

      const bank = await questionBankRepo.getById(newBankId);
      expect(bank.title).toBe('Shared bank');
      expect(bank.courseId.toString()).toBe(created.courseId);
      expect(bank.questions).toHaveLength(2);

      const question = await questionRepo.getById(bank.questions[0].toString());
      expect(question.text).toMatch(/2 \+ 2|primes/);
      // Authorship transfers to the importing user, never the original author.
      expect(question.createdBy.toString()).toBe(importerId);
      expect(question.createdBy.toString()).not.toBe(authorId);
      // Lot items get fresh ids rather than inheriting the source's.
      expect((question as any).correctLotItem._id).toBeDefined();

      const course = await courseRepo.read(created.courseId);
      expect(course.instructors.map(i => i.toString())).toEqual([importerId]);

      const settings = await settingsRepo.readCourseSettings(
        created.courseId,
        created.versionId,
      );
      expect(settings.settings.seekForwardEnabled).toBe(true);
      expect(settings.settings.isPublic).toBe(false);
      expect(settings.settings.followUpInvite.enabled).toBe(false);
    });

    it('creates two independent courses when the same bundle is imported twice', async () => {
      const source = await seedCourse(faker.commerce.productName());
      const bundle = await transferService.exportCourseVersion(
        source.courseId,
        source.versionId,
      );

      const first = await transferService.importCourse(bundle, importerId);
      const second = await transferService.importCourse(bundle, importerId);

      expect(second.courseId).not.toBe(first.courseId);
      expect(second.name).not.toBe(first.name);

      const firstVersion = await courseRepo.readVersion(first.versionId);
      const secondVersion = await courseRepo.readVersion(second.versionId);
      expect(
        firstVersion.modules[0].sections[0].itemsGroupId.toString(),
      ).not.toBe(
        secondVersion.modules[0].sections[0].itemsGroupId.toString(),
      );
    });

    it('rejects an unknown format version', async () => {
      const source = await seedCourse(faker.commerce.productName());
      const bundle = await transferService.exportCourseVersion(
        source.courseId,
        source.versionId,
      );

      await expect(
        transferService.importCourse(
          {...bundle, formatVersion: 99} as CourseBundle,
          importerId,
        ),
      ).rejects.toThrow(/Unsupported bundle format version/);
    });

    it('rejects a bundle referencing a bank key it does not carry', async () => {
      const source = await seedCourse(faker.commerce.productName());
      const bundle = await transferService.exportCourseVersion(
        source.courseId,
        source.versionId,
      );
      bundle.modules[0].sections[0].items[1].questionBankRefs[0].bankKey =
        'bank-does-not-exist';

      await expect(
        transferService.importCourse(bundle, importerId),
      ).rejects.toThrow(/unknown question bank key/);
    });

    it('leaves nothing behind when the import fails part-way', async () => {
      const source = await seedCourse(faker.commerce.productName());
      const bundle = await transferService.exportCourseVersion(
        source.courseId,
        source.versionId,
      );
      const uniqueName = `Rollback ${faker.string.uuid()}`;
      bundle.course.name = uniqueName;
      const bankTitle = `Rollback bank ${faker.string.uuid()}`;
      bundle.questionBanks[0].title = bankTitle;

      const failure = vi
        .spyOn(itemRepo, 'createItemsGroup')
        .mockRejectedValue(new Error('boom'));

      await expect(
        transferService.importCourse(bundle, importerId),
      ).rejects.toThrow('boom');

      failure.mockRestore();

      const courses = await courseRepo.getAllCourses();
      expect(courses.some(c => c.name === uniqueName)).toBe(false);

      // The banks and questions written before the failure are rolled back too.
      const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
      const mongo = await db.getClient();
      const dbName = mongo.db().databaseName;
      const banks = await mongo
        .db(dbName)
        .collection('questionBanks')
        .countDocuments({title: bankTitle});
      expect(banks).toBe(0);
    });
  });
});
