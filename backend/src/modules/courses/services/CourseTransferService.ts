import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {inject, injectable} from 'inversify';
import {ClientSession, ObjectId} from 'mongodb';
import {BadRequestError, NotFoundError} from 'routing-controllers';
import {
  IItemRepository,
  ItemType,
  ProctoringComponent,
  SettingRepository,
} from '#root/shared/index.js';
import {COURSES_TYPES} from '../types.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {SETTING_TYPES} from '#root/modules/setting/types.js';
import {
  CourseSetting,
  CreateCourseSettingBody,
} from '#root/modules/setting/index.js';
import {QUIZZES_TYPES} from '#root/modules/quizzes/types.js';
import {
  QuestionBankRepository,
  QuestionRepository,
} from '#root/modules/quizzes/repositories/index.js';
import {QuestionBank} from '#root/modules/quizzes/classes/transformers/QuestionBank.js';
import {BaseQuestion} from '#root/modules/quizzes/classes/transformers/Question.js';
import {Module, Section} from '../classes/index.js';
import {
  BUNDLE_FORMAT_VERSION,
  BundleItem,
  BundleQuestionBank,
  CourseBundle,
} from '../classes/validators/CourseTransferValidators.js';
import {getCopyCourseName} from '../utils/getCopyCourseName.js';

/**
 * Fields on a question document that belong to the *source server* and must
 * never travel in a bundle: the document id, the authoring user, and the link
 * back to the crowd-sourced student question it came from.
 */
const NON_PORTABLE_QUESTION_FIELDS = [
  '_id',
  'createdBy',
  'studentQuestionId',
  'isDeleted',
  'deletedAt',
];

/**
 * Quiz detail fields that are Dates in Mongo but strings after a JSON round
 * trip.
 */
const QUIZ_DATE_FIELDS = ['releaseTime', 'deadline'];

/**
 * Exports a course version to a self-contained JSON bundle, and recreates a
 * course from such a bundle on a different server.
 *
 * The bundle carries *content only*. Everything that identifies people or
 * running instruction on the source server — instructors, enrollments,
 * cohorts, progress, watch time, invites, HP, announcements — is deliberately
 * left behind, because none of it can be resolved against a different
 * database. See `CourseVersionService.copyCourseVersion` for the in-database
 * equivalent, which keeps enrollments precisely because it never leaves the
 * server.
 *
 * @category Courses/Services
 */
