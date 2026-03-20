import { Item, ItemsGroup } from '#courses/classes/transformers/Item.js';
import { COURSES_TYPES } from '#courses/types.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
import { IItemRepository } from '#root/shared/database/interfaces/IItemRepository.js';
import { IUserRepository } from '#root/shared/database/interfaces/IUserRepository.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {
  ICourseVersion,
  IWatchTime,
  IProgress,
  IVideoDetails,
  IBlogDetails,
  ICurrentProgressPath,
} from '#root/shared/interfaces/models.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { ProgressRepository } from '#shared/database/providers/mongo/repositories/ProgressRepository.js';
import { Progress } from '#users/classes/transformers/Progress.js';
import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import { ClientSession, ObjectId } from 'mongodb';
import {
  NotFoundError,
  BadRequestError,
  InternalServerError,
  ForbiddenError,
} from 'routing-controllers';
import { SubmissionRepository } from '#quizzes/repositories/providers/mongodb/SubmissionRepository.js';
import { QUIZZES_TYPES } from '#quizzes/types.js';
import { WatchTime } from '../classes/transformers/WatchTime.js';
import { ISettingRepository } from '#shared/index.js';
import {
  CompletedProgressResponse,
  GetLeaderboardResponse,
  LeaderboardNoAuthResponse,
} from '../classes/index.js';
import {
  QuizRepository,
  UserQuizMetricsRepository,
} from '#root/modules/quizzes/repositories/index.js';
import { EnrollmentRepository } from '#root/shared/index.js';
import { PROJECTS_TYPES } from '#root/modules/projects/types.js';
import { IProjectSubmissionRepository } from '#root/modules/projects/interfaces/IProjectSubmissionRepository.js';
import { FeedbackRepository } from '#root/modules/quizzes/repositories/providers/mongodb/FeedbackRepository.js';
import { GetCurrentProgressPathResponse } from '../classes/dtos/GetCurrentProgressPathResponse.js';
import { SETTING_TYPES } from '#root/modules/setting/types.js';
import { CourseSettingService } from '#root/modules/setting/index.js';
import { getContainer } from '#root/bootstrap/loadModules.js';

@injectable()
class ProgressService extends BaseService {
  private getCourseSettingService(): CourseSettingService {
    return getContainer().get<CourseSettingService>(SETTING_TYPES.SettingRepo);
  }

  constructor(
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepository: ProgressRepository,

    @inject(QUIZZES_TYPES.SubmissionRepo)
    private readonly submissionRepository: SubmissionRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(GLOBAL_TYPES.SettingRepo)
    private readonly settingsRepo: ISettingRepository,

    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepo: IUserRepository,

    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,

    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,

    @inject(QUIZZES_TYPES.UserQuizMetricsRepo)
    private userQuizMetricsRepository: UserQuizMetricsRepository,

    @inject(QUIZZES_TYPES.QuizRepo)
    private quizRepo: QuizRepository,

    @inject(PROJECTS_TYPES.projectSubmissionRepository)
    private projectSubmissionRepo: IProjectSubmissionRepository,

    @inject(QUIZZES_TYPES.FeedbackRepo)
    private feedbackRepository: FeedbackRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase, // inject the database provider
  ) {
    super(database);
  }

  /**
   * Initialize student progress tracking to the first item in the course.
   * Private helper method for the enrollment process.
   */

  private getFirstByOrder<T extends { order?: string }>(arr?: T[]): T | null {
    if (!arr?.length) return null;

    return arr.reduce((min, curr) => {
      if (!curr?.order) return min;
      if (!min?.order) return curr;
      return curr.order < min.order ? curr : min;
    });
  }

  private findModule(courseVersion, moduleId: string) {
    const module = courseVersion.modules.find(m => m.moduleId === moduleId);
    if (!module) {
      throw new NotFoundError(`Module not found: ${moduleId}`);
    }
    return module;
  }

  private findSection(module, sectionId: string) {
    const section = module.sections.find(
      s => s.sectionId.toString() === sectionId,
    );
    if (!section) {
      throw new NotFoundError(`Section not found: ${sectionId}`);
    }
    return section;
  }

  private async collectItemsFromGroups(
    itemsGroupIds: string[],
    session: ClientSession,
  ) {
    const itemGroups = await this.itemRepo.getItemGroupsByIds(
      itemsGroupIds,
      session,
    );

    const itemIds: string[] = [];
    const quizItemIds: string[] = [];

    for (const group of itemGroups) {
      for (const item of group.items || []) {
        itemIds.push(item._id.toString());
        if (item.type === 'QUIZ') {
          quizItemIds.push(item._id.toString());
        }
      }
    }

    return { itemIds, quizItemIds };
  }

  private async clearWatchTime(
    userId: string,
    itemIds: string[],
    session: ClientSession,
  ) {
    if (!itemIds.length) return 0;

    const { deletedCount } =
      await this.progressRepository.deleteUserWatchTimeByItemIds(
        userId,
        itemIds,
        session,
      );

    return deletedCount ?? 0;
  }

