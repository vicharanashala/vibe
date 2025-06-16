import {Item} from '#courses/classes/transformers/Item.js';
import {COURSES_TYPES} from '#courses/types.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {
  ICourseVersion,
  IWatchTime,
  IProgress,
} from '#root/shared/interfaces/models.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {ProgressRepository} from '#shared/database/providers/mongo/repositories/ProgressRepository.js';
import {Progress} from '#users/classes/transformers/Progress.js';
import {USERS_TYPES} from '#users/types.js';
import {injectable, inject} from 'inversify';
import {ObjectId} from 'mongodb';
import {
  NotFoundError,
  BadRequestError,
  InternalServerError,
} from 'routing-controllers';
@injectable()
class ProgressService extends BaseService {
  constructor(
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepository: ProgressRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(USERS_TYPES.UserRepo)
    private readonly userRepo: IUserRepository,

    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase, // inject the database provider
  ) {
    super(database);
  }

  /**
   * Initialize student progress tracking to the first item in the course.
   * Private helper method for the enrollment process.
   */
  private async initializeProgress(
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

    // Create progress record
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

    // Create progress record
    return new Progress(
      userId,
      courseId,
      courseVersionId,
      module.moduleId.toString(),
      firstSection.sectionId.toString(),
      firstItem._id.toString(),
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

    // Create progress record
    return new Progress(
      userId,
      courseId,
      courseVersionId,
      module.moduleId.toString(),
      section.sectionId.toString(),
      firstItem._id.toString(),
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

    // Create progress record
    return new Progress(
      userId,
      courseId,
      courseVersionId,
      module.moduleId.toString(),
      section.sectionId.toString(),
      item._id.toString(),
    );
  }

  private async verifyDetails(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
  ): Promise<void> {
    // Check if user exists
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if course exists
    const course = await this.courseRepo.read(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    // Check if course version exists and belongs to the course
    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
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
    // Check if user progress exists
    const progress = await this.progressRepository.findProgress(
      userId,
      courseId,
      courseVersionId,
    );

    if (!progress) {
      throw new NotFoundError('Progress not found');
    }

    // Check if the progress module and section are the same as the current progress
    if (
      progress.currentModule !== moduleId ||
      progress.currentSection !== sectionId ||
      progress.currentItem !== itemId
    ) {
      throw new BadRequestError(
        'ModuleId, sectionId and itemId do not match current progress',
      );
    }
  }

  private async getNewProgress(
    courseVersion: ICourseVersion,
    moduleId: string,
    sectionId: string,
    itemId: string,
  ) {
    let isLastItem = false;
    let isLastSection = false;
    let isLastModule = false;

    let completed = false;
    let currentItem: string = itemId;
    let currentSection: string = sectionId;
    let currentModule: string = moduleId;

    // Check if the moduleId is the last module in the course
    // 1. Sort modules by order
    const sortedModules = courseVersion.modules.sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    // 2. Find the last moduleId in the course
    const lastModule = sortedModules[sortedModules.length - 1].moduleId;
    // 3. Set the isLastModule flag to true if it is the last module
    if (lastModule === moduleId) {
      isLastModule = true;
    }

    // Check if the sectionId is the last section in the module
    // 1. Sort sections in module by order
    const sortedSections = courseVersion.modules
      .find(module => module.moduleId === moduleId)
      ?.sections.sort((a, b) => a.order.localeCompare(b.order));
    // 2. ind the last sectionId in the module
    const lastSection = sortedSections?.[sortedSections.length - 1].sectionId;
    // 3. Set the isLastSection flag to true if it is the last section
    if (lastSection === sectionId) {
      isLastSection = true;
    }

    // Check if the itemId is the last item in the section
    // 1. Sort items in section by order
    // 1.1 Find the itemsGroupId in the section
    const itemsGroupId = courseVersion.modules
      .find(module => module.moduleId === moduleId)
      ?.sections.find(section => section.sectionId === sectionId)?.itemsGroupId;
    // 1.2 Get items from itemsGroupId
    const itemsGroup = await this.itemRepo.readItemsGroup(
      itemsGroupId?.toString(),
    );
    // 1.3 Sort items in itemsGroup by order
    const sortedItems = itemsGroup.items.sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    // 2. Check if the itemId is the last item in the section
    const lastItem = sortedItems[sortedItems.length - 1]._id;
    // 3. Set the isLastItem flag to true if it is the last item
    if (lastItem === itemId) {
      isLastItem = true;
    }

    // Handle when the item is the last item in the last section of the last module
    if (isLastItem && isLastSection && isLastModule) {
      completed = true;
    }

    // Handle when the item is the last item in the last section but not the last module
    if (isLastItem && isLastSection && !isLastModule) {
      // Get index of the current module
      const currentModuleIndex = sortedModules.findIndex(
        module => module.moduleId === moduleId,
      );
      // Get next moduleId
      const nextModule = sortedModules[currentModuleIndex + 1];
      currentModule = nextModule?.moduleId.toString();
      // Get first sectionId in the next module
      const firstSection = nextModule?.sections.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[0];
      currentSection = firstSection?.sectionId.toString();

      // Get first itemId in the next section
      const itemsGroup = await this.itemRepo.readItemsGroup(
        firstSection?.itemsGroupId.toString(),
      );
      const firstItem = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[0];
      currentItem = firstItem._id.toString();
    }

    // Handle when the item is the last item in the section but not the last section and not the last module
    if (isLastItem && !isLastSection && !isLastModule) {
      // Get index of the current section
      const currentSectionIndex = sortedSections?.findIndex(
        section => section.sectionId === sectionId,
      );
      // Get next sectionId
      const nextSection = sortedSections?.[currentSectionIndex + 1];
      currentSection = nextSection?.sectionId.toString();

      // Get first itemId in the next section
      const itemsGroup = await this.itemRepo.readItemsGroup(
        nextSection?.itemsGroupId.toString(),
      );
      const firstItem = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[0];
      currentItem = firstItem._id.toString();
    }

    // Handle when none of the item, the section, or the module is last.
    if (!isLastItem && !isLastSection && !isLastModule) {
      // Get index of the current item
      const currentItemIndex = sortedItems.findIndex(
        item => item._id === itemId,
      );
      // Get next itemId
      const nextItem = sortedItems[currentItemIndex + 1];
      currentItem = nextItem._id.toString();
    }

    if (isLastItem && !isLastSection && isLastModule) {
      // Get index of the current section
      const currentSectionIndex = sortedSections?.findIndex(
        section => section.sectionId === sectionId,
      );
      // Get next sectionId
      const nextSection = sortedSections?.[currentSectionIndex + 1];
      currentSection = nextSection?.sectionId.toString();

      // Get first itemId in the next section
      const itemsGroup = await this.itemRepo.readItemsGroup(
        nextSection?.itemsGroupId.toString(),
      );
      const firstItem = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      )[0];
      currentItem = firstItem._id.toString();
    }

    if (!isLastItem && !isLastSection && isLastModule) {
      // Get index of the current item
      const currentItemIndex = sortedItems.findIndex(
        item => item._id === itemId,
      );
      // Get next itemId
      const nextItem = sortedItems[currentItemIndex + 1];
      currentItem = nextItem._id.toString();
    }

    if (!isLastItem && isLastSection && isLastModule) {
      // Get index of the current item
      const currentItemIndex = sortedItems.findIndex(
        item => item._id === itemId,
      );
      // Get next itemId
      const nextItem = sortedItems[currentItemIndex + 1];
      currentItem = nextItem._id.toString();
    }

    if (!isLastItem && isLastSection && !isLastModule) {
      // Get index of the current item
      const currentItemIndex = sortedItems.findIndex(
        item => item._id === itemId,
      );
      // Get next itemId
      const nextItem = sortedItems[currentItemIndex + 1];
      currentItem = nextItem._id.toString();
    }

    return {
      completed,
      currentModule,
      currentSection,
      currentItem,
    };
  }

  private isValidWatchTime(watchTime: IWatchTime, item: Item) {
    switch (item.type) {
      case 'VIDEO':
        return true;
        // if (watchTime.startTime && watchTime.endTime && item.itemDetails) {
        //   const videoDetails = item.itemDetails as IVideoDetails;
        //   const videoStartTime = videoDetails.startTime; // a string in HH:MM:SS format
        //   const videoEndTime = videoDetails.endTime; // a string in HH:MM:SS format
        //   const watchStartTime = new Date(watchTime.startTime);
        //   const watchEndTime = new Date(watchTime.endTime);

        //   // Get Time difference in seconds
        //   const timeDiff =
        //     Math.abs(watchEndTime.getTime() - watchStartTime.getTime()) / 1000;

        //   // Get Video duration in seconds
        //   // Convert HH:MM:SS to seconds
        //   const videoEndTimeInSeconds =
        //     parseInt(videoEndTime.split(':')[0]) * 3600 +
        //     parseInt(videoEndTime.split(':')[1]) * 60 +
        //     parseInt(videoEndTime.split(':')[2]);
        //   const videoStartTimeInSeconds =
        //     parseInt(videoStartTime.split(':')[0]) * 3600 +
        //     parseInt(videoStartTime.split(':')[1]) * 60 +
        //     parseInt(videoStartTime.split(':')[2]);

        //   const videoDuration = videoEndTimeInSeconds - videoStartTimeInSeconds;

        //   // Check if the watch time is >= 0.5 * video duration
        //   if (timeDiff >= 0.45 * videoDuration) {
        //     return true;
        //   }
        //   return false;
        // }

        break;

      case 'BLOG':
        return true;
        // if (watchTime.startTime && watchTime.endTime && item.itemDetails) {
        //   const blogDetails = item.itemDetails as IBlogDetails;
        //   const watchStartTime = new Date(watchTime.startTime);
        //   const watchEndTime = new Date(watchTime.endTime);

        //   // Get Time difference in seconds
        //   const timeDiff =
        //     Math.abs(watchEndTime.getTime() - watchStartTime.getTime()) / 1000;

        //   // Check if the watch time is >= 0.5 * estimated read time
        //   if (timeDiff >= 0.6 * blogDetails.estimatedReadTimeInMinutes * 60) {
        //     return true;
        //   }
        //   return false;
        // }
        break;
    }
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

      if (!progress) {
        throw new NotFoundError('Progress not found');
      }

      return Object.assign(new Progress(), progress);
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

      // Start tracking the item
      const result = await this.progressRepository.startItemTracking(
        userId,
        courseId,
        courseVersionId,
        itemId,
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
      const watchItem =
        await this.progressRepository.getWatchTimeById(watchItemId);

      if (!watchItem) {
        throw new NotFoundError('Watch item not found');
      }

      // Stop tracking the item
      const result: IWatchTime = await this.progressRepository.stopItemTracking(
        userId,
        courseId,
        courseVersionId,
        itemId,
        watchItemId,
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
    watchItemId: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      await this.verifyDetails(userId, courseId, courseVersionId);

      await this.verifyProgress(
        userId,
        courseId,
        courseVersionId,
        moduleId,
        sectionId,
        itemId,
      );

      // Get WatchTime of the item
      const watchTime =
        await this.progressRepository.getWatchTimeById(watchItemId);
      if (!watchTime) {
        throw new NotFoundError('Watch time not found');
      }

      // Check if the watch time is greater than the item duration
      const item = await this.itemRepo.readItem(courseVersionId, itemId);
      if (!item) {
        throw new NotFoundError('Item not found in Course Version');
      }
      if (item.type !== 'VIDEO' && item.type !== 'BLOG') {
        // TODO: Handle other item types
        throw new BadRequestError('Item type is not supported');
      }
      if (!item) {
        throw new NotFoundError('Item not found');
      }

      const isValid = this.isValidWatchTime(watchTime, item);
      if (!isValid) {
        throw new BadRequestError(
          'Watch time is not valid, the user did not watch the item long enough',
        );
      }

      // Get the course version
      const courseVersion = await this.courseRepo.readVersion(courseVersionId);

      // Get the new progress
      const newProgress = await this.getNewProgress(
        courseVersion,
        moduleId,
        sectionId,
        itemId,
      );
      if (!newProgress) {
        throw new InternalServerError('New progress could not be calculated');
      }
      // Update the progress
      const updatedProgress = await this.progressRepository.updateProgress(
        userId,
        courseId,
        courseVersionId,
        newProgress,
      );

      if (!updatedProgress) {
        throw new InternalServerError('Progress could not be updated');
      }
    });
  }

  // Admin Level Endpoint
  async resetCourseProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      await this.verifyDetails(userId, courseId, courseVersionId);

      // Get Course Version
      const courseVersion = await this.courseRepo.readVersion(courseVersionId);

      const updatedProgress: IProgress = await this.initializeProgress(
        userId,
        courseId,
        courseVersionId,
        courseVersion,
      );

      // Set progress
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
      );
      if (!result) {
        throw new InternalServerError('Progress could not be reset');
      }
    });
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
}

export {ProgressService};
