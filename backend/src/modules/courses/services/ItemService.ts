import { injectable, inject } from 'inversify';
import { ClientSession, ObjectId } from 'mongodb';
import {
  NotFoundError,
  InternalServerError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError
} from 'routing-controllers';
import { COURSES_TYPES } from '#courses/types.js';
import { CourseVersion } from '#courses/classes/transformers/CourseVersion.js';
import {
  ItemsGroup,
  ItemBase,
  ItemRef,
  Item,
} from '#courses/classes/transformers/Item.js';
import { Section } from '#courses/classes/transformers/Section.js';
import {
  CreateItemBody,
  UpdateItemBody,
  MoveItemBody,
  QuizDetailsPayloadValidator,
  CSVRow,
  CSVQuizQuestion,
  VideoOverallAnalytics,
  VideoUserAnalyticsQuery,
  VideoUserAnalytics,
  VideoUserAnalyticsResponse,
} from '#courses/classes/validators/ItemValidators.js';
import { calculateNewOrder } from '#courses/utils/calculateNewOrder.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
import { IItemRepository } from '#root/shared/database/interfaces/IItemRepository.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { Module } from '#courses/classes/transformers/Module.js';
import {
  EnrollmentRepository,
  IBaseItem,
  ICourseVersion,
  IQuizDetails,
  ItemType,
  Priority,
  ProgressRepository,
  QuestionType,
} from '#root/shared/index.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { ProgressService } from '#root/modules/users/services/ProgressService.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';
import {
  AttemptRepository,
  QuizRepository,
  UserQuizMetricsRepository,
} from '#root/modules/quizzes/repositories/index.js';
import { FeedbackRepository } from '#root/modules/quizzes/repositories/providers/mongodb/FeedbackRepository.js';
import { QuestionBankService } from '#root/modules/quizzes/services/QuestionBankService.js';
import { QuizService } from '#root/modules/quizzes/services/QuizService.js';
import { QuestionService } from '#root/modules/quizzes/services/QuestionService.js';
import { QuestionFactory } from '#root/modules/quizzes/classes/index.js';
import { QuestionProcessor } from '#root/modules/quizzes/question-processing/QuestionProcessor.js';
import { CourseSettingService, SETTING_TYPES } from '#root/modules/setting/index.js';

@injectable()
export class ItemService extends BaseService {
  constructor(
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepo: ProgressRepository,
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(QUIZZES_TYPES.UserQuizMetricsRepo)
    private userQuizMetricsRepository: UserQuizMetricsRepository,
    @inject(QUIZZES_TYPES.QuizRepo)
    private quizRepository: QuizRepository,
    @inject(QUIZZES_TYPES.AttemptRepo)
    private attemptRepository: AttemptRepository,
    @inject(QUIZZES_TYPES.FeedbackRepo)
    private feedbackRepo: FeedbackRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,
    @inject(QUIZZES_TYPES.QuizService)
    private readonly quizService: QuizService,
    @inject(QUIZZES_TYPES.QuestionService)
    private readonly questionService: QuestionService,
    @inject(SETTING_TYPES.CourseSettingService)
    private readonly courseSettingService: CourseSettingService,
  ) {
    super(database);
  }

  private async _getVersionModuleSectionAndItemsGroup(
    versionId: string,
    moduleId: string,
    sectionId: string,
    session?: ClientSession,
  ): Promise<{
    version: CourseVersion;
    module: Module;
    section: Section;
    itemsGroup: ItemsGroup;
  }> {
    const version = (await this.courseRepo.readVersion(
      versionId,
      session,
    )) as CourseVersion;
    if (!version) throw new NotFoundError(`Version ${versionId} not found.`);

    const module = version.modules.find(
      m => m.moduleId?.toString() === moduleId,
    );
    if (!module)
      throw new NotFoundError(
        `Module ${moduleId} not found in version ${versionId}.`,
      );

    const section = module.sections.find(
      s => s.sectionId?.toString() === sectionId,
    );
    if (!section)
      throw new NotFoundError(
        `Section ${sectionId} not found in module ${moduleId}.`,
      );
    const itemsGroup = await this.itemRepo.readItemsGroup(
      typeof section?.itemsGroupId === 'string' ? section.itemsGroupId : section.itemsGroupId.toString(),
      session,
    );
    if (!itemsGroup) {
      return {
        version,
        module,
        section,
        itemsGroup: { _id: section.itemsGroupId, items: [] } as ItemsGroup,
      };
    }

    return { version, module, section, itemsGroup };
  }

  private async _updateHierarchyAndVersion(
    version: CourseVersion,
    module: { updatedAt: Date },
    section: { updatedAt: Date },
    session?: ClientSession, // Pass session if version update is part of the transaction
  ): Promise<CourseVersion> {
    const now = new Date();
    section.updatedAt = now;
    module.updatedAt = now;
    version.updatedAt = now;

    return (await this.courseRepo.updateVersion(
      version._id.toString(),
      version,
      session,
    )) as CourseVersion; // Assuming version has _id
  }