  async initializeProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    courseVersion: ICourseVersion,
    cohortId?: string,
  ) {
    // 1. First module
    const firstModule = this.getFirstByOrder(courseVersion.modules);
    if (!firstModule) return null;

    // 2. First section
    const firstSection = this.getFirstByOrder(firstModule.sections);
    if (!firstSection) return null;

    // 3. Load items group
    const itemsGroup = await this.itemRepo.readItemsGroup(
      firstSection.itemsGroupId.toString(),
    );

    if (!itemsGroup?.items?.length) return null;

    // 4. First item
    const firstItem = this.getFirstByOrder(itemsGroup.items);
    if (!firstItem) return null;

    // 5. Create progress
    return new Progress(
      userId,
      courseId,
      courseVersionId,
      firstModule.moduleId.toString(),
      firstSection.sectionId.toString(),
      firstItem._id.toString(),
      undefined,
      cohortId
    );
  }
  //todo: initialise the first items again, remove restrictions on moving from one item to another for that user and being able to skip quiz as well(it isn't possible right now)

  private async initializeProgressToModule(
    userId: string,
    courseId: string,
    courseVersionId: string,
    courseVersion: ICourseVersion,
    moduleId: string,
    cohortId?: string,
  ) {
    const module = courseVersion.modules?.find(
      m => m.moduleId.toString() === moduleId,
    );

    if (!module) {
      throw new NotFoundError(
        'Module not found in the specified course version.',
      );
    }

    const firstSection = this.getFirstByOrder(module.sections);
    if (!firstSection) return null;

    const itemsGroup = await this.itemRepo.readItemsGroup(
      firstSection.itemsGroupId.toString(),
    );

    const firstItem = this.getFirstByOrder(itemsGroup?.items);
    if (!firstItem) return null;

    const next = await this.findNextNonBlankItem(
      courseVersion,
      module.moduleId.toString(),
      firstSection.sectionId.toString(),
      firstItem._id.toString(),
    );

    if (!next) return null;

    return new Progress(
      userId,
      courseId,
      courseVersionId,
      next.moduleId,
      next.sectionId,
      next.itemId,
      false,
      cohortId,
    );
  }

  private async initializeProgressToSection(
    userId: string,
    courseId: string,
    courseVersionId: string,
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    cohortId?: string
  ) {
    const module = courseVersion.modules?.find(
      m => m.moduleId.toString() === moduleId,
    );

    if (!module) {
      throw new NotFoundError(
        'Module not found in the specified course version.',
      );
    }

    const section = module.sections?.find(
      s => s.sectionId.toString() === sectionId,
    );

    if (!section) {
      throw new NotFoundError('Section not found in the specified module.');
    }

    const itemsGroup = await this.itemRepo.readItemsGroup(
      section.itemsGroupId.toString(),
    );

    const firstItem = this.getFirstByOrder(itemsGroup?.items);
    if (!firstItem) return null;

    const next = await this.findNextNonBlankItem(
      courseVersion,
      module.moduleId.toString(),
      section.sectionId.toString(),
      firstItem._id.toString(),
    );

    if (!next) return null;

    return new Progress(
      userId,
      courseId,
      courseVersionId,
      next.moduleId,
      next.sectionId,
      next.itemId,
      false,
      cohortId
    );
  }

  private async initializeProgressToItem(
    userId: string,
    courseId: string,
    courseVersionId: string,
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    itemId: string,
    cohortId?: string
  ) {
    const module = courseVersion.modules?.find(
      m => m.moduleId.toString() === moduleId,
    );

    if (!module) {
      throw new NotFoundError(
        'Module not found in the specified course version.',
      );
    }

    const section = module.sections?.find(
      s => s.sectionId.toString() === sectionId,
    );

    if (!section) {
      throw new NotFoundError('Section not found in the specified module.');
    }

    const itemsGroup = await this.itemRepo.readItemsGroup(
      section.itemsGroupId.toString(),
    );

    const itemExists = itemsGroup?.items?.some(
      i => i._id.toString() === itemId,
    );

    if (!itemExists) {
      throw new NotFoundError('Item not found in the specified section.');
    }

    const next = await this.findNextNonBlankItem(
      courseVersion,
      module.moduleId.toString(),
      section.sectionId.toString(),
      itemId,
    );

    if (!next) return null;

    return new Progress(
      userId,
      courseId,
      courseVersionId,
      next.moduleId,
      next.sectionId,
      next.itemId,
      false,
      cohortId
    );
  }

  async updateEnrollmentProgressPercent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
    isReset?: boolean,
    totalItemCount?: number,
    completedItemCount?: number,
    cohort?: string,
  ): Promise<void> {
    let effectiveCohort = cohort;
    let enrollment = await this.enrollmentRepo.findEnrollment(
      userId,
      courseId,
      courseVersionId,
      effectiveCohort,
      session
    );

    if (!enrollment && !effectiveCohort) {
      const resolvedCohort = await this.resolveSingleEnrollmentCohort(
        userId,
        courseId,
        courseVersionId,
        session,
      );

      if (resolvedCohort !== undefined) {
        effectiveCohort = resolvedCohort ?? undefined;
        enrollment = await this.enrollmentRepo.findEnrollment(
          userId,
          courseId,
          courseVersionId,
          effectiveCohort,
          session,
        );
      }
    }

    if (!enrollment) {
      if (isReset) return;
      throw new NotFoundError('User has no enrollments');
    }

    let percentCompleted = 0;
    let totalCompletedItemsCount = 0;

    if (!isReset) {
      // const totalItems =
      //   totalItemCount ||
      //   (await this.itemRepo.CalculateTotalItemsCount(
      //     courseId,
      //     courseVersionId,
      //     session,
      //   ));

      // const completedItems =
      //   completedItemCount ||
      //   (await this.getUserProgressPercentageWithoutTotal(
      //     userId,
      //     courseId,
      //     courseVersionId,
      //     session,
      //   ));
      const [totalItems, completedItems] = await Promise.all([
        totalItemCount ??
        this.itemRepo.getTotalItemsCount(courseId, courseVersionId, session),
        completedItemCount ??
        this.getUserProgressPercentageWithoutTotal(
          userId,
          courseId,
          courseVersionId,
          cohort,
          session,
        ),
      ]);

      percentCompleted = this._calculateProgress(
        totalItems,
        completedItemCount || completedItems,
      );
    }

    await this.enrollmentRepo.updateProgressPercentById(
      enrollment._id.toString(),
      percentCompleted,
      completedItemCount,
      effectiveCohort,
      session,
    );
  }

  private async resolveSingleEnrollmentCohort(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<string | null | undefined> {
    const enrollments = await this.enrollmentRepo.findStudentEnrollmentsByContext(
      userId,
      courseId,
      courseVersionId,
      session,
    );

    if (enrollments.length !== 1) {
      return undefined;
    }

    const cohortId = enrollments[0]?.cohortId;
    return cohortId ? cohortId.toString() : null;
  }

  async updateEnrollmentProgressPercentBulk(
    enrollments: any[], // pass the enrollments array directly
    courseId: string,
    versionId: string,
    totalItems: number,
    session?: ClientSession,
  ) {
    // resolve all async operations first
    const bulkOps = await Promise.all(
      enrollments.map(async enrollment => {
        const userId = enrollment.userId?.toString();

        // const completedItems = await this.getUserProgressPercentageWithoutTotal(
        //   userId,
        //   courseId,
        //   versionId,
        // );

        const completedItems = enrollment.completedItemsCount;

        return {
          updateOne: {
            filter: {
              userId: new ObjectId(userId),
              courseId: new ObjectId(courseId),
              courseVersionId: new ObjectId(versionId),
            },
            update: {
              $set: {
                percentCompleted: this._calculateProgress(
                  totalItems,
                  completedItems,
                ),
                updatedAt: new Date(),
              },
            },
          },
        };
      }),
    );

    if (bulkOps.length > 0) {
      return this.enrollmentRepo.bulkUpdateEnrollments(bulkOps, session);
    }
    return null;
  }

  // Helper to calculate progress based on completed items
  private _calculateProgress(
    totalItems: number,
    completedItems: number,
  ): number {
    if (!totalItems || totalItems === 0) return 0;
    return parseFloat((((completedItems ?? 0) / totalItems) * 100).toFixed(2));
  }

  private async verifyDetails(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
  ): Promise<void> {
    const [user, course, courseVersion] = await Promise.all([
      this.userRepo.findById(userId),
      this.courseRepo.read(courseId),
      this.courseRepo.readVersion(courseVersionId),
    ]);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!course) {
      throw new NotFoundError('Course not found');
    }

    if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
      throw new NotFoundError(
        'Course version not found or does not belong to this course',
      );
    }
  }

  private async verifyProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
    cohort?: string,
  ): Promise<void> {
    const progress = await this.progressRepository.findProgress(
      userId,
      courseId,
      courseVersionId,
      cohort,
    );

    if (!progress) {
      throw new NotFoundError('Progress not found');
    }

    // Check if item is completed directly in db.
    const isItemCompleted = await this.progressRepository.isItemCompleted(
      userId,
      courseId,
      courseVersionId,
      itemId,
      cohort,
    );

    if (isItemCompleted) {
      return;
    }

    // if linear progression is not enabled then also continue
    const linearProgressionEnabled =
      await this.getCourseSettingService().isLinearProgressionEnabled(
        courseId,
        courseVersionId,
      );
    if (!linearProgressionEnabled) {
      return;
    }

    if (
      progress.currentModule.toString() !== moduleId ||
      progress.currentSection.toString() !== sectionId ||
      progress.currentItem.toString() !== itemId
    ) {
      throw new BadRequestError(
        'ModuleId, sectionId and itemId do not match current progress',
      );
    }
  }

  /**
   * Check if an item is a blank quiz
   */
  private async isBlankQuiz(
    versionId: string,
    itemId: string,
  ): Promise<boolean> {
    try {
      const item = await this.itemRepo.readItem(versionId, itemId);

      if (!item || item.type !== 'QUIZ') {
        return false;
      }

      const quizItem = item as any;
      const isBlank =
        !quizItem.details?.questionBankRefs ||
        quizItem.details.questionBankRefs.length === 0;
      return isBlank;
    } catch (error) {
      return false;
    }
  }

  private async findNextNonBlankItem(
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    itemId: string,
    maxDepth: number = 10,
    skippedBlankQuizIds: string[] = [],
  ): Promise<{
    moduleId: string;
    sectionId: string;
    itemId: string;
    completed: boolean;
    skippedBlankQuizIds: string[];
  } | null> {
    if (maxDepth <= 0) {
      return null;
    }

    const isBlank = await this.isBlankQuiz(
      courseVersion._id.toString(),
      itemId,
    );

    if (!isBlank) {
      return {
        moduleId,
        sectionId,
        itemId,
        completed: false,
        skippedBlankQuizIds,
      };
    }

    skippedBlankQuizIds.push(itemId);

    const nextProgress = await this.getNextItemInSequence(
      courseVersion,
      moduleId,
      sectionId,
      itemId,
    );

    if (!nextProgress) {
      return {
        moduleId,
        sectionId,
        itemId,
        completed: true,
        skippedBlankQuizIds,
      };
    }

    return await this.findNextNonBlankItem(
      courseVersion,
      nextProgress.moduleId,
      nextProgress.sectionId,
      nextProgress.itemId,
      maxDepth - 1,
      skippedBlankQuizIds,
    );
  }

  public async getNextItemInSequence(
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    itemId: string,
  ): Promise<{
    moduleId: string;
    sectionId: string;
    itemId: string;
    completed: boolean;
  } | null> {
    let isLastItem = false;
    let isLastSection = false;
    let isLastModule = false;

    // Check if the moduleId is the last module in the course
    const sortedModules = [...courseVersion.modules].sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    const lastModule = sortedModules[sortedModules.length - 1].moduleId;
    if (lastModule?.toString() === moduleId) {
      isLastModule = true;
    }

    // Check if the sectionId is the last section in the module
    const sortedSections = courseVersion.modules
      .find(module => module.moduleId?.toString() === moduleId)
      ?.sections.sort((a, b) => a.order.localeCompare(b.order));
    const lastSection = sortedSections?.[sortedSections.length - 1].sectionId;
    if (lastSection?.toString() === sectionId) {
      isLastSection = true;
    }

    // Check if the itemId is the last item in the section
    const itemsGroupId = courseVersion.modules
      .find(module => module.moduleId?.toString() === moduleId)
      ?.sections.find(
        section => section.sectionId?.toString() === sectionId,
      )?.itemsGroupId;
    const itemsGroup = await this.itemRepo.readItemsGroup(
      itemsGroupId?.toString(),
    );
    const sortedItems = itemsGroup.items.sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    const lastItem = sortedItems[sortedItems.length - 1]._id;
    if (lastItem === itemId) {
      isLastItem = true;
    }

    // Handle when the item is the last item in the last section of the last module
    if (isLastItem && isLastSection && isLastModule) {
      return null;
    }

    // Handle when the item is the last item in the last section but not the last module
    if (isLastItem && isLastSection && !isLastModule) {
      const currentModuleIndex = sortedModules.findIndex(
        module => module.moduleId?.toString() === moduleId,
      );
      const nextModule = sortedModules[currentModuleIndex + 1];
      const firstSection = nextModule?.sections.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[0];
      const itemsGroup = await this.itemRepo.readItemsGroup(
        firstSection?.itemsGroupId.toString(),
      );
      const firstItem = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[0];

      return {
        moduleId: nextModule?.moduleId.toString(),
        sectionId: firstSection?.sectionId.toString(),
        itemId: firstItem._id.toString(),
        completed: false,
      };
    }

    // Handle when the item is the last item in the section but not the last section
    if (isLastItem && !isLastSection) {
      const currentSectionIndex = sortedSections?.findIndex(
        section => section.sectionId?.toString() === sectionId,
      );
      const nextSection = sortedSections?.[currentSectionIndex + 1];
      const itemsGroup = await this.itemRepo.readItemsGroup(
        nextSection?.itemsGroupId.toString(),
      );
      const firstItem = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[0];

      return {
        moduleId,
        sectionId: nextSection?.sectionId.toString(),
        itemId: firstItem._id.toString(),
        completed: false,
      };
    }

    if (!isLastItem) {
      const currentItemIndex = sortedItems.findIndex(
        item => item._id.toString() === itemId,
      );
      const nextItem = sortedItems[currentItemIndex + 1];

      return {
        moduleId,
        sectionId,
        itemId: nextItem._id.toString(),
        completed: false,
      };
    }

    return null;
  }

  public async getPreviousItemInSequence(
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    itemId: string,
  ): Promise<{
    moduleId: string;
    sectionId: string;
    itemId: string;
  } | null> {
    let isFirstItem = false;
    let isFirstSection = false;
    let isFirstModule = false;

    const sortedModules = [...courseVersion.modules].sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    const firstModule = sortedModules[0].moduleId;
    if (firstModule?.toString() === moduleId) {
      isFirstModule = true;
    }

    const sortedSections = courseVersion.modules
      .find(module => module.moduleId?.toString() === moduleId)
      ?.sections.sort((a, b) => a.order.localeCompare(b.order));
    const firstSection = sortedSections?.[0].sectionId;
    if (firstSection?.toString() === sectionId) {
      isFirstSection = true;
    }

    const itemsGroupId = courseVersion.modules
      .find(module => module.moduleId?.toString() === moduleId)
      ?.sections.find(
        section => section.sectionId?.toString() === sectionId,
      )?.itemsGroupId;
    const itemsGroup = await this.itemRepo.readItemsGroup(
      itemsGroupId?.toString(),
    );
    const sortedItems = itemsGroup.items.sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    const firstItem = sortedItems[0]._id;
    if (firstItem === itemId) {
      isFirstItem = true;
    }

    if (isFirstItem && isFirstSection && isFirstModule) {
      return null;
    }

    if (isFirstItem && isFirstSection && !isFirstModule) {
      const currentModuleIndex = sortedModules.findIndex(
        module => module.moduleId?.toString() === moduleId,
      );
      const prevModule = sortedModules[currentModuleIndex - 1];
      const lastSection = prevModule?.sections.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[prevModule.sections.length - 1];
      const itemsGroup = await this.itemRepo.readItemsGroup(
        lastSection?.itemsGroupId.toString(),
      );
      const lastItem = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[itemsGroup.items.length - 1];

      return {
        moduleId: prevModule?.moduleId.toString(),
        sectionId: lastSection?.sectionId.toString(),
        itemId: lastItem._id.toString(),
      };
    }

    if (isFirstItem && !isFirstSection) {
      const currentSectionIndex = sortedSections?.findIndex(
        section => section.sectionId?.toString() === sectionId,
      );
      const prevSection = sortedSections?.[currentSectionIndex - 1];
      const itemsGroup = await this.itemRepo.readItemsGroup(
        prevSection?.itemsGroupId?.toString(),
      );
      const lastItem = itemsGroup?.items?.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[itemsGroup.items.length - 1];

      return {
        moduleId,
        sectionId: prevSection?.sectionId?.toString() || '',
        itemId: lastItem?._id?.toString() || '',
      };
    }

    if (!isFirstItem) {
      const currentItemIndex = sortedItems?.findIndex(
        item => item._id.toString() === itemId,
      );
      const prevItem = sortedItems[currentItemIndex - 1];

      return {
        moduleId,
        sectionId,
        itemId: prevItem?._id?.toString() || '',
      };
    }

    return null;
  }

  public async getPreviousVideoItem(
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    itemId: string,
  ): Promise<{
    moduleId: string;
    sectionId: string;
    itemId: string;
  } | null> {
    let currentModuleId = moduleId;
    let currentSectionId = sectionId;
    let currentItemId = itemId;

    while (true) {
      const prevItem = await this.getPreviousItemInSequence(
        courseVersion,
        currentModuleId,
        currentSectionId,
        currentItemId,
      );

      if (!prevItem) {
        return null;
      }

      const itemDetails = await this.itemRepo.readItem(
        courseVersion._id.toString(),
        prevItem.itemId,
      );

      if (itemDetails?.type === 'VIDEO') {
        return prevItem;
      }

      currentModuleId = prevItem.moduleId;
      currentSectionId = prevItem.sectionId;
      currentItemId = prevItem.itemId;
    }
  }

  private async getFirstItemInSequence(
    courseVersion: ICourseVersion,
  ): Promise<{
    moduleId: string;
    sectionId: string;
    itemId: string;
    completed: boolean;
  } | null> {
    const sortedModules = [...courseVersion.modules].sort((a, b) =>
      a.order.localeCompare(b.order),
    );

    const firstModule = sortedModules[0];
    if (!firstModule) return null;

    const sortedSections = [...firstModule.sections].sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    const firstSection = sortedSections[0];
    if (!firstSection) return null;

    const itemsGroup = await this.itemRepo.readItemsGroup(
      firstSection.itemsGroupId.toString(),
    );

    if (!itemsGroup?.items?.length) return null;

    const sortedItems = [...itemsGroup.items].sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    const firstItem = sortedItems[0];
    if (!firstItem) return null;

    return {
      moduleId: firstModule.moduleId.toString(),
      sectionId: firstSection.sectionId.toString(),
      itemId: firstItem._id.toString(),
      completed: false,
    };
  }

  private async findFirstIncompleteItemInSequence(
    courseVersion: ICourseVersion,
    completedItemsSet: Set<string>,
  ): Promise<{
    moduleId: string;
    sectionId: string;
    itemId: string;
    completed: boolean;
  } | null> {
    let cursor = await this.getFirstItemInSequence(courseVersion);
    let safetyCounter = 0;
    const MAX_ITERATIONS = 10000;

    while (cursor && safetyCounter < MAX_ITERATIONS) {
      if (!completedItemsSet.has(cursor.itemId)) {
        return cursor;
      }

      const next = await this.getNextItemInSequence(
        courseVersion,
        cursor.moduleId,
        cursor.sectionId,
        cursor.itemId,
      );

      if (!next) {
        return null;
      }

      cursor = {
        moduleId: next.moduleId,
        sectionId: next.sectionId,
        itemId: next.itemId,
        completed: false,
      };
      safetyCounter++;
    }

    return null;
  }

  public async determineNextAllowedItem(
    currentItemId: string,
    quizMetrics: any,
    enrollment: any,
  ): Promise<{ nextItemId?: string }> {
    try {
      if (quizMetrics?.remainingAttempts !== 0) {
        return {}; // No permission update needed
      }

      const itemsGroup =
        await this.itemRepo.findItemsGroupByItemId(currentItemId);
      if (!itemsGroup) {
        throw new NotFoundError('Item group not found for current item');
      }

      const items = itemsGroup.items || [];
      if (!Array.isArray(items) || items.length === 0) {
        throw new NotFoundError('No items found inside the item group');
      }

      const currentIndex = items.findIndex(
        item => item?._id?.toString() === currentItemId,
      );

      if (currentIndex === -1) {
        throw new NotFoundError(`Item not found in group: ${currentItemId}`);
      }

      const nextItem = items[currentIndex + 1];

      if (nextItem && nextItem?._id) {
        return { nextItemId: nextItem?._id?.toString() };
      }

      // No next item → check next section/module
      if (!itemsGroup || !itemsGroup._id) {
        throw new NotFoundError('Invalid itemsGroup: missing id');
      }

      const itemGroupId = itemsGroup?._id?.toString();
      const groupInfo = await this.courseRepo.getItemGroupInfo(itemGroupId);

      if (!groupInfo) {
        throw new NotFoundError(
          `Module/Section not found for itemGroupId: ${itemGroupId}`,
        );
      }

      const courseVersion = await this.courseRepo.readVersion(
        enrollment.versionId,
      );
      if (!courseVersion) {
        throw new NotFoundError('Invalid course version');
      }

      const { moduleId, sectionId } = groupInfo;
      if (!moduleId || !sectionId) {
        throw new NotFoundError(
          'Invalid course mapping: Module or Section missing',
        );
      }

      const nextItemDetails = await this.getNextItemInSequence(
        courseVersion,
        moduleId.toString(),
        sectionId.toString(),
        currentItemId,
      );

      if (nextItemDetails?.itemId) {
        return { nextItemId: nextItemDetails.itemId.toString() };
      }

      return {};
    } catch (error: any) {
      console.error('Error in next-item permission processing:', error);

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new InternalServerError(
        'Failed to determine next allowed item: ' + error?.message,
      );
    }
  }
  private async findNextPlayableItem(
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    itemId: string,
    completedItems: Set<string>,
    skippedBlankQuizIds: string[] = [],
    maxDepth = 20,
  ): Promise<{
    moduleId: string;
    sectionId: string;
    itemId: string;
    skippedBlankQuizIds: string[];
  } | null> {
    if (maxDepth <= 0) return null;

    // Skip already completed items
    if (completedItems.has(itemId)) {
      const next = await this.getNextItemInSequence(
        courseVersion,
        moduleId,
        sectionId,
        itemId,
      );
      if (!next) return null;

      return this.findNextPlayableItem(
        courseVersion,
        next.moduleId,
        next.sectionId,
        next.itemId,
        completedItems,
        skippedBlankQuizIds,
        maxDepth - 1,
      );
    }

    const isBlank = await this.isBlankQuiz(
      courseVersion._id.toString(),
      itemId,
    );

    if (!isBlank) {
      return { moduleId, sectionId, itemId, skippedBlankQuizIds };
    }

    // Blank quiz → auto-skip
    skippedBlankQuizIds = [...skippedBlankQuizIds, itemId];

    const next = await this.getNextItemInSequence(
      courseVersion,
      moduleId,
      sectionId,
      itemId,
    );

    if (!next) return null;

    return this.findNextPlayableItem(
      courseVersion,
      next.moduleId,
      next.sectionId,
      next.itemId,
      completedItems,
      skippedBlankQuizIds,
      maxDepth - 1,
    );
  }

  getUserMetricsForQuiz(userId: string, quizId: string) {
    return this._withTransaction(async session => {
      const metrics = await this.userQuizMetricsRepository.get(
        userId,
        quizId,
        undefined,
        session,
      );
      if (!metrics) return;
      metrics._id = metrics?._id?.toString();
      metrics.quizId = metrics.quizId?.toString();
      if (Array.isArray(metrics.attempts)) {
        metrics.attempts = metrics.attempts.map(attempt => ({
          ...attempt,
          attemptId: attempt.attemptId?.toString(),
        }));
      }
      return metrics;
    });
  }

  private async getNewProgress(
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    itemId: string,
    userId: string,
  ) {
    const completedItems = await this.progressRepository.getCompletedItems(
      userId,
      courseVersion.courseId.toString(),
      courseVersion._id.toString(),
    );

    const nextSequenceItem = await this.getNextItemInSequence(
      courseVersion,
      moduleId,
      sectionId,
      itemId,
    );

    if (!nextSequenceItem) {
      // return {
      //   completed: true,
      //   completedAt: new Date(),
      //   currentModule: moduleId,
      //   currentSection: sectionId,
      //   currentItem: itemId,
      //   skippedBlankQuizIds: [],
      // };
      const initialProgress = await this.initializeProgress(
        userId,
        courseVersion.courseId.toString(),
        courseVersion._id.toString(),
        courseVersion,
      );

      return {
        completed: true,
        completedAt: new Date(),
        currentModule: initialProgress.currentModule,
        currentSection: initialProgress.currentSection,
        currentItem: initialProgress.currentItem,
        skippedBlankQuizIds: [],
      };
    }

    const nextNonBlankItem = await this.findNextNonBlankItem(
      courseVersion,
      nextSequenceItem.moduleId,
      nextSequenceItem.sectionId,
      nextSequenceItem.itemId,
    );

    if (!nextNonBlankItem) {
      // return {
      //   completed: true,
      //   completedAt: new Date(),
      //   currentModule: moduleId,
      //   currentSection: sectionId,
      //   currentItem: itemId,
      //   skippedBlankQuizIds: [],
      // };
      const initialProgress = await this.initializeProgress(
        userId,
        courseVersion.courseId.toString(),
        courseVersion._id.toString(),
        courseVersion,
      );

      return {
        completed: true,
        completedAt: new Date(),
        currentModule: initialProgress.currentModule,
        currentSection: initialProgress.currentSection,
        currentItem: initialProgress.currentItem,
        skippedBlankQuizIds: [],
      };
    }

    if (
      nextNonBlankItem.itemId &&
      completedItems.includes(nextNonBlankItem.itemId)
    ) {
      return null;
    }

    return {
      completed: nextNonBlankItem.completed,
      currentModule: nextNonBlankItem.moduleId,
      currentSection: nextNonBlankItem.sectionId,
      currentItem: nextNonBlankItem.itemId,
      skippedBlankQuizIds: nextNonBlankItem.skippedBlankQuizIds || [],
    };
  }

  private parseTimeToSeconds(timeStr: string) {
    const parts = timeStr.split(':').map(Number);

    if (parts.length === 3) {
      // HH:MM:SS
      const [hours, minutes, seconds] = parts;
      return hours * 3600 + minutes * 60 + seconds;
    }

    if (parts.length === 2) {
      // MM:SS
      const [minutes, seconds] = parts;
      return minutes * 60 + seconds;
    }

    throw new Error('Invalid time format');
  }

  private isValidWatchTime(watchTime: IWatchTime, item: Item) {
    // Basic sanity checks
    if (!watchTime.startTime || !watchTime.endTime || !item.details) {
      return false;
    }

    const watchStartTime = new Date(watchTime.startTime);
    const watchEndTime = new Date(watchTime.endTime);

    // Server-side measured duration in seconds
    const serverDuration =
      Math.abs(watchEndTime.getTime() - watchStartTime.getTime()) / 1000;

    // Buffer for latency/load (add 5 seconds to the server's measured time)
    // This assumes the user actually watched longer, but the server started late or ended early
    // Effectively, we are saying If the server saw 5s, maybe they actually watched 10s
    const adjustedDuration = serverDuration + 5;

    switch (item.type) {
      case 'VIDEO':
        const videoDetails = item.details as IVideoDetails;
        if (!videoDetails.startTime || !videoDetails.endTime) return false;

        // parse it to seconds through liabrary
        const videoEndTimeInSeconds = this.parseTimeToSeconds(
          videoDetails.endTime,
        );
        // parseInt(videoDetails.endTime.split(':')[0]) * 3600 +
        // parseInt(videoDetails.endTime.split(':')[1]) * 60 +
        // parseInt(videoDetails.endTime.split(':')[2]);
        const videoStartTimeInSeconds = this.parseTimeToSeconds(
          videoDetails.startTime,
        );
        // parseInt(videoDetails.startTime.split(':')[0]) * 3600 +
        // parseInt(videoDetails.startTime.split(':')[1]) * 60 +
        // parseInt(videoDetails.startTime.split(':')[2]);

        const totalVideoDuration =
          videoEndTimeInSeconds - videoStartTimeInSeconds;

        // Security Rule
        // - Must have watched at least 15% of the video
        // OR
        // - If the video is long, must have watched at least 30 seconds
        const minimumRequired = Math.min(totalVideoDuration * 0.15, 30);

        return adjustedDuration >= minimumRequired;

      case 'BLOG':
        const blogDetails = item.details as IBlogDetails;
        // Estimated read time is in minutes
        const readTimeSeconds =
          (blogDetails.estimatedReadTimeInMinutes || 1) * 60;

        // Require at least 10% of estimated time OR 10 seconds
        // This stops instant click-throughs but doesn't punish fast readers
        const minReadTime = Math.min(readTimeSeconds * 0.1, 10);

        return adjustedDuration >= minReadTime;

      default:
        return true;
    }
  }

  async getUserProgress(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ): Promise<Progress> {
    return this._withTransaction(async session => {
      // Verify if the user, course, and course version exist
      await this.verifyDetails(userId, courseId, courseVersionId);

      const progress = await this.progressRepository.findProgress(
        userId,
        courseId,
        courseVersionId,
        cohortId
      );

      if (progress?.completed === true) {
        const courseVersion =
          await this.courseRepo.readVersion(courseVersionId);

        const initialProgress = await this.initializeProgress(
          userId.toString(),
          courseId,
          courseVersionId,
          courseVersion,
        );

        progress.currentModule = initialProgress.currentModule;
        progress.currentSection = initialProgress.currentSection;
        progress.currentItem = initialProgress.currentItem;
      }

      // if (!progress) {
      //   throw new NotFoundError('Progress not found');
      // }

      return Object.assign(new Progress(), progress);
    });
  }

  async getCurrentProgressPath(
    userId: string,
    courseId: string,
    versionId: string,
    cohortId?: string,
  ): Promise<ICurrentProgressPath> {
    const progress = await this.progressRepository.findProgress(
      userId,
      courseId,
      versionId,
      cohortId
    );

    if (!progress) {
      return {
        module: null,
        section: null,
        item: null,
        message: 'No progress found',
      };
    }

    if (!progress.currentItem) {
      return {
        module: null,
        section: null,
        item: null,
        message: 'Progress not started',
      };
    }

    const { currentModule, currentSection, currentItem } = progress;

    try {
      const module = await this.courseRepo.getModulebyId(
        versionId,
        currentModule.toString(),
      );

      if (!module) {
        return {
          module: null,
          section: null,
          item: null,
          message: 'Module not found',
        };
      }

      const section = module.sections.find(
        s => s.sectionId.toString() === currentSection.toString(),
      );

      if (!section) {
        return {
          module: { id: module.moduleId.toString(), name: module.name },
          section: null,
          item: null,
          message: 'Section not found',
        };
      }

      // Get the actual item details
      const itemDetails = await this.itemRepo.readItem(
        versionId,
        currentItem.toString(),
      );

      return {
        module: { id: module.moduleId.toString(), name: module.name },
        section: { id: section.sectionId.toString(), name: section.name },
        item: {
          id: itemDetails?._id?.toString() || currentItem.toString(),
          name: itemDetails?.name || 'Unknown Item',
          type: itemDetails?.type || 'unknown',
        },
      };
    } catch (error) {
      return {
        module: null,
        section: null,
        item: null,
        message: 'Error occurred: ' + error.message,
      };
    }
  }

  async getUserProgressPercentage(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ): Promise<CompletedProgressResponse> {
    return this._withTransaction(async session => {
      await this.verifyDetails(userId, courseId, courseVersionId);

      const progress = await this.progressRepository.findProgress(
        userId,
        courseId,
        courseVersionId,
        cohortId,
        session,
      );

      const totalItems = await this.itemRepo.getTotalItemsCount(
        courseId,
        courseVersionId,
        session,
      );

      const completedItemsArray =
        await this.progressRepository.getCompletedItems(
          userId.toString(),
          courseId,
          courseVersionId,
          cohortId,
          session,
        );

      const enrollment = await this.enrollmentRepo.findEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohortId,
        session,
      );

      if (!progress) {
        throw new NotFoundError('Progress not found');
      }

      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      const completedItemsSet = new Set(completedItemsArray);

      return {
        completed: progress.completed,
        percentCompleted: enrollment.percentCompleted,
        totalItems,
        completedItems: completedItemsSet.size,
      };
    });
  }

  async getUserProgressPercentageWithoutTotal(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    cohort?: string,
    existingSession?: ClientSession,
  ): Promise<number> {
    const run = async (session?: ClientSession): Promise<number> => {
      // 🔥 Parallelize independent work

      await this.verifyDetails(userId, courseId, courseVersionId);

      const enrollment = await this.enrollmentRepo.findEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohort,
        existingSession,
      );
      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }
      return enrollment.completedItemsCount;
    };

    return this._withTransaction(async session => {
      const completedItemsArray =
        await this.progressRepository.getCompletedItems(
          userId.toString(),
          courseId,
          courseVersionId,
          cohort,
          session,
        );

      return new Set(completedItemsArray).size;
    });
  }

  async startItem(
    userId: string,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
    cohortId?: string,
  ): Promise<string> {
    // console.log(`Starting item tracking for user ${userId}, course ${courseId}, version ${courseVersionId}, item ${itemId}, cohort ${cohortId}`);
    return this._withTransaction(async session => {

      const versionStatus = await this.courseRepo.getCourseVersionStatus(courseVersionId);

      if (versionStatus === "archived") {
        throw new ForbiddenError("This course version is inactive, you can't start item");
      }
      // Check if item is already completed before creating watchTime
      const isItemCompleted = await this.progressRepository.isItemCompleted(
        userId,
        courseId,
        courseVersionId,
        itemId,
        cohortId,
        session,
      );

      if (isItemCompleted) {
        // Item is already completed, skip watchTime creation and return existing watchTime or null
        const existingWatchTime = await this.progressRepository.getWatchTime(
          userId,
          itemId,
          courseId,
          courseVersionId,
          cohortId,
          session,
        );
        return '';
      }

      // 🔥 Parallelize independent verifications
      await Promise.all([
        this.verifyDetails(userId, courseId, courseVersionId),
        this.verifyProgress(
          userId,
          courseId,
          courseVersionId,
          moduleId,
          sectionId,
          itemId,
          cohortId,
        ),
      ]);

      // 🔒 Write happens AFTER validations
      const result = await this.progressRepository.startItemTracking(
        userId,
        courseId,
        courseVersionId,
        itemId,
        cohortId,
        session,
      );

      const linearProgressionEnabled =
        await this.getCourseSettingService().isLinearProgressionEnabled(
          courseId,
          courseVersionId,
        );
      if (!linearProgressionEnabled) {
        const newProgress: Partial<IProgress> = {
          completed: isItemCompleted,
          currentModule: moduleId,
          currentSection: sectionId,
          currentItem: itemId,
          ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {}),
        };

        await this.progressRepository.updateProgress(
          userId,
          courseId,
          courseVersionId,
          newProgress,
          cohortId
        );
      }

      return result;
    });
  }

  // async stopIte(
  //   userId: string,
  //   courseId: string,
  //   courseVersionId: string,
  //   itemId: string,
  //   sectionId: string,
  //   moduleId: string,
  //   watchItemId: string,
  //   attemptId?: string,
  //   isSkipped?: boolean,
  //   seekForwardEnabled?: boolean,
  // ): Promise<void> {
  //   /* ----------------------------------------------------
  //      1. READ-ONLY PRE-VALIDATION (NO TRANSACTION)
  //   ---------------------------------------------------- */

  //   const [user, course, courseVersion, linearProgressionEnabled, progress] = await Promise.all([
  //     this.userRepo.findById(userId),
  //     this.courseRepo.read(courseId),
  //     this.courseRepo.readVersion(courseVersionId),
  //     this.settingsRepo.isLinearProgressionEnabled(courseId, courseVersionId),
  //     this.progressRepository.findProgress(userId, courseId, courseVersionId),
  //   ]);

  //   console.log("Linear progression setting in stopItem:", linearProgressionEnabled)

  //   if (!user) throw new NotFoundError('User not found');
  //   if (!course) throw new NotFoundError('Course not found');
  //   if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
  //     throw new NotFoundError('Invalid course version');
  //   }

  //   // Check if item is already completed before stopping watchTime
  //   const isItemCompleted = await this.progressRepository.isItemCompleted(
  //     userId,
  //     courseId,
  //     courseVersionId,
  //     itemId,
  //   );

  //   if (!progress) throw new NotFoundError('Progress not found');

  //   const item = await this.itemRepo.readItem(courseVersionId, itemId);
  //   if (!item) throw new NotFoundError('Item not found');

  //   /* ----------------------------------------------------
  //      2. ITEM-TYPE VALIDATIONS (NO TRANSACTION)
  //   ---------------------------------------------------- */

  //   let isQuizFailed = false;
  //   if (item.type === 'QUIZ' && !isSkipped) {
  //     const submittedQuiz = await this.submissionRepository.get(
  //       itemId,
  //       userId,
  //       attemptId,
  //     );
  //     if (!submittedQuiz) throw new BadRequestError('Quiz not submitted');
  //     if (submittedQuiz.gradingResult.gradingStatus !== 'PASSED') {
  //       isQuizFailed = true;
  //     }
  //   }

  //   if (
  //     (progress.currentModule.toString() !== moduleId ||
  //       progress.currentSection.toString() !== sectionId ||
  //       progress.currentItem.toString() !== itemId) && linearProgressionEnabled
  //   ) {
  //     if (item.type !== 'QUIZ' && !isItemCompleted) {
  //       throw new BadRequestError('Progress mismatch');
  //     }
  //   }

  //   if (item.type === 'PROJECT') {
  //     const projectSubmission = await this.projectSubmissionRepo.getByUser(
  //       userId,
  //       courseVersionId,
  //       courseId,
  //     );
  //     if (
  //       !projectSubmission ||
  //       projectSubmission.projectId.toString() !== itemId
  //     ) {
  //       throw new BadRequestError('Project not submitted');
  //     }
  //   }

  //   /* ----------------------------------------------------
  //      3. TRANSACTION (SHORT & CRITICAL ONLY)
  //   ---------------------------------------------------- */

  //   let completedItemsSet!: Set<string>;
  //   let newProgress!: any;

  //   await this._withTransaction(async session => {
  //     let stoppedWatchTime = null;
  //     // Only stop tracking (set endTime) for non-quiz items or when we're certain it should be marked as completed
  //     // For quizzes, endTime should only be set when they are actually submitted and graded
  //     if (!isQuizFailed && (item.type !== 'QUIZ')) {
  //       stoppedWatchTime = await this.progressRepository.stopItemTracking(
  //         watchItemId,
  //         session,
  //       );

  //       if (!stoppedWatchTime) {
  //         throw new NotFoundError('Watch item not found');
  //       }

  //       if (
  //         stoppedWatchTime &&
  //         (item.type === 'VIDEO' || item.type === 'BLOG') &&
  //         !seekForwardEnabled
  //       ) {
  //         if (!this.isValidWatchTime(stoppedWatchTime, item)) {
  //           throw new BadRequestError('Invalid watch time');
  //         }
  //       }
  //     }

  //     // Get completed items (needed for both passed and failed quizzes)
  //     const completedItemsArray =
  //       await this.progressRepository.getCompletedItems(
  //         userId,
  //         courseId,
  //         courseVersionId,
  //         session,
  //       );

  //     completedItemsSet = new Set(completedItemsArray.map(id => id.toString()));

  //     if (isQuizFailed) {
  //       const previousVideoItem = await this.getPreviousVideoItem(
  //         courseVersion,
  //         moduleId,
  //         sectionId,
  //         itemId,
  //       );

  //       if (!previousVideoItem) {
  //         throw new BadRequestError(
  //           'Quiz failed and no previous video found to review',
  //         );
  //       }

  //       newProgress = {
  //         completed: false,
  //         currentModule: previousVideoItem.moduleId,
  //         currentSection: previousVideoItem.sectionId,
  //         currentItem: previousVideoItem.itemId,
  //         skippedBlankQuizIds: [],
  //       };

  //       await this.progressRepository.updateProgress(
  //         userId,
  //         courseId,
  //         courseVersionId,
  //         newProgress,
  //         session,
  //       );
  //     } else {
  //       completedItemsSet.add(itemId);

  //       // Find next item
  //       const nextItem = await this.findNextPlayableItem(
  //         courseVersion,
  //         moduleId,
  //         sectionId,
  //         itemId,
  //         completedItemsSet,
  //       );


  //       if (nextItem) {
  //         newProgress = {
  //           completed: false,
  //           currentModule: nextItem.moduleId,
  //           currentSection: nextItem.sectionId,
  //           currentItem: nextItem.itemId,
  //           skippedBlankQuizIds: nextItem.skippedBlankQuizIds || [],
  //         };
  //       } else {
  //         // Course completed → reset to first item
  //         const initialProgress = await this.initializeProgress(
  //           userId,
  //           courseId,
  //           courseVersionId,
  //           courseVersion,
  //         );

  //         newProgress = {
  //           completed: true,
  //           completedAt: new Date(),
  //           currentModule: initialProgress.currentModule,
  //           currentSection: initialProgress.currentSection,
  //           currentItem: initialProgress.currentItem,
  //           skippedBlankQuizIds: [],
  //         };
  //       }

  //       for (const blankQuizId of newProgress.skippedBlankQuizIds) {
  //         await this.progressRepository.startItemTracking(
  //           userId,
  //           courseId,
  //           courseVersionId,
  //           blankQuizId,
  //           session,
  //         );

  //         const wt = await this.progressRepository.getWatchTime(
  //           userId,
  //           blankQuizId,
  //           courseId,
  //           courseVersionId,
  //           session,
  //         );

  //         if (wt?.length) {
  //           await this.progressRepository.stopItemTracking(
  //             wt[0]._id.toString(),
  //             session,
  //           );
  //         }
  //       }

  //       await this.progressRepository.updateProgress(
  //         userId,
  //         courseId,
  //         courseVersionId,
  //         newProgress,
  //         session,
  //       );
  //     }
  //   });

  //   /* ----------------------------------------------------
  //      4. DERIVED DATA UPDATE (NO TRANSACTION)
  //   ---------------------------------------------------- */

  //   const enrollment = await this.enrollmentRepo.findEnrollment(
  //     userId,
  //     courseId,
  //     courseVersionId,
  //   );
  //   if (!enrollment) return;

  //   const totalItems =
  //     courseVersion.totalItems ??
  //     (await this.itemRepo.CalculateTotalItemsCount(courseId, courseVersionId));

  //   const rawPercent =
  //     totalItems > 0 ? (completedItemsSet.size / totalItems) * 100 : 0;

  //   const percentCompleted = Math.min(
  //     100,
  //     parseFloat(rawPercent.toFixed(2)),
  //   );

  //   await this.enrollmentRepo.updateProgressPercentById(
  //     enrollment._id.toString(),
  //     percentCompleted,
  //     undefined,
  //     completedItemsSet.size,
  //   );

  //   if (percentCompleted > 99) {
  //     await this.recalculateStudentProgress(userId, courseId, courseVersionId);
  //   }
  // }


  async stopItem(
    userId: string,
    courseId: string,
    courseVersionId: string,
    itemId: string,
    sectionId: string,
    moduleId: string,
    watchItemId: string,
    attemptId?: string,
    isSkipped?: boolean,
    seekForwardEnabled?: boolean,
    nextItemId?: string,
    cohortId?: string,
  ): Promise<void> {
    // console.log(`Stopping item tracking for user ${userId}, course ${courseId}, version ${courseVersionId}, item ${itemId}, cohort ${cohortId}`);
    // Fetch course version, progress, item, and linear progression setting in parallel
    const [courseVersion, progress, item, linearProgressionEnabled] = await Promise.all([
      this.courseRepo.readVersion(courseVersionId),
      this.progressRepository.findProgress(userId, courseId, courseVersionId, cohortId),
      this.itemRepo.readItemById(itemId),
      this.getCourseSettingService().isLinearProgressionEnabled(courseId, courseVersionId),
    ]);

    // Validate existence of course, progress, and item
    if (!courseVersion || courseVersion.courseId.toString() !== courseId)
      throw new NotFoundError('Invalid course version');
    if (!progress) throw new NotFoundError('Progress not found');
    if (!item) throw new NotFoundError('Item not found');

    const versionStatus = await this.courseRepo.getCourseVersionStatus(courseVersionId);

    if (versionStatus === "archived") {
      throw new ForbiddenError("This course version is inactive, you can't stop item");
    }

    /**
     * Quiz retry handling:
     *
     * When a student fails a quiz, the system still marks the quiz as completed
     * and the course progress moves back to the previous video item.
     *
     * Because of this behavior, during a re-attempt the student's currentItem
     * will point to the previous video instead of the quiz. Without this check,
     * the startItem validation would incorrectly throw a permission/progress error
     * while trying to re-attempt the quiz.
     *
     * Therefore, this logic ensures the student is allowed to re-attempt the quiz
     * even though the progress currentItem is positioned at the previous video.
     */
    if (item.type !== 'QUIZ') {
      // Ensure current progress matches the module, section, and item
      this.validateProgressPosition(progress, moduleId, sectionId, itemId);
    }

    await this._withTransaction(async session => {
      let stoppedWatchTime = null;
      let shouldCountCurrentItemAsCompleted = false;

      // For quizzes, only set endTime if they are passed
      // For non-quizzes, set endTime normally
      if (item.type !== 'QUIZ') {
        if (!isSkipped) {
          stoppedWatchTime = await this.progressRepository.stopItemTracking(watchItemId, cohortId, session);

          if (!stoppedWatchTime) {
            throw new NotFoundError('Watch time not found or already stopped');
          }

          // Validate eligibility based on item type (PROJECT, VIDEO, BLOG) and currentItem
          await this.validateItemStopEligibility(
            item,
            itemId,
            userId,
            courseId,
            courseVersionId,
            attemptId,
            isSkipped,
            stoppedWatchTime,
            cohortId,
          );

          shouldCountCurrentItemAsCompleted = true;
        }
      }

      let nextItem = null;

      // Determine next item either from client-provided ID or sequence
      if (nextItemId) {
        const nextItemEntity = await this.itemRepo.readItemById(nextItemId);

        if (!nextItemEntity) {
          throw new BadRequestError('Invalid next item');
        }

        nextItem = {
          moduleId,
          sectionId,
          itemId: nextItemId,
        };
      } else {
        nextItem = await this.getNextItemInSequence(
          courseVersion,
          moduleId,
          sectionId,
          itemId,
        );
      }

      // Check if this is the last item in the sequence
      let isCompleted = !nextItem;

      const allCourseItemIds = await this.getAllItemIds(courseVersionId);
      const allCourseItemIdSet = new Set(allCourseItemIds.map(id => id.toString()));
      const totalCourseItems = allCourseItemIdSet.size;

      // When linear progression is disabled, being sequentially last is NOT enough.
      // All items in the course must actually be completed before marking as done.
      if (!linearProgressionEnabled && isCompleted) {
        const completedItemsArray = await this.progressRepository.getCompletedItems(
          userId,
          courseId,
          courseVersionId,
          cohortId,
        );
        const completedItemsSet = new Set(completedItemsArray.map(id => id.toString()));
        if (shouldCountCurrentItemAsCompleted) {
          completedItemsSet.add(itemId);
        }
        const effectiveCompleted = Array.from(allCourseItemIdSet).filter(id =>
          completedItemsSet.has(id),
        ).length;
        isCompleted = effectiveCompleted >= totalCourseItems;

        if (!isCompleted) {
          nextItem = await this.findFirstIncompleteItemInSequence(
            courseVersion,
            completedItemsSet,
          );

          if (!nextItem) {
            nextItem = {
              moduleId,
              sectionId,
              itemId,
              completed: false,
            };
          }
        }
      }

      // Prepare the progress update payload
      let newProgress: Partial<IProgress> = isCompleted
        ? {
          currentModule: moduleId,
          currentSection: sectionId,
          currentItem: itemId,
          completed: true,
          completedAt: new Date(),
          ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {}),
        }
        : {
          completed: false,
          currentModule: nextItem.moduleId,
          currentSection: nextItem.sectionId,
          currentItem: nextItem.itemId,
          ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {}),
        };

      if (item.type === 'QUIZ' && !isSkipped) {
        let isQuizFailed = false;
        const submittedQuiz = await this.submissionRepository.get(
          itemId,
          userId,
          attemptId,
        );
        if (!submittedQuiz) throw new BadRequestError('Quiz not submitted');
        if (submittedQuiz.gradingResult.gradingStatus !== 'PASSED') {
          isQuizFailed = true;
        }

        if (isQuizFailed) {
          const previousVideoItem = await this.getPreviousVideoItem(
            courseVersion,
            moduleId,
            sectionId,
            itemId,
          );

          if (!previousVideoItem) {
            throw new BadRequestError(
              'Quiz failed and no previous video found to review',
            );
          }

          newProgress = {
            completed: false,
            currentModule: previousVideoItem.moduleId,
            currentSection: previousVideoItem.sectionId,
            currentItem: previousVideoItem.itemId,
            ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {}),
            // skippedBlankQuizIds: [],
          };
        } else {
          // Quiz passed - set endTime, progress update is handled by the original logic above
          await this.progressRepository.stopItemTracking(watchItemId, cohortId, session);
          shouldCountCurrentItemAsCompleted = true;
        }
      }

      /* ----------------------------------------------------
      4. DERIVED DATA UPDATE (NO TRANSACTION)
   ---------------------------------------------------- */

      const enrollment = await this.enrollmentRepo.findEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohortId
      );
      if (!enrollment) return;

      const totalItems =
        totalCourseItems;

      // Get completed items for progress calculation
      const completedItemsArray =
        await this.progressRepository.getCompletedItems(
          userId,
          courseId,
          courseVersionId,
          cohortId,
        );
      const completedItemsSet = new Set(
        completedItemsArray.map(id => id.toString()),
      );
      if (shouldCountCurrentItemAsCompleted) {
        completedItemsSet.add(itemId);
      }

      const completedCourseItemsCount = Array.from(allCourseItemIdSet).filter(id =>
        completedItemsSet.has(id),
      ).length;

      const rawPercent =
        totalItems > 0 ? (completedCourseItemsCount / totalItems) * 100 : 0;

      const percentCompleted = Math.min(100, parseFloat(rawPercent.toFixed(2)));

      await this.enrollmentRepo.updateProgressPercentById(
        enrollment._id.toString(),
        percentCompleted,
        completedCourseItemsCount,
        cohortId,
      );

      if (percentCompleted > 99) {
        await this.recalculateStudentProgress(userId, courseId, courseVersionId, cohortId);
      }

      // Update progress in a transaction
      await this.progressRepository.updateProgress( // pending
        userId,
        courseId,
        courseVersionId,
        newProgress,
        cohortId,
        session,
      );
    });
  }

  private validateProgressPosition(
    progress: IProgress,
    moduleId: string,
    sectionId: string,
    itemId: string,
  ): void {
    if (progress.currentModule?.toString() !== moduleId) {
      throw new BadRequestError(
        'Module ID does not match current progress position',
      );
    }

    if (progress.currentSection?.toString() !== sectionId) {
      throw new BadRequestError(
        'Section ID does not match current progress position',
      );
    }

    if (progress.currentItem?.toString() !== itemId) {
      throw new BadRequestError(
        'Item ID does not match current progress position',
      );
    }
  }

  // Validate whether the current item can be stopped
  private async validateItemStopEligibility(
    item: Item,
    itemId: string,
    userId: string,
    courseId: string,
    courseVersionId: string,
    attemptId?: string,
    isSkipped?: boolean,
    stoppedWatchTime?: IWatchTime,
    cohortId?: string,
  ): Promise<void> {
    const WATCH_TIME_REQUIRED_ITEMS = new Set<string>(['VIDEO', 'BLOG']);

    // 1 Watch-time based items
    if (WATCH_TIME_REQUIRED_ITEMS.has(item.type)) {
      this.validateWatchTime(item, stoppedWatchTime);
      return;
    }

    // 2 Quiz validation
    // if (item.type === 'QUIZ') {
    //   await this.validateQuizStop(itemId, userId, courseId,
    //     courseVersionId, attemptId, isSkipped);
    //   return;
    // }

    // 3 Project validation
    if (item.type === 'PROJECT') {
      await this.validateProjectStop(itemId, userId, courseId, courseVersionId, cohortId);
      return;
    }
  }

  private validateWatchTime(item: Item, stoppedWatchTime?: IWatchTime): void {
    if (!stoppedWatchTime) {
      throw new BadRequestError('Watch time not found');
    }

    if (!this.isValidWatchTime(stoppedWatchTime, item)) {
      throw new BadRequestError('Invalid watch time');
    }
  }

  private async validateQuizStop(
    // when a quiz is failed then also stop is being called at frontend
    itemId: string,
    userId: string,
    courseId: string,
    courseVersionId: string,
    attemptId?: string,
    isSkipped?: boolean,
  ): Promise<void> {
    if (isSkipped) return;

    const submittedQuiz = await this.submissionRepository.get(
      itemId,
      userId,
      attemptId,
    );

    if (!submittedQuiz) {
      throw new BadRequestError('Quiz not submitted');
    }

    if (submittedQuiz.gradingResult?.gradingStatus == 'FAILED') {
      throw new BadRequestError('Quiz not passed, cannot stop the item');
    }
  }

  private async validateProjectStop(
    itemId: string,
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ): Promise<void> {
    const projectSubmission = await this.projectSubmissionRepo.getByUser(
      userId,
      courseVersionId,
      courseId,
      cohortId,
    );

    if (
      !projectSubmission ||
      projectSubmission.projectId.toString() !== itemId
    ) {
      throw new BadRequestError('Project not submitted');
    }
  }

  async updateProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
    watchItemId?: string,
    attemptId?: string,
    isSkipped?: boolean,
    cohort?: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      /* ----------------------------------
       * 1. Parallel initial validations
       * ---------------------------------- */
      const [, , item] = await Promise.all([
        this.verifyDetails(userId, courseId, courseVersionId),
        this.verifyProgress(
          userId,
          courseId,
          courseVersionId,
          moduleId,
          sectionId,
          itemId,
        ),
        this.itemRepo.readItem(courseVersionId, itemId, session),
      ]);

      if (!item) {
        throw new NotFoundError('Item not found in Course Version');
      }

      /* ----------------------------------
       * 2. Item-type specific validation
       * ---------------------------------- */
      if (item.type === 'VIDEO' || item.type === 'BLOG') {
        const watchTime = await this.progressRepository.getWatchTimeById(
          watchItemId,
          session,
        );
        if (!watchTime) {
          throw new NotFoundError('Watch time not found');
        }
        if (!this.isValidWatchTime(watchTime, item)) {
          throw new BadRequestError(
            'Watch time is not valid, the user did not watch the item long enough',
          );
        }
      } else if (item.type === 'QUIZ' && !isSkipped) {
        const submittedQuiz = await this.submissionRepository.get(
          itemId,
          userId,
          attemptId,
          cohort,
          session,
        );
        if (!submittedQuiz) {
          throw new BadRequestError(
            'Quiz not submitted or attemptId is invalid',
          );
        }
        // Quiz validation will be done after courseVersion is fetched
      } else if (item.type === 'PROJECT') {
        const projectSubmission = await this.projectSubmissionRepo.getByUser(
          userId,
          courseVersionId,
          courseId,
          cohort,
          session,
        );
        if (
          !projectSubmission ||
          projectSubmission.projectId.toString() !== itemId
        ) {
          throw new BadRequestError('Project not submitted yet');
        }
      }

      /* ----------------------------------
       * 3. Course version + progress
       * ---------------------------------- */
      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!courseVersion) {
        throw new NotFoundError('Course version not found');
      }

      const newProgress = await this.getNewProgress(
        courseVersion,
        moduleId,
        sectionId,
        itemId,
        userId,
      );
      if (!newProgress) return;

      /* ----------------------------------
       * 4. Skipped blank quizzes (already optimal)
       * ---------------------------------- */
      if (newProgress.skippedBlankQuizIds?.length) {
        await Promise.all(
          newProgress.skippedBlankQuizIds.map(async blankQuizId => {
            await this.progressRepository.startItemTracking(
              userId,
              courseId,
              courseVersionId,
              blankQuizId,
              null,
              session,
            );

            const watchTimeRecords = await this.progressRepository.getWatchTime(
              userId,
              blankQuizId,
              courseId,
              courseVersionId,
              undefined,
              session,
            );

            if (watchTimeRecords?.length) {
              await this.progressRepository.stopItemTracking(
                watchTimeRecords[0]._id.toString(),
                cohort,
                session,
              );
            }
          }),
        );
      }

      /* ----------------------------------
       * 5. Parallel final updates
       * ---------------------------------- */
      const [, updatedProgress] = await Promise.all([
        this.updateEnrollmentProgressPercent(
          userId,
          courseId,
          courseVersionId,
          session,
        ),
        this.progressRepository.updateProgress(
          userId,
          courseId,
          courseVersionId,
          newProgress,
          cohort,
          session,
        ),
      ]);

      if (!updatedProgress) {
        throw new InternalServerError('Progress could not be updated');
      }
    });
  }

  // helper to reset quiz related data
  private async resetUserQuizData(
    userId: string,
    quizItemIds: string[],
    session: ClientSession,
    cohortId?: string,
  ): Promise<void> {
    if (!quizItemIds.length) return;

    // Fetch all quizzes in one go
    const quizzes = await this.quizRepo.getByIds(quizItemIds, session);

    const maxAttemptsMap = quizzes.reduce(
      (acc, quiz) => {
        acc[quiz._id.toString()] = quiz?.details?.maxAttempts || 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Collect attemptIds to delete and bulk ops for all collections
    const { attemptDeletes, metricsUpdates, submissionDeletes } =
      await this.progressRepository.prepareBulkQuizOperations(
        userId,
        quizItemIds,
        maxAttemptsMap,
        cohortId,
        session,
      );

    // Run the three bulk operations in parallel
    await Promise.all([
      this.progressRepository.executeBulkAttemptDelete(attemptDeletes, session),
      this.userQuizMetricsRepository.executeBulkMetricsReset(
        metricsUpdates,
        session,
      ),
      this.submissionRepository.executeBulkSubmissionDelete(
        userId,
        submissionDeletes,
        session,
      ),
    ]);
  }

  // helper to reset project submission data
  private async resetUserProjectData(
    userId: string,
    projectItemIds: string[],
    courseVersionId: string,
    session: ClientSession,
    cohortId?: string
  ): Promise<void> {
    if (!projectItemIds.length) return;

    // Delete all project submissions for the user in this course version
    await this.projectSubmissionRepo.deleteByUserAndVersion(
      userId,
      courseVersionId,
      cohortId,
      session,
    );
  }

  async handleQuizeProgressAfterSubmission(
    userId: string | ObjectId,
    quizId: string,
    courseId: string,
    courseVersionId: string,
    isPassed: boolean,
    cohortId?: string,
  ) {
    // Fetch progress and course version in parallel
    const [progress, courseVersion] = await Promise.all([
      this.progressRepository.findProgress(userId, courseId, courseVersionId, cohortId),
      this.courseRepo.readVersion(courseVersionId),
    ]);

    if (!progress || !courseVersion) {
      throw new NotFoundError('Progress or Course Version not found');
    }

    // const courseVersion = await this.courseRepo.readVersion(courseVersionId);

    if (isPassed) {
      const nextItemDetails = await this.getNextItemInSequence(
        courseVersion,
        progress.currentModule.toString(),
        progress.currentSection.toString(),
        quizId,
      );

      if (!nextItemDetails) {
        // Course completed → reset to first item
        const initialProgress = await this.initializeProgress(
          userId.toString(),
          courseId,
          courseVersionId,
          courseVersion,
        );

        const newProgress = {
          completed: true,
          completedAt: new Date(),
          currentModule: initialProgress.currentModule,
          currentSection: initialProgress.currentSection,
          currentItem: initialProgress.currentItem,
          skippedBlankQuizIds: [],
        };

        await this.progressRepository.updateProgress(
          userId.toString(),
          courseId,
          courseVersionId,
          newProgress,
          cohortId,
        );
      } else {
        const newProgress = {
          currentModule: nextItemDetails.moduleId,
          currentSection: nextItemDetails.sectionId,
          currentItem: nextItemDetails.itemId,
        };

        await this.progressRepository.updateProgress(
          userId,
          courseId,
          courseVersionId,
          newProgress,
          cohortId,
        );
      }
    } else {
      const previousDetails = await this.getPreviousItemInSequence(
        courseVersion,
        progress.currentModule.toString(),
        progress.currentSection.toString(),
        quizId,
      );

      if (previousDetails) {
        const previousProgress = {
          currentModule: previousDetails.moduleId,
          currentSection: previousDetails.sectionId,
          currentItem: previousDetails.itemId,
        };

        await this.progressRepository.updateProgress(
          userId,
          courseId,
          courseVersionId,
          previousProgress,
          cohortId,
        );
      }
    }
    // if we refresh the quiz page after passing then the student will land on next item
    //  and as the stop item is not called for that quiz endtime will never be created
    // Only mark quiz as completed (set endTime) if it was actually passed
    if (isPassed) {
      const watchTime = await this.progressRepository.getWatchTime(
        userId,
        quizId,
        courseId,
        courseVersionId,
        cohortId,
      );
      const isItemCompleted = await this.progressRepository.isItemCompleted(
        userId.toString(),
        courseId,
        courseVersionId,
        quizId,
        cohortId,
      )

      if (!isItemCompleted && watchTime && watchTime.length > 0) {
        await this.progressRepository.stopItemTracking(
          watchTime[0]._id.toString(),
        );
      }
    }
  }

  // Admin Level Endpoint
  async resetCourseProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      let effectiveCohortId = cohortId;
      if (!effectiveCohortId) {
        const resolvedCohort = await this.resolveSingleEnrollmentCohort(
          userId,
          courseId,
          courseVersionId,
          session,
        );

        if (resolvedCohort !== undefined) {
          effectiveCohortId = resolvedCohort ?? undefined;
        }
      }

      // Run verify + courseVersion fetch in parallel
      const [_, courseVersion] = await Promise.all([
        this.verifyDetails(userId, courseId, courseVersionId),
        this.courseRepo.readVersion(courseVersionId),
      ]);

      // Initialize progress (depends on courseVersion)
      const updatedProgress: IProgress = await this.initializeProgress(
        userId,
        courseId,
        courseVersionId,
        courseVersion,
        effectiveCohortId,
      );
      // console.log("Initialized progress for resetCourseProgress:", updatedProgress);
      // Collect itemsGroupIds from courseModules
      const itemsGroupIds: string[] = [];
      for (const module of courseVersion.modules || []) {
        for (const section of module.sections || []) {
          if (section.itemsGroupId) {
            itemsGroupIds.push(section.itemsGroupId as string);
          }
        }
      }

      // Fetch itemGroups in parallel
      const itemsGroups = await Promise.all(
        itemsGroupIds.map(id => this.itemRepo.readItemsGroup(id, session)),
      );

      // Collect quizItemIds and projectItemIds
      const quizItemIds: string[] = [];
      const projectItemIds: string[] = [];

      for (const group of itemsGroups) {
        for (const item of group.items || []) {
          if (item.type === 'QUIZ') {
            quizItemIds.push(item._id.toString());
          } else if (item.type === 'PROJECT') {
            projectItemIds.push(item._id.toString());
          }
        }
      }

      // Run watchTime deletion, enrollment progress update, and data reset in parallel
      await Promise.all([
        this.progressRepository.deleteUserWatchTimeByCourseVersion(
          userId,
          courseId,
          courseVersionId,
          effectiveCohortId,
          session,
        ),
        this.updateEnrollmentProgressPercent(
          userId,
          courseId,
          courseVersionId,
          session,
          true,
          undefined,
          0,
          effectiveCohortId
        ),
        quizItemIds.length
          ? this.resetUserQuizData(userId, quizItemIds, session, effectiveCohortId)
          : Promise.resolve(),
        projectItemIds.length
          ? this.resetUserProjectData(
              userId,
              projectItemIds,
              courseVersionId,
              session,
              effectiveCohortId,
            )
          : Promise.resolve(),
      ]);

      // Finally, replace progress (sequential, depends on updatedProgress)
      const result = await this.progressRepository.findAndReplaceProgress(
        userId,
        courseId,
        courseVersionId,
        {
          currentModule: updatedProgress.currentModule,
          currentSection: updatedProgress.currentSection,
          currentItem: updatedProgress.currentItem,
          completed: false,
        },
        effectiveCohortId,
        session,
      );

      if (!result) {
        throw new InternalServerError('Progress could not be reset');
      }
    });
  }

  async unenrollUser(
    userId: string,
    courseId: string,
    courseVersionId: string,
    enrollmentId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const [_, courseVersion] = await Promise.all([
        this.verifyDetails(userId, courseId, courseVersionId),
        this.courseRepo.readVersion(courseVersionId),
      ]);

      // Collect quizItemIds and projectItemIds
      // const quizItemIds: string[] = [];
      const projectItemIds: string[] = [];

      // Collect itemsGroupIds from courseModules
      const itemsGroupIds: string[] = [];
      for (const module of courseVersion.modules || []) {
        for (const section of module.sections || []) {
          if (section.itemsGroupId) {
            itemsGroupIds.push(section.itemsGroupId as string);
          }
        }
      }

      // Fetch itemGroups in parallel
      // const itemsGroups = await Promise.all(
      //   itemsGroupIds.map(id => this.itemRepo.readItemsGroup(id, session)),
      // );
      let itemsGroups: ItemsGroup[] = [];
      for (const id of itemsGroupIds) {
        try {
          const group = await this.itemRepo.readItemsGroup(id, session);
          itemsGroups.push(group);
        } catch (err) {
          if (err instanceof NotFoundError) {
            console.warn(
              `[unenrollUser] Missing ItemsGroup ${id}. Skipping cleanup for this group.`,
            );
            continue;
          }
          throw err; // unknown error → fail transaction
        }
      }

      for (const group of itemsGroups) {
        for (const item of group.items || []) {
          // if (item.type === 'QUIZ') {
          //   quizItemIds.push(item._id.toString());
          // } else
          if (item.type === 'PROJECT') {
            projectItemIds.push(item._id.toString());
          }
        }
      }

      // Run watchTime deletion, enrollment progress update, and data reset in parallel
      await Promise.all([
        this.progressRepository.deleteProgress(
          userId,
          courseId,
          courseVersionId,
          cohortId,
          session,
        ),
        this.progressRepository.deleteUserWatchTimeByCourseVersion(
          userId,
          courseId,
          courseVersionId,
          cohortId,
          session,
        ),
        this.enrollmentRepo.deleteEnrollment(
          userId,
          courseId,
          courseVersionId,
          enrollmentId,
          cohortId,
          session,
        ),
        // quizItemIds.length
        //   ? this.resetUserQuizData(userId, quizItemIds, session)
        //   : Promise.resolve(),
        projectItemIds.length
          ? this.resetUserProjectData(
            userId,
            projectItemIds,
            courseVersionId,
            session,
            cohortId
          )
          : Promise.resolve(),
      ]);
    });
  }

  async getCompletedItems(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<String[]> {
    // Verify if the user, course, and course version exist
    await this.verifyDetails(userId, courseId, courseVersionId);

    const progress = await this.progressRepository.getCompletedItems(
      userId,
      courseId,
      courseVersionId,
    );

    if (!progress) {
      throw new NotFoundError('Progress not found');
    }

    // Return the completed items
    return progress;
  }

  async getTotalWatchtimeOfUser(userId: string) {
    const watchItems = await this.progressRepository.getAllWatchTime(userId);
    let totalWatchTime = 0;
    watchItems.forEach(watchItem => {
      if (watchItem.startTime && watchItem.endTime) {
        const startTime = new Date(watchItem.startTime);
        const endTime = new Date(watchItem.endTime);
        totalWatchTime += (endTime.getTime() - startTime.getTime()) / 1000; // Convert to seconds
      }
    });
    return totalWatchTime;
  }

  async resetCourseProgressToModule(
    userId: string,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    cohort?: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      await this.verifyDetails(userId, courseId, courseVersionId);

      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );

      const module = this.findModule(courseVersion, moduleId);

      const newProgress = await this.initializeProgressToModule(
        userId,
        courseId,
        courseVersionId,
        courseVersion,
        moduleId,
        cohort,
      );

      const itemsGroupIds = module.sections.map(s => s.itemsGroupId as string);

      const { itemIds, quizItemIds } = await this.collectItemsFromGroups(
        itemsGroupIds,
        session,
      );

      const completedItemCount =
        await this.getUserProgressPercentageWithoutTotal(
          userId,
          courseId,
          courseVersionId,
          cohort,
          session,
        );

      const deletedCount = await this.clearWatchTime(userId, itemIds, session);

      await this.updateEnrollmentProgressPercent(
        userId,
        courseId,
        courseVersionId,
        session,
        false,
        undefined,
        completedItemCount - deletedCount,
        cohort
      );

      if (quizItemIds.length) {
        await this.resetUserQuizData(userId, quizItemIds, session, cohort);
      }

      await this.progressRepository.findAndReplaceProgress(
        userId,
        courseId,
        courseVersionId,
        {
          currentModule: newProgress.currentModule,
          currentSection: newProgress.currentSection,
          currentItem: newProgress.currentItem,
          completed: false,
        },
        cohort,
        session,
      );
    });
  }

  async resetCourseProgressToSection(
    userId: string,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    sectionId: string,
    cohort?: string,
  ) {
    return this._withTransaction(async session => {
      await this.verifyDetails(userId, courseId, courseVersionId);

      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );

      const module = this.findModule(courseVersion, moduleId);
      const section = this.findSection(module, sectionId);

      const newProgress = await this.initializeProgressToSection(
        userId,
        courseId,
        courseVersionId,
        courseVersion,
        moduleId,
        sectionId,
        cohort
      );

      const { itemIds, quizItemIds } = await this.collectItemsFromGroups(
        [section.itemsGroupId as string],
        session,
      );

      const completedItemCount =
        await this.getUserProgressPercentageWithoutTotal(
          userId,
          courseId,
          courseVersionId,
          cohort,
          session,
        );

      const deletedCount = await this.clearWatchTime(userId, itemIds, session);

      await this.updateEnrollmentProgressPercent(
        userId,
        courseId,
        courseVersionId,
        session,
        false,
        undefined,
        completedItemCount - deletedCount,
        cohort
      );

      if (quizItemIds.length) {
        await this.resetUserQuizData(userId, quizItemIds, session, cohort);
      }

      await this.progressRepository.findAndReplaceProgress(
        userId,
        courseId,
        courseVersionId,
        {
          currentModule: newProgress.currentModule,
          currentSection: newProgress.currentSection,
          currentItem: newProgress.currentItem,
          completed: false,
        },
        cohort,
        session,
      );
    });
  }

  async resetCourseProgressToItem(
    userId: string,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
    cohort?: string,
  ) {
    return this._withTransaction(async session => {
      await this.verifyDetails(userId, courseId, courseVersionId);

      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );

      const module = this.findModule(courseVersion, moduleId);
      const section = this.findSection(module, sectionId);

      const itemsGroup = await this.itemRepo.readItemsGroup(
        section.itemsGroupId as string,
        session,
      );

      const quizItemIds =
        itemsGroup.items
          ?.filter(i => i.type === 'QUIZ' && i._id.toString() === itemId)
          .map(i => i._id.toString()) ?? [];

      if (quizItemIds.length) {
        await this.resetUserQuizData(userId, quizItemIds, session);
      }

      const newProgress = await this.initializeProgressToItem(
        userId,
        courseId,
        courseVersionId,
        courseVersion,
        moduleId,
        sectionId,
        itemId,
        cohort
      );

      const completedItemCount =
        await this.getUserProgressPercentageWithoutTotal(
          userId,
          courseId,
          courseVersionId,
          cohort,
          session,
        );

      const deletedCount = await this.clearWatchTime(userId, [itemId], session);

      await this.updateEnrollmentProgressPercent(
        userId,
        courseId,
        courseVersionId,
        session,
        false,
        undefined,
        completedItemCount - deletedCount,
        cohort
      );

      await this.progressRepository.findAndReplaceProgress(
        userId,
        courseId,
        courseVersionId,
        {
          currentModule: newProgress.currentModule,
          currentSection: newProgress.currentSection,
          currentItem: newProgress.currentItem,
          completed: false,
        },
        cohort,
        session,
      );
    });
  }

  async getWatchTime(
    userId: string,
    itemId: string,
    courseId?: string,
    courseVersionId?: string,
    cohortId?: string,
  ): Promise<WatchTime[]> {
    if (courseId && courseVersionId)
      await this.verifyDetails(userId, courseId, courseVersionId);
    const watchTime = await this.progressRepository.getWatchTime(
      userId,
      itemId,
      courseId,
      courseVersionId,
      cohortId,
    );

    if (!watchTime) {
      throw new NotFoundError('Watch time not found');
    }
    return watchTime;
  }

  // In ProgressService.ts
  async skipItem(
    userId: string,
    courseId: string,
    courseVersionId: string,
    itemId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<{ message: String; alreadyCompleted: Boolean }> {
    const item = await this.itemRepo.readItem(courseVersionId, itemId);
    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }

    // if (item.isOptional !== true) {
    //   throw new BadRequestError('Item is not marked as optional');
    // }

    // Get or create progress

    let progress = await this.progressRepository.findProgress(
      userId,
      courseId,
      courseVersionId,
      cohortId,
      session,
    );

    // If no progress exists, create a new one starting at this item
    if (!progress) {
      throw new Error('Progress not found');
    }

    // Get the course version first
    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new NotFoundError('Course version not found');
    }

    // // First, check if a watch time record already exists for this item
    // const existingWatchTime = await this.progressRepository.getWatchTime(
    //   userId,
    //   itemId,
    //   courseId,
    //   courseVersionId,
    //   session,
    // );

    // let watchTimeId;
    // if (!existingWatchTime || existingWatchTime.length === 0) {
    //   // No existing watch time, create a new one
    //   watchTimeId = await this.progressRepository.startItemTracking(
    //     userId,
    //     courseId,
    //     courseVersionId,
    //     itemId,
    //     session,
    //   );

    //   if (watchTimeId) {
    //     // Mark the item as completed by stopping the watch time
    //     await this.progressRepository.stopItemTracking(watchTimeId, session);
    //   }
    // } else {
    //   // Use the existing watch time ID
    //   if (existingWatchTime && existingWatchTime.length > 0) {
    //     watchTimeId = existingWatchTime[0]._id;
    //     // Ensure the watch time is marked as completed
    //     await this.progressRepository.stopItemTracking(watchTimeId, session);
    //   }
    // }

    const alreadyCompleted = await this.progressRepository.isItemCompleted(
      userId,
      courseId,
      courseVersionId,
      itemId,
      cohortId,
      session,
    );

    if (!alreadyCompleted) {
      // ── ###. Item not yet completed → create + immediately close a watchTime ──
      const existingWatchTime = await this.progressRepository.getWatchTime(
        userId,
        itemId,
        courseId,
        courseVersionId,
        cohortId,
        session,
      );

      if (!existingWatchTime || existingWatchTime.length === 0) {
        // No open record at all → start one and stop it right away
        const watchTimeId = await this.progressRepository.startItemTracking(
          userId,
          courseId,
          courseVersionId,
          itemId,
          cohortId,
          session,
        );

        if (!watchTimeId) {
          throw new InternalServerError(
            `Failed to create watch-time record for item ${itemId}`,
          );
        }

        await this.progressRepository.stopItemTracking(watchTimeId, cohortId, session);
      } else {
        // An open (no endTime) record exists - close it to mark completion
        const openRecord = existingWatchTime.find(wt => !wt.endTime);
        if (openRecord) {
          await this.progressRepository.stopItemTracking(
            openRecord._id.toString(),
            cohortId,
            session,
          );
        }
      }
    }
    // ── ### Already completed  fall through without touching watchTime

    // Get the next item
    const nextItem = await this.getNextItemInSequence(
      courseVersion,
      progress?.currentModule?.toString(),
      progress?.currentSection?.toString(),
      itemId,
    );

    if (!nextItem) {
      // If no next item, mark the course as completed
      // await this.progressRepository.updateProgress(
      //   userId,
      //   courseId,
      //   courseVersionId,
      //   {
      //     completed: true,
      //     currentItem: null,
      //   },
      //   session,
      // );
      // return {message: 'Course completed - no next item found'};
      const initialProgress = await this.initializeProgress(
        userId,
        courseId,
        courseVersionId,
        courseVersion,
        cohortId
      );

      await this.progressRepository.updateProgress(
        userId,
        courseId,
        courseVersionId,
        {
          completed: true,
          currentModule: initialProgress.currentModule,
          currentSection: initialProgress.currentSection,
          currentItem: initialProgress.currentItem,
        },
        cohortId,
        session,
      );

      return { message: 'Course completed - reset to start', alreadyCompleted };
    }

    // Update progress to the next item
    await this.progressRepository.updateProgress(
      userId,
      courseId,
      courseVersionId,
      {
        currentItem: nextItem.itemId,
        currentModule: nextItem.moduleId,
        currentSection: nextItem.sectionId,
      },
      cohortId,
      session,
    );

    return {
      message: alreadyCompleted
        ? 'Item was already completed – progress advanced'
        : 'Item skipped successfully',
      alreadyCompleted,
    };
  }
  async getFirstItem(versionId: string) {
    if (!versionId) {
      throw new BadRequestError('Version ID is required');
    }
    return this.itemRepo.getFirstOrderItems(versionId);
  }
  async getLeaderboard(
    userId: string,
    courseId: string,
    courseVersionId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Array<{
      userId: string;
      userName: string;
      completionPercentage: number;
      completedAt: Date | null;
      rank: number;
    }>;
    totalDocuments: number;
    totalPages: number;
    currentPage: number;
    myStats: {
      userId: string;
      userName: string;
      completionPercentage: number;
      completedAt: Date | null;
      rank: number;
    } | null;
  }> {
    // Get all progress records for this course version
    const progressRecords =
      await this.progressRepository.getAllProgressForCourseVersion(
        courseId,
        courseVersionId,
      );

    // Get all enrollments to fetch completion percentages
    const enrollments = await this.enrollmentRepo.getEnrollmentsByCourseVersion(
      courseId,
      courseVersionId,
    );

    const enrollmentMap = new Map();
    for (const enrollment of enrollments) {
      enrollmentMap.set(enrollment.userId?.toString(), {
        completionPercentage: enrollment.percentCompleted || 0,
      });
    }

    // Get user names for all enrolled students
    const userIds = enrollments.map(e => e.userId?.toString());
    const users = await this.userRepo.getUsersByIds(userIds);

    const userMap = new Map();
    for (const user of users) {
      if (user) {
        const fullName =
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          'Unknown User';
        userMap.set(user._id?.toString(), fullName);
      }
    }

    // Combine progress and enrollment data
    const leaderboardData = progressRecords.map(progress => ({
      userId: progress.userId?.toString(),
      userName: userMap.get(progress.userId?.toString()) || 'Unknown User',
      completionPercentage:
        enrollmentMap.get(progress.userId?.toString())?.completionPercentage ||
        0,
      completedAt:
        progress.completed && progress.completedAt
          ? progress.completedAt
          : null,
    }));

    // Sort by Progress % (highest first), then by Completion Date (earliest first) for ties
    const sortedLeaderboard = leaderboardData.sort((a, b) => {
      // Primary sort: by completion percentage (descending - highest first)
      if (a.completionPercentage !== b.completionPercentage) {
        return b.completionPercentage - a.completionPercentage;
      }

      // Secondary sort: by completedAt (ascending - earliest first) for same percentage
      if (a.completedAt && b.completedAt) {
        return (
          new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
        );
      }

      // If one has completedAt and other doesn't, prioritize the one with completedAt
      if (a.completedAt) return -1;
      if (b.completedAt) return 1;

      // Both don't have completedAt, maintain current order
      return 0;
    });

    // Assign ranks
    // return sortedLeaderboard.map((student, index) => ({
    //   ...student,
    //   rank: index + 1,
    // }));

    const rankedLeaderboard = sortedLeaderboard.map((student, index) => ({
      ...student,
      rank: index + 1,
    }));

    const myStats =
      rankedLeaderboard.find(entry => entry.userId === userId) || null;

    const totalDocuments = rankedLeaderboard.length;
    const totalPages = Math.ceil(totalDocuments / limit);

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedData = rankedLeaderboard.slice(startIndex, endIndex);
    return {
      data: paginatedData,
      totalDocuments,
      totalPages,
      currentPage: page,
      myStats,
    };
  }


  async getItemIdsUntilItem(
    courseVersionId: string,
    itemId: string,
  ): Promise<string[]> {
    if (!courseVersionId) {
      throw new BadRequestError('courseVersionId is required');
    }

    if (!itemId) {
      throw new BadRequestError('itemId is required');
    }

    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new NotFoundError(`Course version ${courseVersionId} not found`);
    }


    const collectedItemIds: string[] = [];
    let isItemFound = false;

    for (const module of courseVersion.modules) {
      for (const section of module.sections) {
        const itemGroupId = section.itemsGroupId;
        if (!itemGroupId) continue;

        const itemGroup = await this.itemRepo.readItemsGroup(
          itemGroupId.toString(),
        );
        if (!itemGroup || !itemGroup.items) continue;

        for (const item of itemGroup.items) {
          if (!item._id) continue;

          const currentItemId = item._id.toString();
          collectedItemIds.push(currentItemId);

          if (currentItemId === itemId) {
            isItemFound = true;
            break;
          }
        }

        if (isItemFound) break;
      }

      if (isItemFound) break;
    }

    if (!isItemFound) {
      throw new NotFoundError(`Item ${itemId} not found in course version`);
    }

    return collectedItemIds;
  }

  async getAllItemIds(courseVersionId: string): Promise<string[]> {
    if (!courseVersionId) {
      throw new BadRequestError('courseVersionId is required');
    }

    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new NotFoundError(`Course version ${courseVersionId} not found`);
    }

    const allItemIds: string[] = [];

    for (const module of courseVersion.modules) {
      for (const section of module.sections) {
        const itemGroupId = section.itemsGroupId;
        if (!itemGroupId) continue;

        const itemGroup = await this.itemRepo.readItemsGroup(
          itemGroupId.toString(),
        );
        if (!itemGroup || !itemGroup.items) continue;

        for (const item of itemGroup.items) {
          if (item._id) {
            allItemIds.push(item._id.toString());
          }
        }
      }
    }

    return allItemIds;
  }
  async getModuleWiseProgress(
    userId: string,
    courseId: string,
    versionId: string,
    cohortId?: string
  ): Promise<
    Array<{
      moduleId: string;
      moduleName: string;
      totalItems: number;
      completedItems: number;
    }>
  > {
    // 1. Fetch course version + completed items in parallel
    const [courseVersion, completedItemIds] = await Promise.all([
      this.courseRepo.readVersion(versionId),
      this.progressRepository.getCompletedItems(userId, courseId, versionId, cohortId),
    ]);

    if (!courseVersion) {
      throw new NotFoundError('Course version not found');
    }


    const completedSet = new Set(completedItemIds.map(id => id.toString()));

    const moduleStats: Array<{
      moduleId: string;
      moduleName: string;
      totalItems: number;
      completedItems: number;
    }> = [];

    for (const module of courseVersion.modules || []) {
      let moduleItemIds: string[] = [];

      for (const section of module.sections || []) {
        if (!section.itemsGroupId) continue;

        const group = await this.itemRepo.readItemsGroup(
          section.itemsGroupId.toString(),
        );

        if (!group?.items) continue;

        for (const item of group.items) {
          moduleItemIds.push(item._id.toString());
        }
      }

      const totalItems = moduleItemIds.length;

      const completedItems = moduleItemIds.filter(id =>
        completedSet.has(id),
      ).length;

      moduleStats.push({
        moduleId: module.moduleId.toString(),
        moduleName: module.name,
        totalItems,
        completedItems,
      });
    }

    return moduleStats;
  }

  async recalculateStudentProgress(
    userId: string,
    courseId: string,
    versionId: string,
    cohortId?: string
  ): Promise<string> {
    if (!userId || !courseId || !versionId) {
      throw new BadRequestError('userId, courseId and versionId are required');
    }

    // 1. Fetch progress
    const progress = await this.progressRepository.findProgress(
      userId,
      courseId,
      versionId,
      cohortId
    );

    if (!progress) {
      throw new NotFoundError('Progress not found for this user');
    }

    const currentItemId = progress.currentItem?.toString();
    if (!currentItemId) {
      throw new BadRequestError('Current item not found in progress');
    }

    // 2. Fetch required data's in parallel
    const [completedItemIds, courseVersion, enrollment] = await Promise.all([
      this.progressRepository.getCompletedItems(userId, courseId, versionId, cohortId),
      this.courseRepo.readVersion(versionId),
      this.enrollmentRepo.findEnrollment(userId, courseId, versionId, cohortId),
    ]);

    if (!courseVersion) {
      throw new NotFoundError('Course version not found');
    }

    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    let allRelevantItemIds: string[] = [];

    // If course is completed, we should check against ALL items, because currentItem reset to the start
    if (progress.completed) {
      allRelevantItemIds = await this.getAllItemIds(versionId);
    } else {
      if (currentItemId) {
        allRelevantItemIds = await this.getItemIdsUntilItem(
          versionId,
          currentItemId,
        );
      }
    }

    if (!allRelevantItemIds.length) {
      throw new NotFoundError('No items found for this course version');
    }

    const completedItemSet = new Set(completedItemIds);
    const missedItemIds = allRelevantItemIds.filter(
      itemId => !completedItemSet.has(itemId),
    );

    // 3. Backfill missed watch-time records
    if (missedItemIds.length > 0) {
      await this.progressRepository.addBulkWatchTime(
        userId,
        courseId,
        versionId,
        missedItemIds,
        cohortId
      );
    }

    // 4. Avoid recomputing totalItems if already stored
    const totalItemsCount =
      courseVersion.totalItems ??
      (await this.itemRepo.CalculateTotalItemsCount(courseId, versionId));

    const totalCompletedItemsCount =
      completedItemSet.size + missedItemIds.length;

    const normalizedTotalItemsCount = Math.max(
      totalItemsCount,
      totalCompletedItemsCount,
    );

    const percentCompleted =
      normalizedTotalItemsCount > 0
        ? Math.min(
          parseFloat(
            (
              (totalCompletedItemsCount / normalizedTotalItemsCount) *
              100
            ).toFixed(2),
          ),
          100,
        )
        : 0;

    // 5. Update enrollment progress
    await this.enrollmentRepo.updateProgressPercentById(
      enrollment._id!.toString(),
      percentCompleted,
      totalCompletedItemsCount,
      enrollment.cohort,
    );

    return 'Progress recalculated successfully';
  }

  async createBulkWatchiTimeDocs(
    courseId: string,
    versionId: string,
    userId?: string | null,
  ) {
    if (!courseId || !versionId) {
      throw new BadRequestError('courseId and versionId are required');
    }

    // const enrollments = await this.enrollmentRepo.getByCourseVersion(
    //   courseId,
    //   versionId,
    // );

    const enrollments = await this.enrollmentRepo.getEnrollmentsByFilters({
      courseId,
      courseVersionId: versionId,
      userId: userId ?? undefined,
    });

    if (!enrollments.length) {
      throw new NotFoundError('No enrollments found for this course version');
    }

    const enrolledUsersId = enrollments.map(e => e.userId.toString());

    const courseVersion = await this.courseRepo.readVersion(versionId);
    if (!courseVersion) {
      throw new NotFoundError('Course version not found');
    }

    const lastModule = courseVersion.modules.at(-1);
    if (!lastModule) {
      throw new BadRequestError('Course version has no modules');
    }

    const lastSection = lastModule.sections.at(-1);
    if (!lastSection) {
      throw new BadRequestError('Last module has no sections');
    }

    const lastItemGroupId = lastSection.itemsGroupId;
    if (!lastItemGroupId) {
      throw new BadRequestError('Last section has no item group');
    }

    const lastItemGroup = await this.itemRepo.readItemsGroup(
      lastItemGroupId.toString(),
    );

    if (!lastItemGroup || !lastItemGroup.items.length) {
      throw new NotFoundError('Last item group not found or empty');
    }

    const lastItem = lastItemGroup.items.at(-1);

    if (
      !lastItem ||
      (lastItem.type !== 'QUIZ' && lastItem.type !== 'FEEDBACK')
    ) {
      throw new BadRequestError(
        'Last item is not a quiz or feedback cannot determine completion',
      );
    }

    const quizId = lastItem._id!.toString();

    const allItemIds = await this.getAllItemIds(versionId);

    if (!allItemIds.length) {
      throw new NotFoundError('No items found for this course version');
    }

    for (const userId of enrolledUsersId) {
      let isProceed = true;
      if (lastItem.type == 'QUIZ') {
        const quizSubmission =
          await this.submissionRepository.getByQuizAndUserId(quizId, userId);
        const userQuizMetrics = await this.userQuizMetricsRepository.get(
          userId,
          quizId,
        );

        if (!userQuizMetrics || !quizSubmission) isProceed = false;
        // if (!quizSubmission) isProceed = false;
        if (
          quizSubmission?.gradingResult?.gradingStatus !== 'PASSED' &&
          userQuizMetrics?.remainingAttempts > 0 &&
          userQuizMetrics?.remainingAttempts !== -1
        )
          isProceed = false;
      } else if (lastItem.type == 'FEEDBACK') {
        const feedbackSubmission =
          await this.feedbackRepository.getByUserAndVersionId(
            userId,
            versionId,
          );
        if (!feedbackSubmission) isProceed = false;
      }
      if (!isProceed) {
        continue;
      }

      const completedItemIds = await this.progressRepository.getCompletedItems(
        userId,
        courseId,
        versionId,
      );

      const missedItemIds = allItemIds.filter(
        itemId => !completedItemIds.includes(itemId),
      );
      console.log(`UserId: ${userId}`);
      console.log(`Missed Items:`, missedItemIds);
      console.log(`Missed Items Count: ${missedItemIds.length}`);
      console.log(`Completed Items length:`, completedItemIds.length);
      console.log(`Total Items length:`, allItemIds.length);

      if (!missedItemIds.length) continue;

      await this.progressRepository.addBulkWatchTime(
        userId,
        courseId,
        versionId,
        missedItemIds,
      );
    }
  }

  /////////////////////////////// TEMP SERVICE WITHOUT AUTH //////////////////////////////////

  async getLeaderboardNoAuth(
    courseId: string,
    courseVersionId: string,
  ): Promise<GetLeaderboardResponse> {
    const course = await this.courseRepo.read(courseId);
    if (!course) {
      throw new BadRequestError(`Invalid courseId: ${courseId}`);
    }

    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new BadRequestError(`Invalid courseVersionId: ${courseVersionId}`);
    }

    // Get all progress records for this course version
    const progressRecords =
      await this.progressRepository.getAllProgressForCourseVersion(
        courseId,
        courseVersionId,
      );

    if (!progressRecords) {
      throw new BadRequestError(
        `No progress records found for course ${courseId} and version ${courseVersionId}`,
      );
    }

    // Get all enrollments to fetch completion percentages
    const enrollments = await this.enrollmentRepo.getEnrollmentsByCourseVersion(
      courseId,
      courseVersionId,
    );

    if (!enrollments || enrollments.length === 0) {
      throw new BadRequestError(
        `No enrollments found for course ${courseId} and version ${courseVersionId}`,
      );
    }

    const enrollmentMap = new Map();
    for (const enrollment of enrollments) {
      enrollmentMap.set(enrollment.userId.toString(), {
        completionPercentage: enrollment.percentCompleted || 0,
        enrolledAt: enrollment.enrollmentDate,
      });
    }

    // Get user names for all enrolled students
    const userIds = enrollments.map(e => e.userId.toString());
    const users = await this.userRepo.getUsersByIds(userIds);
    if (!users || users.length === 0) {
      throw new BadRequestError(
        'No users found for the given course and version',
      );
    }
    const userMap = new Map();
    for (const user of users) {
      if (user) {
        const fullName =
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          'Unknown User';
        userMap.set(user._id?.toString(), { name: fullName, email: user.email });
      }
    }

    const formatToIST = (date?: Date | string | null): string => {
      if (!date) return '—';

      return new Date(date).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    };

    // Combine progress and enrollment data
    const leaderboardData = progressRecords.map(progress => {
      const userId = progress.userId.toString();
      const enrollment = enrollmentMap.get(userId);
      const user = userMap.get(userId);

      return {
        userId,
        userName: user?.name || 'Unknown User',
        email: user?.email || 'No email',

        completionPercentage: enrollment?.completionPercentage ?? 0,

        completedAt:
          progress.completed && progress.completedAt
            ? formatToIST(progress.completedAt)
            : 'Not completed yet',

        enrolledAt: enrollment?.enrolledAt
          ? formatToIST(enrollment.enrolledAt)
          : 'No enrollment date',
      };
    });

    // Sort by Progress % (highest first), then by Completion Date (earliest first) for ties
    const sortedLeaderboard = leaderboardData.sort((a, b) => {
      // Primary sort: by completion percentage (descending - highest first)
      if (a.completionPercentage !== b.completionPercentage) {
        return b.completionPercentage - a.completionPercentage;
      }

      // Secondary sort: by completedAt (ascending - earliest first) for same percentage
      if (a.completedAt && b.completedAt) {
        return (
          new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
        );
      }

      // If one has completedAt and other doesn't, prioritize the one with completedAt
      if (a.completedAt) return -1;
      if (b.completedAt) return 1;

      // Both don't have completedAt, maintain current order
      return 0;
    });

    const rankedLeaderboard = sortedLeaderboard.map((student, index) => ({
      rank: index + 1,
      ...student,
    }));

    return {
      course: course.name,
      version: courseVersion.version,
      data: rankedLeaderboard,
    };
  }
}

export { ProgressService };