@injectable()
export class CourseTransferService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(QUIZZES_TYPES.QuestionBankRepo)
    private readonly questionBankRepo: QuestionBankRepository,
    @inject(QUIZZES_TYPES.QuestionRepo)
    private readonly questionRepo: QuestionRepository,
    @inject(SETTING_TYPES.SettingRepo)
    private readonly settingsRepo: SettingRepository,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(GLOBAL_TYPES.Database)
    database: MongoDatabase,
  ) {
    super(database);
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  /**
   * Walks course → version → modules → sections → itemsGroup → items →
   * question banks → questions, stripping every ObjectId along the way.
   */
  async exportCourseVersion(
    courseId: string,
    versionId: string,
  ): Promise<CourseBundle> {
    const [course, version] = await Promise.all([
      this.courseRepo.read(courseId),
      this.courseRepo.readVersion(versionId),
    ]);

    if (!course) {
      throw new NotFoundError(`Course ${courseId} not found`);
    }
    if (!version) {
      throw new NotFoundError(`Course version ${versionId} not found`);
    }
    if (version.courseId?.toString() !== courseId) {
      throw new BadRequestError(
        `Version ${versionId} does not belong to course ${courseId}`,
      );
    }

    // Bank id -> bundle-local key, so a bank shared by several quizzes is
    // exported once and re-created once.
    const bankKeys = new Map<string, string>();
    const questionBanks: BundleQuestionBank[] = [];

    const keyForBank = async (bankId: string): Promise<string> => {
      const existing = bankKeys.get(bankId);
      if (existing) {
        return existing;
      }

      const bank = await this.questionBankRepo.getById(bankId);
      if (!bank) {
        throw new NotFoundError(`Question bank ${bankId} not found`);
      }

      const key = `bank-${questionBanks.length}`;
      bankKeys.set(bankId, key);

      const questions = await Promise.all(
        (bank.questions || []).map(async questionId => {
          const question = await this.questionRepo.getById(
            questionId.toString(),
          );
          return question ? this.stripQuestionIds(question) : null;
        }),
      );

      questionBanks.push({
        key,
        title: bank.title,
        description: bank.description,
        tags: bank.tags,
        points: bank.points,
        questions: questions.filter(Boolean),
      });

      return key;
    };

    const modules = [];
    for (const module of (version.modules || []).filter(m => !m.isDeleted)) {
      const sections = [];

      for (const section of (module.sections || []).filter(s => !s.isDeleted)) {
        if (!section.itemsGroupId) {
          throw new BadRequestError(
            `Section ${section.name} is missing an itemsGroupId`,
          );
        }

        const itemsGroup = await this.itemRepo.readItemsGroup(
          section.itemsGroupId.toString(),
        );
        if (!itemsGroup) {
          throw new NotFoundError(
            `Items group ${section.itemsGroupId} not found`,
          );
        }

        const items: BundleItem[] = [];
        for (const ref of itemsGroup.items || []) {
          const item = await this.itemRepo.readItemById(ref._id.toString());
          if (!item || item.isDeleted) {
            continue;
          }

          const bundleItem: BundleItem = {
            name: item.name,
            description: item.description,
            type: item.type,
            // Ordering lives on the ItemsGroup ref, not on the item document.
            order: ref.order,
            isHidden: item.isHidden ?? false,
            isOptional: item.isOptional ?? false,
            details: item.details ? {...(item.details as object)} : undefined,
          };

          if (item.type === ItemType.QUIZ) {
            const refs = (item.details as any)?.questionBankRefs ?? [];
            bundleItem.questionBankRefs = await Promise.all(
              refs.map(async (bankRef: any) => ({
                bankKey: await keyForBank(bankRef.bankId.toString()),
                count: bankRef.count,
                difficulty: bankRef.difficulty,
                tags: bankRef.tags,
                type: bankRef.type,
              })),
            );
            // Lifted out of details so the bundle holds no ObjectIds.
            delete (bundleItem.details as any).questionBankRefs;
          }

          items.push(bundleItem);
        }

        sections.push({
          name: section.name,
          description: section.description,
          order: section.order,
          isHidden: section.isHidden ?? false,
          items,
        });
      }

      modules.push({
        name: module.name,
        description: module.description,
        order: module.order,
        isHidden: module.isHidden ?? false,
        sections,
      });
    }

    const courseSettings = await this.settingsRepo.readCourseSettings(
      courseId,
      versionId,
    );

    return {
      formatVersion: BUNDLE_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      source: {courseId, courseVersionId: versionId},
      course: {name: course.name, description: course.description},
      version: {
        version: version.version,
        description: version.description,
        supportLink: (version as any).supportLink,
      },
      modules,
      questionBanks,
      settings: this.stripSettings(courseSettings?.settings),
    };
  }

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  /**
   * Recreates a course from a bundle. Runs in a single transaction so a
   * failure part-way leaves no orphaned banks, questions or item documents
   * behind.
   */
  async importCourse(
    bundle: CourseBundle,
    userId: string,
  ): Promise<{courseId: string; versionId: string; name: string}> {
    if (bundle.formatVersion !== BUNDLE_FORMAT_VERSION) {
      throw new BadRequestError(
        `Unsupported bundle format version ${bundle.formatVersion}; this server reads version ${BUNDLE_FORMAT_VERSION}`,
      );
    }

    const bundleKeys = new Set(
      (bundle.questionBanks || []).map(bank => bank.key),
    );
    for (const module of bundle.modules || []) {
      for (const section of module.sections || []) {
        for (const item of section.items || []) {
          for (const ref of item.questionBankRefs || []) {
            if (!bundleKeys.has(ref.bankKey)) {
              throw new BadRequestError(
                `Item "${item.name}" references unknown question bank key "${ref.bankKey}"`,
              );
            }
          }
        }
      }
    }

    const name = await this.resolveCourseName(bundle.course.name);

    return this._withTransaction(async session => {
      const course = await this.courseRepo.create(
        {
          name,
          description: bundle.course.description ?? '',
          versions: [],
          instructors: [new ObjectId(userId)],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        session,
      );
      if (!course) {
        throw new Error('Failed to create course from bundle');
      }
      const newCourseId = course._id.toString();

      const version = await this.courseRepo.createVersion(
        {
          courseId: new ObjectId(newCourseId),
          version: bundle.version.version,
          description: bundle.version.description ?? '',
          supportLink: bundle.version.supportLink,
          modules: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        session,
      );
      if (!version) {
        throw new Error('Failed to create course version from bundle');
      }
      const newVersionId = version._id.toString();

      const bankIds = await this.createQuestionBanks(
        bundle.questionBanks || [],
        newCourseId,
        newVersionId,
        userId,
        session,
      );

      const modules = await this.createModules(
        bundle.modules || [],
        bankIds,
        session,
      );

      await this.courseRepo.addModulesToVersion(newVersionId, modules, session);
      await this.courseRepo.addNewCourseVersionToCourse(
        newCourseId,
        newVersionId,
        session,
      );

      // Recompute from what was actually written — a hand-edited bundle must
      // not be able to corrupt the counts the progress logic depends on.
      const {totalItems, itemCounts} =
        await this.itemRepo.calculateItemCountsForVersion(
          newVersionId,
          session,
        );
      await this.courseRepo.updateVersion(
        newVersionId,
        {...(version as any), modules, totalItems, itemCounts},
        session,
      );

      const settingsPayload: CreateCourseSettingBody = {
        courseId: newCourseId,
        courseVersionId: newVersionId,
        settings: (bundle.settings as any) ?? {
          proctors: {
            detectors: Object.values(ProctoringComponent).map(detector => ({
              detectorName: detector,
              settings: {enabled: false, options: {}},
            })),
          },
          linearProgressionEnabled: true,
          seekForwardEnabled: false,
        },
      };
      // NOTE: `SettingRepository.createCourseSettings` hard-codes
      // `linearProgressionEnabled: true` on insert, so a source course that
      // had it turned off comes in with it on and has to be switched off again
      // through the settings endpoint. Everything else in `settings` carries
      // over. Fixing that hard-code is a change to linear-progression
      // behaviour and is deliberately left out of this feature.
      await this.settingsRepo.createCourseSettings(
        new CourseSetting(settingsPayload),
        session,
      );

      await this.enrollmentService.enrollUser(
        userId,
        newCourseId,
        newVersionId,
        'INSTRUCTOR',
        false,
        undefined,
        undefined,
        session,
      );

      return {courseId: newCourseId, versionId: newVersionId, name};
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async createQuestionBanks(
    banks: BundleQuestionBank[],
    courseId: string,
    versionId: string,
    userId: string,
    session: ClientSession,
  ): Promise<Map<string, string>> {
    const bankIds = new Map<string, string>();

    for (const bank of banks) {
      if (bankIds.has(bank.key)) {
        throw new BadRequestError(`Duplicate question bank key "${bank.key}"`);
      }

      const newBankId = await this.questionBankRepo.create(
        new QuestionBank({
          courseId,
          courseVersionId: versionId,
          questions: [],
          tags: bank.tags,
          title: bank.title,
          description: bank.description,
          points: bank.points,
        }),
        session,
      );

      const questionIds: string[] = [];
      for (const question of bank.questions || []) {
        const created = await this.questionRepo.create(
          this.reviveQuestion(question, userId) as BaseQuestion,
          session,
        );
        if (created) {
          questionIds.push(created);
        }
      }

      await this.questionBankRepo.update(
        newBankId,
        {questions: questionIds},
        session,
      );
      bankIds.set(bank.key, newBankId);
    }

    return bankIds;
  }

  private async createModules(
    bundleModules: CourseBundle['modules'],
    bankIds: Map<string, string>,
    session: ClientSession,
  ): Promise<Module[]> {
    const modules: Module[] = [];

    for (const bundleModule of bundleModules) {
      const sections: Section[] = [];

      for (const bundleSection of bundleModule.sections || []) {
        const sectionId = new ObjectId();

        const payloads = (bundleSection.items || []).map(item => ({
          name: item.name,
          description: item.description ?? '',
          type: item.type,
          isHidden: item.isHidden ?? false,
          isOptional: item.isOptional ?? false,
          isDeleted: false,
          details: this.reviveItemDetails(item, bankIds),
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        const created = payloads.length
          ? await this.itemRepo.createItems(payloads as any, session)
          : [];

        const itemsGroup = await this.itemRepo.createItemsGroup(
          {
            sectionId,
            items: created.map((item, index) => ({
              _id: new ObjectId(item._id.toString()),
              type: bundleSection.items[index].type,
              order: bundleSection.items[index].order,
              name: bundleSection.items[index].name,
              isHidden: bundleSection.items[index].isHidden ?? false,
            })),
          } as any,
          session,
        );

        sections.push({
          sectionId,
          name: bundleSection.name,
          description: bundleSection.description ?? '',
          order: bundleSection.order,
          isHidden: bundleSection.isHidden ?? false,
          itemsGroupId: new ObjectId(itemsGroup._id.toString()),
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Section);
      }

      modules.push({
        moduleId: new ObjectId(),
        name: bundleModule.name,
        description: bundleModule.description ?? '',
        order: bundleModule.order,
        isHidden: bundleModule.isHidden ?? false,
        sections,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Module);
    }

    return modules;
  }

  /**
   * Rebuilds an item's `details`, mapping bundle bank keys back to the ids of
   * the banks just created and reviving JSON date strings.
   */
  private reviveItemDetails(
    item: BundleItem,
    bankIds: Map<string, string>,
  ): Record<string, any> {
    const details: Record<string, any> = {...(item.details ?? {})};

    if (item.type !== ItemType.QUIZ) {
      return details;
    }

    details.questionBankRefs = (item.questionBankRefs || []).map(ref => ({
      bankId: new ObjectId(bankIds.get(ref.bankKey)),
      count: ref.count,
      difficulty: ref.difficulty,
      tags: ref.tags,
      type: ref.type,
    }));

    for (const field of QUIZ_DATE_FIELDS) {
      if (details[field]) {
        details[field] = new Date(details[field]);
      }
    }

    return details;
  }

  /**
   * Removes every id-bearing field from a question document — including the
   * `_id`s nested on lot items, which are regenerated on import.
   */
  private stripQuestionIds(question: Record<string, any>): Record<string, any> {
    const strip = (value: any): any => {
      if (Array.isArray(value)) {
        return value.map(strip);
      }
      if (value instanceof Date || value instanceof ObjectId) {
        return value;
      }
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== '_id')
            .map(([key, nested]) => [key, strip(nested)]),
        );
      }
      return value;
    };

    const stripped = strip(question);
    for (const field of NON_PORTABLE_QUESTION_FIELDS) {
      delete stripped[field];
    }
    return stripped;
  }

  /**
   * Inverse of {@link stripQuestionIds}: attributes the question to the
   * importing user and gives every lot item a fresh id, matching what
   * `QuestionFactory` does for questions authored through the API.
   */
  private reviveQuestion(
    question: Record<string, any>,
    userId: string,
  ): Record<string, any> {
    const revived: Record<string, any> = {...question};
    for (const field of NON_PORTABLE_QUESTION_FIELDS) {
      delete revived[field];
    }

    const withId = (lotItem: any) => ({...lotItem, _id: new ObjectId()});

    if (Array.isArray(revived.incorrectLotItems)) {
      revived.incorrectLotItems = revived.incorrectLotItems.map(withId);
    }
    if (Array.isArray(revived.correctLotItems)) {
      revived.correctLotItems = revived.correctLotItems.map(withId);
    }
    if (revived.correctLotItem) {
      revived.correctLotItem = withId(revived.correctLotItem);
    }
    if (Array.isArray(revived.ordering)) {
      revived.ordering = revived.ordering.map((entry: any) => ({
        ...entry,
        lotItem: withId(entry.lotItem),
      }));
    }

    revived.createdBy = new ObjectId(userId);
    revived.isDeleted = false;
    return revived;
  }

  /**
   * Drops the settings that point at people or documents on the source server.
   * `followUpInvite` carries a course/version/cohort id that would dangle — or
   * worse, silently resolve to an unrelated course. `audit` is the log of who
   * changed these settings on the source server, so every entry holds a
   * foreign user id and none of it describes the course.
   */
  private stripSettings(
    settings?: Record<string, any>,
  ): Record<string, any> | undefined {
    if (!settings) {
      return undefined;
    }
    const {followUpInvite, audit, ...portable} = settings;
    return {
      ...portable,
      // An imported course must be opened for enrollment deliberately on the
      // target server, never by inheriting the source's visibility.
      isPublic: false,
    };
  }

  /**
   * Keeps the bundle's course name unless the target server already has one,
   * in which case it falls back to the same "(Copy N)" scheme cloning uses.
   */
  private async resolveCourseName(name: string): Promise<string> {
    const courses = await this.courseRepo.getAllCourses();
    const taken = new Set(courses.map(course => course.name));

    if (!taken.has(name)) {
      return name;
    }

    let candidate = getCopyCourseName(name);
    while (taken.has(candidate)) {
      candidate = getCopyCourseName(candidate);
    }
    return candidate;
  }
}