  //Lets update this api with queue later
  public async createItem(
    versionId: string,
    moduleId: string,
    sectionId: string,
    body: CreateItemBody,
  ) {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
            
      if(versionStatus==="archived"){
        throw new ForbiddenError("This course version is archived and cannot be modified.");
      }
      // Step 1: Fetch and validate parent entities
      const { version, module, section, itemsGroup } =
        await this._getVersionModuleSectionAndItemsGroup(
          versionId,
          moduleId,
          sectionId,
          session,
        );
      // Check if any previous "learning item" exists before making the feedback form in the db
      if (body.type === ItemType.FEEDBACK) {
        const dbItemsGroup = await this.itemRepo.readItemsGroup(
          typeof section.itemsGroupId === 'string' ? section.itemsGroupId : section.itemsGroupId.toString(),
          session,
        );

        const sectionItems = dbItemsGroup?.items || [];

        if (sectionItems.length === 0) {
          throw new BadRequestError(
            'Feedback form cannot be the first item in a section',
          );
        }

        const lastItemRef = [...sectionItems]
          .sort((a, b) => a.order.localeCompare(b.order))
          .pop();

        const previousItem = await this.itemRepo.readItemById(
          lastItemRef._id.toString(),
          session,
        );

        const allowed = [ItemType.VIDEO, ItemType.QUIZ, ItemType.BLOG];

        if (!allowed.includes(previousItem.type)) {
          throw new BadRequestError(
            'Feedback can only be added after VIDEO, QUIZ, or BLOG items',
          );
        }
      }

      // Step 2: Create a new item instance
      const item = new ItemBase(body, itemsGroup.items);

      const courseId = version.courseId.toString();

      // Step 3: Run multiple async operations in parallel
      const [
        createdItemDetailsPersistenceResult,
        // totalItemsCountIfNeeded,
        enrollments,
      ] = await Promise.all([
        this.itemRepo.createItem(item.itemDetails, session),
        // version.totalItems
        //   ? Promise.resolve(null)
        //   : this.itemRepo.CalculateTotalItemsCount(
        //     courseId,
        //     version._id.toString(),
        //     session,
        //   ),
        this.enrollmentRepo.getByCourseVersion(courseId, versionId, session),
      ]);

      // Step 3a: Validate creation
      if (!createdItemDetailsPersistenceResult) {
        throw new InternalServerError(
          'Persistence of item-specific details failed in the repository.',
        );
      }
      createdItemDetailsPersistenceResult._id =
        createdItemDetailsPersistenceResult._id.toString();

      // Step 4: Update enrollment progress in bulk
      await this.progressService.updateEnrollmentProgressPercentBulk(
        enrollments,
        courseId,
        versionId,
        version.totalItems,
        session,
      );

      // Step 5: Add item to itemsGroup
      const newItemDB = new ItemRef(item);
      // newItemDB._id = newItemDB._id.toString();
      itemsGroup.items.push(newItemDB);
      itemsGroup.sectionId = new ObjectId(itemsGroup.sectionId);

      // Step 5b: Persist updated itemsGroup
      const updatedItemsGroupResult = await this.itemRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
        session,
      );

      // Step 3b: Update totalItems
      const { totalItems, itemCounts } =
        await this.itemRepo.calculateItemCountsForVersion(versionId, session);
      version.totalItems = totalItems;
      version.itemCounts = itemCounts;

      // Step 6: Update hierarchy timestamps
      const updatedVersion = await this._updateHierarchyAndVersion(
        version,
        module,
        section,
        session,
      );

