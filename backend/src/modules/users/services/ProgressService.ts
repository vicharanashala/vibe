import { Item } from '#courses/classes/transformers/Item.js';
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
} from 'routing-controllers';
import { SubmissionRepository } from '#quizzes/repositories/providers/mongodb/SubmissionRepository.js';
import { QUIZZES_TYPES } from '#quizzes/types.js';
import { WatchTime } from '../classes/transformers/WatchTime.js';
import { CompletedProgressResponse } from '../classes/index.js';
import {
  QuizRepository,
  UserQuizMetricsRepository,
} from '#root/modules/quizzes/repositories/index.js';
import { EnrollmentRepository } from '#root/shared/index.js';
import { PROJECTS_TYPES } from '#root/modules/projects/types.js';
import { IProjectSubmissionRepository } from '#root/modules/projects/interfaces/IProjectSubmissionRepository.js';

@injectable()
class ProgressService extends BaseService {
  constructor(
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepository: ProgressRepository,

    @inject(QUIZZES_TYPES.SubmissionRepo)
    private readonly submissionRepository: SubmissionRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

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

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase, // inject the database provider
  ) {
    super(database);
  }

  /**
   * Initialize student progress tracking to the first item in the course.
   * Private helper method for the enrollment process.
   */
  async initializeProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    courseVersion: ICourseVersion, // Replace with the actual type of courseVersion
  ) {
    // Get the first module, section, and item
    if (!courseVersion.modules || courseVersion.modules.length === 0) {
      return null; // No modules to track progress for
    }

    const firstModule = courseVersion.modules.sort((a, b) =>
      a.order.localeCompare(b.order),
    )[0];

    if (!firstModule.sections || firstModule.sections.length === 0) {
      return null; // No sections to track progress for
    }

    const firstSection = firstModule.sections.sort((a, b) =>
      a.order.localeCompare(b.order),
    )[0];

    // Get the first item from the itemsGroup
    const itemsGroup = await this.itemRepo.readItemsGroup(
      firstSection.itemsGroupId.toString(),
    );

    if (!itemsGroup || !itemsGroup.items || itemsGroup.items.length === 0) {
      return null; // No items to track progress for
    }

    const firstItem = itemsGroup.items.sort((a, b) =>
      a.order.localeCompare(b.order),
    )[0];

    // Create progress record with the actual first item
    // Blank quiz skipping will happen naturally during progression
    return new Progress(
      userId,
      courseId,
      courseVersionId,
      firstModule.moduleId.toString(),
      firstSection.sectionId.toString(),
      firstItem._id.toString(),
    );
  }

  private async initializeProgressToModule(
    userId: string,
    courseId: string,
    courseVersionId: string,
    courseVersion: ICourseVersion,
    moduleId: string,
  ) {
    // Get the first module, section, and item
    if (!courseVersion.modules || courseVersion.modules.length === 0) {
      return null; // No modules to track progress for
    }

    const module = courseVersion.modules.find(
      module => module.moduleId.toString() === moduleId,
    );

    if (!module) {
      throw new NotFoundError(
        'Module not found in the specified course version.',
      );
    }

    if (!module.sections || module.sections.length === 0) {
      return null; // No sections to track progress for
    }

    const firstSection = module.sections.sort((a, b) =>
      a.order.localeCompare(b.order),
    )[0];

    // Get the first item from the itemsGroup
    const itemsGroup = await this.itemRepo.readItemsGroup(
      firstSection.itemsGroupId.toString(),
    );

    if (!itemsGroup || !itemsGroup.items || itemsGroup.items.length === 0) {
      return null; // No items to track progress for
    }

    const firstItem = itemsGroup.items.sort((a, b) =>
      a.order.localeCompare(b.order),
    )[0];

    const firstNonBlankItem = await this.findNextNonBlankItem(
      courseVersion,
      module.moduleId.toString(),
      firstSection.sectionId.toString(),
      firstItem._id.toString(),
    );

    if (!firstNonBlankItem) {
      return null;
    }

    return new Progress(
      userId,
      courseId,
      courseVersionId,
      firstNonBlankItem.moduleId,
      firstNonBlankItem.sectionId,
      firstNonBlankItem.itemId,
    );
  }

  private async initializeProgressToSection(
    userId: string,
    courseId: string,
    courseVersionId: string,
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
  ) {
    // Get the first module, section, and item
    if (!courseVersion.modules || courseVersion.modules.length === 0) {
      return null; // No modules to track progress for
    }

    const module = courseVersion.modules.find(
      module => module.moduleId.toString() === moduleId,
    );

    if (!module) {
      throw new NotFoundError(
        'Module not found in the specified course version.',
      );
    }

    const section = module.sections.find(
      section => section.sectionId.toString() === sectionId,
    );

    if (!section) {
      throw new NotFoundError('Section not found in the specified module.');
    }

    // Get the first item from the itemsGroup
    const itemsGroup = await this.itemRepo.readItemsGroup(
      section.itemsGroupId.toString(),
    );

    if (!itemsGroup || !itemsGroup.items || itemsGroup.items.length === 0) {
      return null; // No items to track progress for
    }

    const firstItem = itemsGroup.items.sort((a, b) =>
      a.order.localeCompare(b.order),
    )[0];

    const firstNonBlankItem = await this.findNextNonBlankItem(
      courseVersion,
      module.moduleId.toString(),
      section.sectionId.toString(),
      firstItem._id.toString(),
    );

    if (!firstNonBlankItem) {
      return null;
    }

    return new Progress(
      userId,
      courseId,
      courseVersionId,
      firstNonBlankItem.moduleId,
      firstNonBlankItem.sectionId,
      firstNonBlankItem.itemId,
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
  ) {
    // Get the first module, section, and item
    if (!courseVersion.modules || courseVersion.modules.length === 0) {
      return null; // No modules to track progress for
    }

    const module = courseVersion.modules.find(
      module => module.moduleId.toString() === moduleId,
    );

    if (!module) {
      throw new NotFoundError(
        'Module not found in the specified course version.',
      );
    }

    const section = module.sections.find(
      section => section.sectionId.toString() === sectionId,
    );

    if (!section) {
      throw new NotFoundError('Section not found in the specified module.');
    }

    // Get the first item from the itemsGroup
    const itemsGroup = await this.itemRepo.readItemsGroup(
      section.itemsGroupId.toString(),
    );

    if (!itemsGroup || !itemsGroup.items || itemsGroup.items.length === 0) {
      return null; // No items to track progress for
    }

    const item = itemsGroup.items.find(item => item._id.toString() === itemId);

    if (!item) {
      throw new NotFoundError('Item not found in the specified section.');
    }

    const firstNonBlankItem = await this.findNextNonBlankItem(
      courseVersion,
      module.moduleId.toString(),
      section.sectionId.toString(),
      item._id.toString(),
    );

    if (!firstNonBlankItem) {
      return null;
    }

    return new Progress(
      userId,
      courseId,
      courseVersionId,
      firstNonBlankItem.moduleId,
      firstNonBlankItem.sectionId,
      firstNonBlankItem.itemId,
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
  ): Promise<void> {
    const enrollment = await this.enrollmentRepo.findEnrollment(
      userId,
      courseId,
      courseVersionId,
    );
    if (!enrollment) throw new NotFoundError('User has no enrollments');

    let percentCompleted = 0;
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
        this.itemRepo.getTotalItemsCount(
          courseId,
          courseVersionId,
          session,
        ),
        completedItemCount ??
        this.getUserProgressPercentageWithoutTotal(
          userId,
          courseId,
          courseVersionId,
          session,
        ),
      ]);

      percentCompleted = Math.round(
        (totalItems > 0 ? completedItems / totalItems : 0) * 100,
      );
    }

    await this.enrollmentRepo.updateProgressPercentById(
      enrollment._id.toString(),
      percentCompleted,
      session,
    );
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

        const completedItems = await this.getUserProgressPercentageWithoutTotal(
          userId,
          courseId,
          versionId,
        );

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
                  enrollment,
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
    enrollment: any,
    totalItems: number,
    completedItems: number,
  ): number {
    if (!totalItems || totalItems === 0) return 0;
    return ((completedItems ?? 0) / totalItems) * 100;
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
  ): Promise<void> {
    const [progress, completedItems] = await Promise.all([
      this.progressRepository.findProgress(userId, courseId, courseVersionId),
      this.progressRepository.getCompletedItems(userId, courseId, courseVersionId),
    ]);

    if (!progress) {
      throw new NotFoundError('Progress not found');
    }

    if (completedItems.includes(itemId)) {
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
    const sortedModules = courseVersion.modules.sort((a, b) =>
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
        item => item._id === itemId,
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

  public async determineNextAllowedItem(
    currentItemId: string,
    quizMetrics: any,
    enrollment: any,
  ): Promise<{ nextItemId?: string }> {
    try {
      if (quizMetrics?.remainingAttempts !== 0) {
        return {}; // No permission update needed
      }

      const itemsGroup = await this.itemRepo.findItemsGroupByItemId(
        currentItemId,
      );
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

  getUserMetricsForQuiz(userId: string, quizId: string) {
    return this._withTransaction(async session => {
      const metrics = await this.userQuizMetricsRepository.get(
        userId,
        quizId,
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
      return {
        completed: true,
        completedAt: new Date(),
        currentModule: moduleId,
        currentSection: sectionId,
        currentItem: itemId,
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
      return {
        completed: true,
        completedAt: new Date(),
        currentModule: moduleId,
        currentSection: sectionId,
        currentItem: itemId,
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

  private isValidWatchTime(watchTime: IWatchTime, item: Item) {
    return true;
    // switch (item.type) {
    //   case 'VIDEO':
    //     return true;
    //     if (watchTime.startTime && watchTime.endTime && item.details) {
    //       const videoDetails = item.details as IVideoDetails;
    //       const videoStartTime = videoDetails.startTime; // a string in HH:MM:SS format
    //       const videoEndTime = videoDetails.endTime; // a string in HH:MM:SS format
    //       const watchStartTime = new Date(watchTime.startTime);
    //       const watchEndTime = new Date(watchTime.endTime);

    //       // Get Time difference in seconds
    //       const timeDiff =
    //         Math.abs(watchEndTime.getTime() - watchStartTime.getTime()) / 1000;

    //       // Get Video duration in seconds
    //       // Convert HH:MM:SS to seconds
    //       const videoEndTimeInSeconds =
    //         parseInt(videoEndTime.split(':')[0]) * 3600 +
    //         parseInt(videoEndTime.split(':')[1]) * 60 +
    //         parseInt(videoEndTime.split(':')[2]);
    //       const videoStartTimeInSeconds =
    //         parseInt(videoStartTime.split(':')[0]) * 3600 +
    //         parseInt(videoStartTime.split(':')[1]) * 60 +
    //         parseInt(videoStartTime.split(':')[2]);

    //       const videoDuration = videoEndTimeInSeconds - videoStartTimeInSeconds;

    //       // Check if the watch time is >= 0.2 * video duration
    //       if (timeDiff >= 0.2 * videoDuration) {
    //         return true;
    //       }
    //       // return false;
    //       return true; // For now, we assume the watch time is valid
    //     }

    //     break;

    //   case 'BLOG':
    //     return true;
    //     // if (watchTime.startTime && watchTime.endTime && item.details) {
    //     //   const blogDetails = item.details as IBlogDetails;
    //     //   const watchStartTime = new Date(watchTime.startTime);
    //     //   const watchEndTime = new Date(watchTime.endTime);

    //     //   // Get Time difference in seconds
    //     //   const timeDiff =
    //     //     Math.abs(watchEndTime.getTime() - watchStartTime.getTime()) / 1000;

    //     //   // Check if the watch time is >= 0.5 * estimated read time
    //     //   if (timeDiff >= 0.6 * blogDetails.estimatedReadTimeInMinutes * 60) {
    //     //     return true;
    //     //   }
    //     //   return false;
    //     // }
    //     break;
    // }
  }

  async getUserProgress(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
  ): Promise<Progress> {
    return this._withTransaction(async session => {
      // Verify if the user, course, and course version exist
      await this.verifyDetails(userId, courseId, courseVersionId);

      const progress = await this.progressRepository.findProgress(
        userId,
        courseId,
        courseVersionId,
      );

      // if (!progress) {
      //   throw new NotFoundError('Progress not found');
      // }

      return Object.assign(new Progress(), progress);
    });
  }

  async getUserProgressPercentage(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
  ): Promise<CompletedProgressResponse> {
    return this._withTransaction(async session => {
      // Verify if the user, course, and course version exist
      await this.verifyDetails(userId, courseId, courseVersionId);

      const progress = await this.progressRepository.findProgress(
        userId,
        courseId,
        courseVersionId,
      );

      if (!progress) {
        throw new NotFoundError('Progress not found');
      }

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
          session,
        );

      const enrollment = await this.enrollmentRepo.findEnrollment(
        userId,
        courseId,
        courseVersionId,
      );

      // Use Set to ensure unique completed items and for efficient size comparison
      const completedItemsSet = new Set(completedItemsArray);

      return {
        completed: progress.completed,
        percentCompleted: enrollment.percentCompleted,
        totalItems: totalItems,
        completedItems: completedItemsSet.size,
      };
    });
  }

  async getUserProgressPercentageWithoutTotal(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    existingSession?: ClientSession,
  ): Promise<number> {
    if (existingSession) {
      await this.verifyDetails(userId, courseId, courseVersionId);

      const completedItemsArray =
        await this.progressRepository.getCompletedItems(
          userId.toString(),
          courseId,
          courseVersionId,
          existingSession,
        );

      //

      const completedItemsSet = new Set(completedItemsArray);
      return completedItemsSet.size;
    }

    return this._withTransaction(async session => {
      // Verify if the user, course, and course version exist
      await this.verifyDetails(userId, courseId, courseVersionId);

      const completedItemsArray =
        await this.progressRepository.getCompletedItems(
          userId.toString(),
          courseId,
          courseVersionId,
          session,
        );

      // Use Set to ensure unique completed items and for efficient size comparison
      const completedItemsSet = new Set(completedItemsArray);

      return completedItemsSet.size;
    });
  }

  async startItem(
    userId: string,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
  ): Promise<string> {
    return this._withTransaction(async session => {

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
        ),
      ]);

      // 🔒 Write happens AFTER validations
      const result = await this.progressRepository.startItemTracking(
        userId,
        courseId,
        courseVersionId,
        itemId,
        session,
      );

      return result;
    });
  }


  async stopItem(
    userId: string,
    courseId: string,
    courseVersionId: string,
    itemId: string,
    sectionId: string,
    moduleId: string,
    watchItemId: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      // Verify if the user, course, and course version exist
      await this.verifyDetails(userId, courseId, courseVersionId);
      await this.verifyProgress(
        userId,
        courseId,
        courseVersionId,
        moduleId,
        sectionId,
        itemId,
      );

      //Verify if the watchItemId is valid
      const watchItem = await this.progressRepository.getWatchTimeById(
        watchItemId,
        session,
      );

      if (!watchItem) {
        throw new NotFoundError('Watch item not found');
      }

      // Stop tracking the item
      const result: IWatchTime = await this.progressRepository.stopItemTracking(
        watchItemId,
        session,
      );
      if (!result) {
        throw new InternalServerError('Failed to stop tracking item');
      }
    });
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
          session,
        );
        if (!submittedQuiz) {
          throw new BadRequestError(
            'Quiz not submitted or attemptId is invalid',
          );
        }
        if (submittedQuiz.gradingResult.gradingStatus !== 'PASSED') {
          throw new BadRequestError(
            'Quiz not passed, user cannot proceed to the next item',
          );
        }
      } else if (item.type === 'PROJECT') {
        const projectSubmission =
          await this.projectSubmissionRepo.getByUser(
            userId,
            courseVersionId,
            courseId,
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
              session,
            );

            const watchTimeRecords =
              await this.progressRepository.getWatchTime(
                userId,
                blankQuizId,
                courseId,
                courseVersionId,
                session,
              );

            if (watchTimeRecords?.length) {
              await this.progressRepository.stopItemTracking(
                watchTimeRecords[0]._id.toString(),
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
  ): Promise<void> {
    if (!quizItemIds.length) return;

    // Fetch all quizzes in one go
    const quizzes = await this.quizRepo.getByIds(quizItemIds, session);

    const maxAttemptsMap = quizzes.reduce((acc, quiz) => {
      acc[quiz._id.toString()] = quiz?.details?.maxAttempts || 0;
      return acc;
    }, {} as Record<string, number>);

    // Collect attemptIds to delete and bulk ops for all collections
    const { attemptDeletes, metricsUpdates, submissionDeletes } =
      await this.progressRepository.prepareBulkQuizOperations(
        userId,
        quizItemIds,
        maxAttemptsMap,
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
  ): Promise<void> {
    if (!projectItemIds.length) return;

    // Delete all project submissions for the user in this course version
    await this.projectSubmissionRepo.deleteByUserAndVersion(
      userId,
      courseVersionId,
      session,
    );
  }

  // Admin Level Endpoint
  async resetCourseProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
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
      );

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
          session,
        ),
        this.updateEnrollmentProgressPercent(
          userId,
          courseId,
          courseVersionId,
          session,
          true,
        ),
        quizItemIds.length
          ? this.resetUserQuizData(userId, quizItemIds, session)
          : Promise.resolve(),
        projectItemIds.length
          ? this.resetUserProjectData(
            userId,
            projectItemIds,
            courseVersionId,
            session,
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
    session?: ClientSession,
  ): Promise<void> {
    return this._withTransaction(async session => {
      // Run verify + courseVersion fetch in parallel
      const [_, courseVersion] = await Promise.all([
        this.verifyDetails(userId, courseId, courseVersionId),
        this.courseRepo.readVersion(courseVersionId, session),
      ]);

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
        this.progressRepository.deleteProgress(
          userId,
          courseId,
          courseVersionId,
          session,
        ),
        this.progressRepository.deleteUserWatchTimeByCourseVersion(
          userId,
          courseId,
          courseVersionId,
          session,
        ),
        this.enrollmentRepo.deleteEnrollment(
          userId,
          courseId,
          courseVersionId,
          session,
        ),
        quizItemIds.length
          ? this.resetUserQuizData(userId, quizItemIds, session)
          : Promise.resolve(),
        projectItemIds.length
          ? this.resetUserProjectData(
            userId,
            projectItemIds,
            courseVersionId,
            session,
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
  ): Promise<void> {
    return this._withTransaction(async session => {
      await this.verifyDetails(userId, courseId, courseVersionId);
      // Get Course Version
      const courseVersion = await this.courseRepo.readVersion(courseVersionId);

      // Get the new progress after resetting to the module
      const newProgress = await this.initializeProgressToModule(
        userId,
        courseId,
        courseVersionId,
        courseVersion,
        moduleId,
      );

      if (!newProgress) {
        throw new InternalServerError('New progress could not be calculated');
      }

      // to get selected module from the version
      const selectedModule = courseVersion.modules.filter(
        module => module.moduleId == moduleId,
      )[0];

      if (!selectedModule)
        throw new NotFoundError(`Failed to find module with id: ${moduleId}`);

      // to store all the quiz and project item ids
      const quizItemIds: string[] = [];
      const projectItemIds: string[] = [];

      // to store all the item id's to clear watch time using itemId
      const itemIds: string[] = [];

      const itemsGroupIds: string[] = [];
      // storing the item group id to a array
      for (const section of selectedModule.sections) {
        itemsGroupIds.push(section.itemsGroupId as string);
      }

      for (const itemGroupId of itemsGroupIds) {
        const itemsGroup = await this.itemRepo.readItemsGroup(
          itemGroupId,
          session,
        );
        for (const item of itemsGroup.items || []) {
          const itemId = item._id.toString();
          if (item.type === 'QUIZ') {
            quizItemIds.push(item._id as string);
          }
          itemIds.push(item._id as string);
        }
      }
      const completedItemCount =
        await this.getUserProgressPercentageWithoutTotal(
          userId,
          courseId,
          courseVersionId,
        );
      let deletedWatchTimeCount = 0;
      // Clear all completed items (watch time) for this user/course/version
      for (const itemId of itemIds) {
        const { deletedCount } =
          await this.progressRepository.deleteUserWatchTimeByItemId(
            userId,
            itemId,
            session,
          );
        deletedWatchTimeCount += deletedCount;
      }

      const updatedCompletedItemCount =
        completedItemCount - deletedWatchTimeCount || 0;
      // for updating enrollment progress percent
      await this.updateEnrollmentProgressPercent(
        userId,
        courseId,
        courseVersionId,
        session,
        false,
        undefined,
        updatedCompletedItemCount,
      );

      // to remove all the quiz related data of the user
      if (quizItemIds.length) {
        // deleting quiz related data
        await this.resetUserQuizData(userId, quizItemIds, session);
      }

      // Set progress
      const result = await this.progressRepository.findAndReplaceProgress(
        userId,
        courseId,
        courseVersionId,
        {
          currentModule: newProgress.currentModule,
          currentSection: newProgress.currentSection,
          currentItem: newProgress.currentItem,
          completed: false,
        },
      );

      if (!result) {
        throw new InternalServerError('Progress could not be reset');
      }
    });
  }

  async resetCourseProgressToSection(
    userId: string,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    sectionId: string,
  ) {
    return this._withTransaction(async session => {
      await this.verifyDetails(userId, courseId, courseVersionId);
      // Get Course Version
      const courseVersion = await this.courseRepo.readVersion(courseVersionId);

      // Get the new progress after resetting to the section
      const newProgress = await this.initializeProgressToSection(
        userId,
        courseId,
        courseVersionId,
        courseVersion,
        moduleId,
        sectionId,
      );
      if (!newProgress) {
        throw new InternalServerError('New progress could not be calculated');
      }

      // to store all the quiz item id's, to update attempts and metrics
      const quizItemIds: string[] = [];

      // find selected module
      const selectedModule = courseVersion.modules.filter(
        module => module.moduleId == moduleId,
      )[0];

      if (!selectedModule)
        throw new NotFoundError(`Failed to find module with id: ${moduleId}`);

      // find selecte section from module
      const section = selectedModule.sections.find(
        section => section.sectionId.toString() === sectionId,
      );

      if (!section) {
        throw new NotFoundError('Section not found in the specified module.');
      }

      // storing the itemsGroup Id
      const itemsGroupId = section.itemsGroupId as string;

      const itemsGroup = await this.itemRepo.readItemsGroup(
        itemsGroupId,
        session,
      );

      // Storing all item id in the section to an array
      const itemIds: string[] = [];
      // storing the quiz id's from itemGroup
      for (const item of itemsGroup.items || []) {
        if (item.type === 'QUIZ') {
          quizItemIds.push(item._id as string);
        }
        itemIds.push(item._id as string);
      }

      const completedItemCount =
        await this.getUserProgressPercentageWithoutTotal(
          userId,
          courseId,
          courseVersionId,
        );
      let deletedWatchTimeCount = 0;
      // Clear all completed items (watch time) for this user/course/version
      for (const itemId of itemIds) {
        const { deletedCount } =
          await this.progressRepository.deleteUserWatchTimeByItemId(
            userId,
            itemId,
          );
        deletedWatchTimeCount += deletedCount;
      }

      const updatedCompletedItemCount =
        completedItemCount - deletedWatchTimeCount || 0;
      // for updating enrollment progress percent
      await this.updateEnrollmentProgressPercent(
        userId,
        courseId,
        courseVersionId,
        session,
        false,
        undefined,
        updatedCompletedItemCount,
      );

      // to remove all the quiz related data of the user
      if (quizItemIds.length) {
        // deleting quiz related data
        await this.resetUserQuizData(userId, quizItemIds, session);
      }

      // Set progress
      const result = await this.progressRepository.findAndReplaceProgress(
        userId,
        courseId,
        courseVersionId,
        {
          currentModule: newProgress.currentModule,
          currentSection: newProgress.currentSection,
          currentItem: newProgress.currentItem,
          completed: false,
        },
      );

      if (!result) {
        throw new InternalServerError('Progress could not be reset');
      }
    });
  }

  async resetCourseProgressToItem(
    userId: string,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
  ) {
    return this._withTransaction(async session => {
      await this.verifyDetails(userId, courseId, courseVersionId);
      // Get Course Version
      const courseVersion = await this.courseRepo.readVersion(courseVersionId);

      // to store all the quiz item id's, to update attempts and metrics
      const quizItemIds: string[] = [];

      // find selected module
      const selectedModule = courseVersion.modules.filter(
        module => module.moduleId == moduleId,
      )[0];

      if (!selectedModule)
        throw new NotFoundError(`Failed to find module with id: ${moduleId}`);

      // find selecte section from module
      const section = selectedModule.sections.find(
        section => section.sectionId.toString() === sectionId,
      );

      if (!section) {
        throw new NotFoundError('Section not found in the specified module.');
      }

      // storing the itemsGroup Id
      const itemsGroupId = section.itemsGroupId as string;

      const itemsGroup = await this.itemRepo.readItemsGroup(
        itemsGroupId,
        session,
      );

      for (const item of itemsGroup.items || []) {
        if (item.type === 'QUIZ' && item._id == itemId) {
          quizItemIds.push(item._id as string);
        }
      }

      if (quizItemIds.length) {
        // deleting quiz related data
        await this.resetUserQuizData(userId, quizItemIds, session);
      }

      // Get the new progress after resetting to the item
      const newProgress = await this.initializeProgressToItem(
        userId,
        courseId,
        courseVersionId,
        courseVersion,
        moduleId,
        sectionId,
        itemId,
      );
      if (!newProgress) {
        throw new InternalServerError('New progress could not be calculated');
      }

      const completedItemCount =
        await this.getUserProgressPercentageWithoutTotal(
          userId,
          courseId,
          courseVersionId,
        );
      // Clear all items (watch time) for this user/course/version
      const { deletedCount } =
        await this.progressRepository.deleteUserWatchTimeByItemId(
          userId,
          itemId,
          session,
        );

      const updatedCompletedItemCount = completedItemCount - deletedCount || 0;

      // for updating enrollment progress percent
      await this.updateEnrollmentProgressPercent(
        userId,
        courseId,
        courseVersionId,
        session,
        false,
        undefined,
        updatedCompletedItemCount,
      );

      // Set progress
      const result = await this.progressRepository.findAndReplaceProgress(
        userId,
        courseId,
        courseVersionId,
        {
          currentModule: newProgress.currentModule,
          currentSection: newProgress.currentSection,
          currentItem: newProgress.currentItem,
          completed: false,
        },
      );

      if (!result) {
        throw new InternalServerError('Progress could not be reset');
      }
    });
  }

  async getWatchTime(
    userId: string,
    itemId: string,
    courseId?: string,
    courseVersionId?: string,
  ): Promise<WatchTime[]> {
    if (courseId && courseVersionId)
      await this.verifyDetails(userId, courseId, courseVersionId);
    const watchTime = await this.progressRepository.getWatchTime(
      userId,
      itemId,
      courseId,
      courseVersionId,
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
    session?: ClientSession,
  ): Promise<{ message: String }> {
    const item = await this.itemRepo.readItem(courseVersionId, itemId);
    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }

    if (item.isOptional !== true) {
      throw new BadRequestError('Item is not marked as optional');
    }

    // Get or create progress

    let progress = await this.progressRepository.findProgress(
      userId,
      courseId,
      courseVersionId,
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

    // First, check if a watch time record already exists for this item
    const existingWatchTime = await this.progressRepository.getWatchTime(
      userId,
      itemId,
      courseId,
      courseVersionId,
      session,
    );

    let watchTimeId;
    if (!existingWatchTime || existingWatchTime.length === 0) {
      // No existing watch time, create a new one
      watchTimeId = await this.progressRepository.startItemTracking(
        userId,
        courseId,
        courseVersionId,
        itemId,
        session,
      );

      if (watchTimeId) {
        // Mark the item as completed by stopping the watch time
        await this.progressRepository.stopItemTracking(watchTimeId, session);
      }
    } else {
      // Use the existing watch time ID
      watchTimeId = existingWatchTime[0]._id;
      // Ensure the watch time is marked as completed
      await this.progressRepository.stopItemTracking(watchTimeId, session);
    }
    // Get the next item
    const nextItem = await this.getNextItemInSequence(
      courseVersion,
      progress?.currentModule?.toString(),
      progress?.currentSection?.toString(),
      itemId,
    );

    if (!nextItem) {
      // If no next item, mark the course as completed
      await this.progressRepository.updateProgress(
        userId,
        courseId,
        courseVersionId,
        {
          completed: true,
          currentItem: null,
        },
        session,
      );
      return { message: 'Course completed - no next item found' };
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
      session,
    );

    return { message: 'Item skipped successfully' };
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
      enrollmentMap.set(enrollment.userId.toString(), {
        completionPercentage: enrollment.percentCompleted || 0,
      });
    }

    // Get user names for all enrolled students
    const userIds = enrollments.map(e => e.userId.toString());
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
      userId: progress.userId.toString(),
      userName: userMap.get(progress.userId.toString()) || 'Unknown User',
      completionPercentage:
        enrollmentMap.get(progress.userId.toString())?.completionPercentage ||
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
}

export { ProgressService };