      return {
        itemsGroup: updatedItemsGroupResult,
        version: updatedVersion,
        createdItem: newItemDB,
      };
    });
  }

  public async readAllItems(
    versionId: string,
    moduleId: string,
    sectionId: string,
    userId: string,
  ): Promise<ItemRef[]> {
    const { itemsGroup } = await this._getVersionModuleSectionAndItemsGroup(
      versionId,
      moduleId,
      sectionId,
    );

    const course = await this.courseRepo.readVersion(versionId);
    if (!course) {
      throw new NotFoundError(`Course for version ${versionId} not found.`);
    }

    const user = await this.enrollmentRepo.getUserEnrollmentsByCourseVersion(
      userId,
      course.courseId.toString(),
      versionId,
    );

    // Only filter hidden items for students
    if (user.role === 'STUDENT') {
      itemsGroup.items = itemsGroup.items.filter(item => !item.isHidden);

      const progress = await this.progressRepo.getUserProgressByVersionId(
        userId,
        versionId,
      );

      // If no progress yet, nothing is completed
      if (!progress) {
        itemsGroup.items = itemsGroup.items.map(item => ({
          ...item,
          isCompleted: false,
        }));
        return itemsGroup.items;
      }

      const currentModuleIndex = course.modules.findIndex(
        mod => mod.moduleId.toString() === progress.currentModule?.toString(),
      );

      const moduleIndex = course.modules.findIndex(
        mod => mod.moduleId.toString() === moduleId.toString(),
      );

      // Guard against invalid module indices
      if (currentModuleIndex === -1 || moduleIndex === -1) {
        return itemsGroup.items;
      }

      const completionEntries = await Promise.all(
        itemsGroup.items.map(async (item) => {
          const isCompleted = await this.progressRepo.isItemCompleted(
            userId,
            course.courseId.toString(),
            versionId,
            item._id.toString()
          );

          return [item._id.toString(), isCompleted] as const;
        })
      );
      const completionMap = new Map<string, boolean>(completionEntries);

      itemsGroup.items = itemsGroup.items.map(item => ({
        ...item,
        // isCompleted: true,
        isCompleted: completionMap.get(item._id.toString()) ?? false
      }));
      return itemsGroup.items;

      // // All items completed if module is before current module
      // if (moduleIndex < currentModuleIndex) {
      //   itemsGroup.items = itemsGroup.items.map(item => ({
      //     ...item,
      //     isCompleted: true,
      //   }));
      //   return itemsGroup.items;
      // }

      // const currentSectionIndex = course.modules[
      //   currentModuleIndex
      // ]?.sections.findIndex(
      //   sec => sec.sectionId.toString() === progress.currentSection?.toString(),
      // );

      // const sectionIndex = course.modules[moduleIndex]?.sections.findIndex(
      //   sec => sec.sectionId.toString() === sectionId.toString(),
      // );

      // // Guard against invalid section indices
      // if (currentSectionIndex === -1 || sectionIndex === -1) {
      //   return itemsGroup.items;
      // }

      // // All items completed if section is before current section in same module
      // if (
      //   moduleIndex === currentModuleIndex &&
      //   sectionIndex < currentSectionIndex
      // ) {
      //   itemsGroup.items = itemsGroup.items.map(item => ({
      //     ...item,
      //     isCompleted: true,
      //   }));
      //   return itemsGroup.items;
      // }

      // const currentItemIndex = itemsGroup.items.findIndex(
      //   itm => itm._id.toString() === progress.currentItem?.toString(),
      // );

      // // If current item belongs to another section, nothing here is completed
      // if (currentItemIndex === -1) {
      //   return itemsGroup.items;
      // }

      // itemsGroup.items = itemsGroup.items.map((item, index) => {
      //   if (
      //     moduleIndex === currentModuleIndex &&
      //     sectionIndex === currentSectionIndex &&
      //     index < currentItemIndex
      //   ) {
      //     return {...item, isCompleted: true};
      //   }

      //   if (
      //     moduleIndex === currentModuleIndex &&
      //     sectionIndex === currentSectionIndex &&
      //     index === currentItemIndex
      //   ) {
      //     return {...item, isCompleted: progress.completed};
      //   }

      //   return {...item, isCompleted: false};
      // });
    }

    console.log(
      `[ItemService] About to return ${itemsGroup.items.length} items`,
    );
    console.log(`[ItemService] First item:`, itemsGroup.items[0]);

    return itemsGroup.items;
  }

  private async _isPreviousItemCompleted(
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    itemId: string,
    userId: string,
    courseId: string,
    versionId: string
  ): Promise<boolean> {
    const previousItem = await this.progressService.getPreviousItemInSequence(courseVersion, moduleId, sectionId, itemId);
    // First item ? 
    if (!previousItem) {
      return true;
    }
    const previousItemCompleted = await this.progressRepo.isItemCompleted(userId, courseId, versionId, previousItem.itemId);
    return previousItemCompleted;
  }

  public async readItem(
    userId: string,
    versionId: string,
    itemId: string,
    courseId?: string,
    moduleId?: string,
    sectionId?: string
  ) {

    // Fetch enrollment early
    const enrollment = await this.enrollmentRepo.findEnrollment(
      userId,
      versionId,
      courseId
    );

    if (!enrollment) {
      throw new UnauthorizedError(
        'You are not enrolled in this course version',
      );
    }

    if (enrollment.status === 'INACTIVE') {
      throw new UnauthorizedError(
        'Your enrollment is inactive for this course version',
      );
    }
    const item = await this.itemRepo.readItem(versionId, itemId);

    // Non-students do not require progress checks
    if (enrollment.role !== 'STUDENT') {
      return {
        ...item,
        _id: item._id.toString(),
      };
    }

    // Student-specific checks (parallelized)
    const [
      isItemAlreadyCompleted,
      isItemAlreadyAttempted,
      currentUserProgress,
      linearProgressionEnabled,
      courseVersion
    ] = await Promise.all([
      this.progressRepo.isItemCompleted(userId, courseId, versionId, itemId),
      this.progressRepo.isItemAttempted(userId, courseId, versionId, itemId),
      this.progressRepo.findProgress(userId, courseId, versionId),
      this.courseSettingService.isLinearProgressionEnabled(courseId, versionId),
      this.courseRepo.readVersion(versionId),
    ]);

    // // Enforce linear progression only when required
    // if (
    //   linearProgressionEnabled &&
    //   !isItemAlreadyAttempted &&
    //   currentUserProgress?.currentItem.toString() !== itemId
    // ) {
    //   const previousItemCompleted = await this._isPreviousItemCompleted(courseVersion, moduleId, sectionId, itemId, userId, courseId, versionId);
    //   if(!previousItemCompleted){
    //     throw new ForbiddenError(
    //       "You don't have permission to watch this item",
    //     );
    //   }
    // }

    // If linear progression is NOT enabled, allow normally

    const response = (isAlreadyWatched = isItemAlreadyCompleted) => ({
      ...item,
      _id: item._id.toString(),
      isAlreadyWatched,
    });

    // If linear progression is disabled, allow immediately
    if (!linearProgressionEnabled) return response();

    // If attempted items should bypass restriction, allow immediately
    if (isItemAlreadyAttempted) return response();

    const currentItemId = currentUserProgress?.currentItem?.toString();

    // 1) current item matches => allow
    if (currentItemId === itemId) return response();

    // 2) already completed => allow
    if (isItemAlreadyCompleted) return response(true);

    // 3) previous item completed => allow
    const previousItemCompleted = await this._isPreviousItemCompleted(
      courseVersion,
      moduleId,
      sectionId,
      itemId,
      userId,
      courseId,
      versionId,
    );

    if (previousItemCompleted) return response();

    // All checks failed => forbid
    throw new ForbiddenError("You don't have permission to watch this item");
    // return {
    //   ...item,
    //   _id: item._id.toString(),
    //   isAlreadyWatched: isItemAlreadyCompleted,
    // };
  }

  public async updateItem(
    versionId: string,
    itemId: string,
    body: UpdateItemBody,
  ) {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and cannot be modified.");
        }
      //  Run version and item fetch in parallel
      const [version, item] = await Promise.all([
        this.courseRepo.readVersion(versionId, session),
        this.itemRepo.readItem(versionId, itemId, session),
      ]);

      if (!version) throw new NotFoundError(`Version ${versionId} not found.`);
      if (!item)
        throw new NotFoundError(
          `Item ${itemId} not found in version ${versionId}.`,
        );

      if (item.type !== body.type) {
        throw new InternalServerError(
          `Item type mismatch: expected ${item.type}, got ${body.type}.`,
        );
      }

      //  Update item first
      const result = await this.itemRepo.updateItem(
        itemId,
        { ...body, isOptional: body.isOptional || item.isOptional },
        session,
      );

      //  Run metrics update (if QUIZ) and version update in parallel
      version.updatedAt = new Date();

      const promises: Promise<any>[] = [
        this.courseRepo.updateVersion(versionId, version),
      ];

      if (body.type === 'QUIZ') {
        promises.push(this.bulkUpdateEnrolledUserQuizMetrics(itemId, result));
      }

      const [updatedVersion] = await Promise.all(promises);

      if (!updatedVersion) {
        throw new InternalServerError(
          'Failed to update version after item update',
        );
      }

      result._id = result._id.toString();
      return result;
    });
  }

  async bulkUpdateEnrolledUserQuizMetrics(
    quizId: string,
    quiz: any,
  ): Promise<{ updatedCount: number; totalCount: number }> {
    const BATCH_SIZE = 5000;
    const bulkOperations: any[] = [];
    let batchCount = 0;
    let updatedCount = 0;

    // Step 1: Get all user_quiz_metrics records
    const metrics = await this.userQuizMetricsRepository.getByQuizId(quizId);

    const totalCount = metrics.length; // total records
    console.log(
      `🔹 Found ${totalCount} user_quiz_metrics records for quiz ${quizId}`,
    );
    for (const metric of metrics) {
      try {
        if (metric.userId && metric.quizId) {
          // Step 2: Find latest attempt for this (userId, quizId)

          const attemptCount = await this.attemptRepository.countUserAttempts(
            metric.quizId.toString(),
            metric.userId.toString(),
          );

          if (!quiz && !quiz.details && !attemptCount) continue;

          // Step 3: Add to bulk operations
          bulkOperations.push({
            updateOne: {
              filter: { _id: new ObjectId(metric._id) },
              update: {
                $set: {
                  // latestAttemptId: latestAttempt?._id.toString(),
                  // latestAttemptStatus: 'ATTEMPTED',
                  remainingAttempts: quiz.details.maxAttempts - attemptCount,
                },
              },
            },
          });

          // Increment updated count
          updatedCount++;

          // Step 4: Commit in batches
          if (bulkOperations.length === BATCH_SIZE) {
            await this._withTransaction(async session => {
              await this.userQuizMetricsRepository.executeBulkMetricsReset(
                bulkOperations,
                session,
              );
              console.log(
                `✅ Batch ${++batchCount}: Updated ${bulkOperations.length
                } user_quiz_metrics`,
              );
              bulkOperations.length = 0;
            });
          }
        }
      } catch (err) {
        console.error(`Failed to update metric ${metric._id}`, err);
      }
    }

    // Step 5: Final flush
    if (bulkOperations.length > 0) {
      await this._withTransaction(async session => {
        await this.userQuizMetricsRepository.executeBulkMetricsReset(
          bulkOperations,
          session,
        );
        console.log(
          `✅ Final batch: Updated ${bulkOperations.length} user_quiz_metrics`,
        );
      });
    }

    console.log(`🔹 Done! Updated ${updatedCount} / ${totalCount} records`);
    return { updatedCount, totalCount };
  }

  public async deleteItem(itemsGroupId: string, itemId: string) {
    return this._withTransaction(async session => {
      try {
        // Read Item
        const item = await this.itemRepo.readItemById(itemId, session);
        if (!item) throw new InternalServerError('Item not found');

        const version = await this.findVersion(itemsGroupId);
        
        const versionStatus=await this.courseRepo.getCourseVersionStatus(version._id.toString(),session);
      
        if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and items cannot be deleted.");
        }

        // Check item type
        if (item.type === 'FEEDBACK') {
          await this.feedbackRepo.deleteSubmissionsByFormId(itemId, session);
        }
        // Step 1: Delete item
        const deleted = await this.itemRepo.deleteItem(
          itemsGroupId,
          itemId,
          session,
        );
        if (!deleted) throw new InternalServerError('Item deletion failed');

        // Step 2: Fetch version

        const courseId = version.courseId.toString();
        const versionId = version._id.toString();

        // Step 3: Run in parallel: count total items, delete watch time, get enrollments
        const [_, enrollments] = await Promise.all([
          // this.itemRepo.CalculateTotalItemsCount(courseId, versionId, session),
          this.progressRepo.deleteWatchTimeByItemId(itemId, session),
          this.enrollmentRepo.getByCourseVersion(courseId, versionId, session),
        ]);

        const { totalItems, itemCounts } =
          await this.itemRepo.calculateItemCountsForVersion(versionId, session);
        version.totalItems = totalItems;
        version.itemCounts = itemCounts;

        // Step 4: Update progress for all users in parallel
        await this.progressService.updateEnrollmentProgressPercentBulk(
          enrollments,
          courseId,
          versionId,
          version.totalItems,
          session,
        );

        // Step 5: Update version
        const updatedVersion = await this.courseRepo.updateVersion(
          versionId,
          version,
          session,
        );
        if (!updatedVersion) {
          throw new InternalServerError(
            'Failed to update version after item deletion',
          );
        }

        deleted._id = deleted._id.toString();
        return { deletedItemId: itemId, itemsGroup: deleted };
      } catch (error) {
        throw new InternalServerError(
          `Failed to delete Item after / Error: ${error}`,
        );
      }
    });
  }

  public async moveItem(
    versionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
    body: MoveItemBody,
  ) {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);

      if(versionStatus==="archived"){
        throw new ForbiddenError("This course version is archived and cannot be modified.");
      }
      
      const { afterItemId, beforeItemId } = body;
      if (!afterItemId && !beforeItemId) {
        throw new Error('Either afterItemId or beforeItemId is required');
      }

      const version = await this.courseRepo.readVersion(versionId, session);
      const module = version.modules.find(
        m => m.moduleId?.toString() === moduleId,
      )!;
      const section = module.sections.find(
        s => s.sectionId?.toString() === sectionId,
      )!;
      const itemsGroup = await this.itemRepo.readItemsGroup(
        typeof section.itemsGroupId === 'string' ? section.itemsGroupId : section.itemsGroupId.toString(),
        session,
      );

      const sortedItems = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      );
      const newOrder = calculateNewOrder(
        sortedItems,
        '_id',
        afterItemId,
        beforeItemId,
      );
      const item = itemsGroup.items.find(i => i._id.toString() === itemId)!;
      item.order = newOrder;

      // Sort items by order after updating
      itemsGroup.items.sort((a, b) => a.order.localeCompare(b.order));

      section.updatedAt = new Date();
      module.updatedAt = new Date();
      version.updatedAt = new Date();

      itemsGroup.items = itemsGroup.items.map(item => ({
        ...item,
        _id: new ObjectId(item._id.toString()),
      }));
      itemsGroup.sectionId = new ObjectId(itemsGroup.sectionId);

      const updatedItemsGroup = await this.itemRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
        session,
      );
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      return { itemsGroup: updatedItemsGroup, version: updatedVersion };
    });
  }

  public async findVersion(itemGroupId: string): Promise<ICourseVersion> {
    const version = await this.courseRepo.findVersionByItemGroupId(itemGroupId);
    if (!version) {
      throw new NotFoundError(
        `Version for item group ${itemGroupId} not found`,
      );
    }
    return version;
  }

  /**
   * Get version and course information from an item ID
   * Combines findItemsGroupIdByItemId and findVersionByItemGroupId
   */
  public async getCourseAndVersionByItemId(itemId: string): Promise<{
    versionId: string;
    courseId: string;
  }> {
    return this._withTransaction(async session => {
      // Step 1: Find itemsGroup containing the item
      const itemsGroup = await this.itemRepo.findItemsGroupByItemId(
        itemId,
        session,
      );
      if (!itemsGroup) {
        throw new NotFoundError(`ItemsGroup for item ${itemId} not found`);
      }
      const itemsGroupId = itemsGroup?._id?.toString();
      // Step 2: Find version using existing function
      const version = await this.courseRepo.findVersionByItemGroupId(
        itemsGroupId,
        session,
      );

      if (!version) {
        throw new NotFoundError(`Version for item ${itemId} not found`);
      }

      return {
        courseId: version.courseId.toString(),
        versionId: version._id.toString(),
      };
    });
  }

  public async exportFeedbackSubmissions(courseId: string, itemId: string) {
    return await this._withTransaction(async (session: ClientSession) => {
      console.log('USING LABEL EXPORT');

      const submissions = await this.feedbackRepo.getAllSubmissionsWithLabels(
        itemId,
        courseId,
      );

      return submissions.map(sub => {
        const details = sub.details || {};
        const previousItem = sub.previousItem || {};
        const { Name, Email, ...otherDetails } = details;

        return {
          'Username': Name || 'Anonymous',
          'Email': Email || 'N/A',
          'Item Type': sub.previousItemType || 'FEEDBACK',
          'Item Name': previousItem.name || 'N/A',
          'Submitted At': sub.createdAt ? new Date(sub.createdAt).toLocaleString() : 'N/A',
          ...otherDetails
        };
      });
    });
  }

  public async getFeedbackSubmissions(
    courseId: string,
    itemId: string,
    search: string,
    page: number,
    limit: number,
  ) {
    return await this._withTransaction(async (session: ClientSession) => {
      return await this.feedbackRepo.getFeedbackSubmissionById(
        itemId,
        courseId,
        search,
        page,
        limit,
      );
    });
  }

  public async toggleItemVisibility(
    courseVersionId: string,
    itemId: string,
    hidden: boolean,
  ) {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(courseVersionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and cannot be modified.");
        }
      const itemGroup = await this.itemRepo.findItemsGroupByItemId(
        itemId,
        session,
      );

      if (!itemGroup) {
        throw new NotFoundError(`ItemsGroup for item ${itemId} not found`);
      }

      itemGroup.items.forEach(item => {
        if (item._id.toString() === itemId) {
          item.isHidden = hidden;
        }
      });

      await this.itemRepo.updateItemsGroup(
        itemGroup._id.toString(),
        itemGroup,
        session,
      );

      const item = await this.itemRepo.readItem(
        courseVersionId,
        itemId,
        session,
      );

      if (!item) throw new NotFoundError(`Item ${itemId} not found.`);

      item.isHidden = hidden;

      const updatedItem = await this.itemRepo.updateItemById(
        itemId,
        item,
        item.type,
        session,
      );

      if (!updatedItem) {
        throw new InternalServerError(`Failed to update item ${itemId}`);
      }

      const version = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!version)
        throw new NotFoundError(`Version ${courseVersionId} not found.`);

      const { totalItems, itemCounts } =
        await this.itemRepo.calculateItemCountsForVersion(
          courseVersionId,
          session,
        );

      version.totalItems = totalItems;
      version.itemCounts = itemCounts;
      version.updatedAt = new Date();

      const updatedVersion = await this.courseRepo.updateVersion(
        courseVersionId,
        version,
        session,
      );

      await this.enrollmentRepo.setWatchTimeVisibility(
        [itemId],
        hidden,
        session,
      );

      if (hidden == true) {
        // next non hidden item
        const items = itemGroup.items;
        const currentIndex = items.findIndex(i => i._id.toString() === itemId);
        let nextItem = null;
        for (let i = currentIndex + 1; i < items.length; i++) {
          if (!items[i].isHidden) {
            nextItem = items[i];
            break;
          }
        }

        // fallback backward
        if (!nextItem) {
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (!items[i].isHidden) {
              nextItem = items[i];
              break;
            }
          }
        }

        // update all progress documents matched by currentItemId to nextNonHiddenItemId
        if (nextItem) {
          await this.progressRepo.updateProgressByItemId(
            itemId,
            { currentItem: nextItem._id.toString() },
            session,
          );
        }
      }
    });
  }

  // Add to ItemService.ts

  public async updateItemOptionalStatus(
    versionId: string,
    itemId: string,
    isOptional: boolean,
  ) {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
            
      if(versionStatus==="archived"){
        throw new ForbiddenError("This course version is archived and cannot be updated.");
      }
      const versionIdObject = new ObjectId(versionId);
      // Get the item
      const item = await this.itemRepo.readItem(versionId, itemId, session);
      if (!item) {
        throw new NotFoundError(
          `Item ${itemId} not found in version ${versionId}.`,
        );
      }

      // Update only the isOptional field but include the required type
      const updateData = {
        ...item,
        isOptional,
        type: item.type, // Include the item type which is required by updateItem
      };

      // Update the item with the required fields
      const result = await this.itemRepo.updateItem(
        itemId,
        updateData as any, // Still need any because of the details type mismatch
        session,
      );

      return result;
    });
  }

  private _convertTimeToSeconds(timeStr: string): number {
    if (!timeStr) return 0;
    const [minutes, seconds] = timeStr.split(':').map(Number);
    return minutes * 60 + (seconds || 0);
  }

  private _formatSecondsToHHMMSS(seconds: number): string {
    const hh = Math.floor(seconds / 3600);
    const mm = Math.floor((seconds % 3600) / 60);
    const ss = Math.floor(seconds % 60);
    return [
      hh.toString().padStart(2, '0'),
      mm.toString().padStart(2, '0'),
      ss.toString().padStart(2, '0'),
    ].join(':');
  }

  /**
   * Process CSV file and create video segments and quizzes
   */
  public async processCSVAndCreateItems(
    youtubeUrl: string,
    moduleId: string,
    sectionId: string,
    versionId: string,
    courseId: string,
    userId: string,
    data: CSVQuizQuestion[],
  ) {
    const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId);
      
    if(versionStatus==="archived"){
      throw new ForbiddenError("This course version is archived and cannot create items.");
    }
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data: Expected an array of questions');
    }

    if (data.length === 0) {
      throw new Error('CSV file contains no data rows');
    }

    const normalizeKey = (key: string): string =>
      key.replace(/\s+/g, ' ').trim();

    const getRowValue = (
      row: any,
      ...possibleKeys: string[]
    ): string | undefined => {
      for (const key of possibleKeys) {
        if (row[key] !== undefined) return row[key];
        const rowKeys = Object.keys(row);
        const normalizedTarget = normalizeKey(key);
        const matchingKey = rowKeys.find(
          k => normalizeKey(k) === normalizedTarget,
        );
        if (matchingKey && row[matchingKey] !== undefined)
          return row[matchingKey];
      }
      return undefined;
    };

    const normalizedData = data.map(row => {
      const normalized: any = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeKey(key)] = value;
      }
      return normalized as CSVQuizQuestion;
    });

    const firstRow = normalizedData[0];

    const requiredFields = ['Segment', 'Question', 'Correct Answer'];
    const missingFields = requiredFields.filter(field => !(field in firstRow));
    if (missingFields.length > 0) {
      throw new Error(
        `Missing required CSV columns: ${missingFields.join(
          ', ',
        )}. Available columns: ${Object.keys(firstRow).join(', ')}`,
      );
    }

    try {
      // Group questions by segment
      const segments = new Map<string, CSVQuizQuestion[]>();
      const seenSegments = new Set<string>();
      let currentSegment = '1';

      normalizedData.forEach((row, index) => {
        if (!row || typeof row !== 'object') {
          return;
        }

        // If Segment is empty, use the last seen segment
        const rawSegment = row['Segment']?.toString().trim();
        if (!row.Segment || rawSegment === '') {
          row.Segment = currentSegment;
        } else {
          currentSegment = rawSegment;
          row.Segment = currentSegment;
        }

        const segment = currentSegment;
        if (!segments.has(segment)) {
          segments.set(segment, []);
        }
        segments.get(segment)?.push(row);
        // Track unique segments for better error reporting
        if (!seenSegments.has(segment)) {
          seenSegments.add(segment);
        }
      });

      if (segments.size === 0) {
        throw new Error(
          'No valid segments found in the CSV. Please ensure your CSV has a "Segment" column with valid values.',
        );
      }

      // Process each segment
      let previousEndTime = 0;
      const segmentNumbers = Array.from(segments.keys()).sort(
        (a, b) => parseInt(a) - parseInt(b),
      );
      const createdItems = [];

      for (const segmentNumber of segmentNumbers) {
        const result = await this._withTransaction(async session => {
          const questions = segments.get(segmentNumber) || [];
          const segmentQuestions = questions.filter(
            q => q.Question && q['Correct Answer'],
          );

          // Get the first question's timestamp as the end time for the video segment
          const firstQuestion = segmentQuestions[0];

          let timestamp: string | undefined;
          if (firstQuestion) {
            timestamp =
              firstQuestion['Question Timestamp [mm:ss]'] ||
              firstQuestion['Question Timestamp  [mm:ss]'] ||
              firstQuestion['Question Timestamp [mm:ss]'] ||
              (Object.keys(firstQuestion).find(k => k.includes('Timestamp'))
                ? firstQuestion[
                Object.keys(firstQuestion).find(k =>
                  k.includes('Timestamp'),
                )!
                ]
                : undefined);
          }

          const timeCache = new Map<string, number>();

          const endTime = timestamp
            ? (timeCache.get(timestamp) ??
              timeCache
                .set(timestamp, this._convertTimeToSeconds(timestamp))
                .get(timestamp)!)
            : previousEndTime + 300;

          // Create video item
          const videoItem = await this.createItem(
            versionId,
            moduleId,
            sectionId,
            {
              type: ItemType.VIDEO,
              name: `Video ${segmentNumber}`,
              description: `Video segment ${segmentNumber} from CSV upload`,
              videoDetails: {
                URL: youtubeUrl,
                startTime: this._formatSecondsToHHMMSS(previousEndTime),
                endTime: this._formatSecondsToHHMMSS(endTime),
                points: 1,
              },
            },
          );

          // Create quiz item
          const quizItem = await this.createItem(
            versionId,
            moduleId,
            sectionId,
            {
              type: ItemType.QUIZ,
              name: `Quiz - Segment ${segmentNumber}`,
              description: `Quiz for segment ${segmentNumber} from CSV upload`,
              quizDetails: {
                passThreshold: 0.5,
                maxAttempts: -1,
                quizType: 'NO_DEADLINE',
                releaseTime: new Date(),
                questionVisibility: 1,
                approximateTimeToComplete: '00:01:00',
                allowPartialGrading: true,
                allowHint: true,
                showCorrectAnswersAfterSubmission: true,
                showExplanationAfterSubmission: true,
                showScoreAfterSubmission: true,
                allowSkip: false,
                deadline: null,
              },
            },
          );

          // Create question bank
          const questionBank = await this.questionBankService.create({
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(versionId),
            title: `Question Bank - Segment ${segmentNumber}`,
            description: `Questions for segment ${segmentNumber} from CSV upload`,
            questions: [],
            tags: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Add question bank to quiz
          await this.quizService.addQuestionBank(
            quizItem.createdItem._id.toString(),
            {
              bankId: questionBank,
              count: 3,
              tags: [],
            },
          );

          // Process questions
          for (const question of segmentQuestions) {
            const options = [
              {
                text: question['Option A'] || '',
                explanation: question['Expln-A'] || '',
              },
              {
                text: question['Option B'] || '',
                explanation: question['Expln-B'] || '',
              },
              {
                text: question['Option C'] || '',
                explanation: question['Expln-C'] || '',
              },
              {
                text: question['Option D'] || '',
                explanation: question['Expln-D'] || '',
              },
            ].filter(opt => opt.text);

            const correctAnswer = question['Correct Answer']?.toUpperCase();
            const correctOptionIndex = correctAnswer
              ? correctAnswer.charCodeAt(0) - 65
              : -1;

            if (
              correctOptionIndex >= 0 &&
              correctOptionIndex < options.length
            ) {
              const questionBody = {
                question: {
                  text: question.Question || '',
                  type: 'SELECT_ONE_IN_LOT' as QuestionType,
                  isParameterized: false,
                  parameters: [],
                  timeLimitSeconds: 60,
                  points: 1,
                  priority: 'MEDIUM' as Priority,
                  hint: question.Hint || '',
                },
                solution: {
                  correctLotItem: {
                    text: options[correctOptionIndex].text,
                    explaination:
                      options[correctOptionIndex].explanation ||
                      'No explanation provided',
                  },
                  incorrectLotItems: options
                    .filter((_, i) => i !== correctOptionIndex)
                    .map(opt => ({
                      text: opt.text,
                      explaination:
                        opt.explanation || 'No explanation provided',
                    })),
                },
              };
              const question2 = QuestionFactory.createQuestion(
                questionBody,
                userId,
              );
              const questionProcessor = new QuestionProcessor(question2);
              questionProcessor.validate();
              questionProcessor.render();

              const id = await this.questionService.create(question2);

              await this.questionBankService.addQuestion(questionBank, id);
            }
          }

          return {
            videoItem: videoItem.createdItem,
            quizItem: quizItem.createdItem,
            questionBankId: questionBank,
            questionCount: segmentQuestions.length,
            endTime,
          };
        });

        previousEndTime = result.endTime;
        createdItems.push(result);
      }

      return {
        success: true,
        message: 'Successfully processed CSV and created items',
        createdItems,
      };
    } catch (error) {
      throw new InternalServerError(
        `Failed to process CSV: ${error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  async getVideoAnalytics(
    courseId: string,
    versionId: string,
    videoId: string,
  ): Promise<VideoOverallAnalytics> {

    return await this._withTransaction(async session => {

      if (!ObjectId.isValid(videoId)) {
        throw new BadRequestError(`Invalid video ID: ${videoId}`);
      }
      if (!ObjectId.isValid(versionId)) {
        throw new BadRequestError(`Invalid version ID: ${versionId}`);
      }
      if (!ObjectId.isValid(courseId)) {
        throw new BadRequestError(`Invalid course ID: ${courseId}`);
      }

      const item = await this.itemRepo.readItem(versionId, videoId, session);
      if (!item) {
        throw new NotFoundError(`Video item ${videoId} not found in version ${versionId}.`);
      }

      if (item.type !== 'VIDEO') {
        throw new BadRequestError(`Item ${videoId} is not a video item.`);
      }

      const formatDuration = (start?: string, end?: string): string => {
        if (!end) return "00:00:00";

        const [sh = "0", sm = "0", ss = "0"] = (start || "00:00:00").split(":");
        const [eh = "0", em = "0", es = "0"] = end.split(":");

        const startSeconds =
          Number(sh) * 3600 + Number(sm) * 60 + Number(ss);

        const endSeconds =
          Number(eh) * 3600 + Number(em) * 60 + Number(es);

        const diff = Math.max(endSeconds - startSeconds, 0);

        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;

        const pad = (n: number) => String(n).padStart(2, "0");

        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      };

      const videoDuration = formatDuration(
        item.details?.startTime,
        item.details?.endTime
      );


      const watchTimeData = await this.progressRepo.getWatchTimeByItemId(
        videoId,
      );

      const MAX_SECONDS_PER_VIEW = 10 * 60; // 600

      const getCappedWatchSeconds = (startTime?: Date, endTime?: Date) => {
        if (!startTime || !endTime) return 0;

        const diffSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        if (!Number.isFinite(diffSeconds) || diffSeconds <= 0) return 0;

        return Math.min(diffSeconds, MAX_SECONDS_PER_VIEW);
      };

      const totalViews = watchTimeData.length;
      const uniqueUsers = new Set(watchTimeData.map(e => String(e.userId))).size || 1;
      const totalWatchSeconds = watchTimeData.reduce((sum, entry) => {
        return sum + getCappedWatchSeconds(entry.startTime, entry.endTime);
      }, 0);

      const averageViewsPerUser =
        Number((totalViews / uniqueUsers).toFixed(3));

      const averageWatchHoursPerUser =
        Number(((totalWatchSeconds / uniqueUsers) / 3600).toFixed(3));


      return {
        videoId,
        videoDuration,
        totalViews,
        totalWatchHours: totalWatchSeconds / 3600,
        averageViewsPerUser,
        averageWatchHoursPerUser,
      };
    })
  }


  async getVideoUserAnalytics(
    courseId: string,
    versionId: string,
    videoId: string,
    query: VideoUserAnalyticsQuery
  ): Promise<VideoUserAnalyticsResponse> {

    const { page = 1, limit = 12, search, sortBy = 'name', sortOrder = 'asc' } = query;
    return await this.progressRepo.getVideoUserAnalytics(
      courseId,
      versionId,
      videoId,
      page,
      limit,
      search,
      sortBy,
      sortOrder
    );
  }
}
