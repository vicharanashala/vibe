import {calculateNewOrder} from '#courses/utils/calculateNewOrder.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {ObjectId, UpdateResult} from 'mongodb';
import {
  NotFoundError,
  InternalServerError,
  BadRequestError,
  ForbiddenError,
} from 'routing-controllers';
import {COURSES_TYPES} from '#courses/types.js';
import {ItemsGroup} from '#courses/classes/transformers/Item.js';
import {Section} from '#courses/classes/transformers/Section.js';
import {CreateSectionBody} from '#courses/classes/validators/SectionValidators.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {ICourseVersion} from '#root/shared/interfaces/models.js';
import {EnrollmentRepository, ProgressRepository} from '#root/shared/index.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
@injectable()
export class SectionService extends BaseService {
  constructor(
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(GLOBAL_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepo: ProgressRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  async createSection(
    versionId: string,
    moduleId: string,
    body: CreateSectionBody,
  ): Promise<ICourseVersion> {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and cannot create sections.");
        }
      const version = await this.courseRepo.readVersion(versionId, session);

      //Find Module
      const module = version.modules.find(
        m => m.moduleId?.toString() === moduleId,
      );
      if (!module) {
        throw new NotFoundError('Module not found');
      }

      // Prevent creation if the previous section is empty
      const sections = module.sections.filter(s => !s.isDeleted);
      if (sections.length > 0) {
        const lastSection = sections[sections.length - 1];
        //fetch items group
        const itemsGroup = await this.itemRepo.readItemsGroup(
          lastSection.itemsGroupId.toString(),
          session,
        );
        // if no items in the items group, prevent creation
        if (itemsGroup.items.length === 0) {
          throw new BadRequestError(
            'cannot create a new section. The previous section has no items.',
          );
        }
      }

      //Create Section
      const section = new Section(body, module.sections);

      //Create ItemsGroup
      let itemsGroup = new ItemsGroup(section.sectionId);
      itemsGroup = await this.itemRepo.createItemsGroup(itemsGroup, session);

      //Assign ItemsGroup to Section
      section.itemsGroupId = new ObjectId(itemsGroup._id);

      //Add Section to Module
      module.sections.push(section);

      //Update Module Update Date
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        {
          ...version,
          courseId: new ObjectId(version.courseId),
          modules: (version.modules || []).map(module => ({
            ...module,
            moduleId: new ObjectId(module.moduleId),
            sections: (module.sections || []).map(section => ({
              ...section,
              sectionId: new ObjectId(section.sectionId),
              itemsGroupId: new ObjectId(section.itemsGroupId),
            })),
          })),
        },
        session,
      );
      if (!updatedVersion) {
        throw new InternalServerError('Failed to update course version');
      }

      return updatedVersion;
    });
  }

  async updateSection(
    versionId: string,
    moduleId: string,
    sectionId: string,
    body: CreateSectionBody,
  ): Promise<ICourseVersion> {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and cannot be modified.");
        }
      const version = await this.courseRepo.readVersion(versionId, session);

      //Find Module
      const module = version.modules.find(
        m => m.moduleId?.toString() === moduleId,
      );
      if (!module) throw new InternalServerError('Module not found');

      //Find Section
      const section = module.sections.find(
        s => s.sectionId?.toString() === sectionId,
      );
      if (!section) throw new InternalServerError('Section not found');

      //Update Section
      Object.assign(section, body.name ? {name: body.name} : {});
      Object.assign(
        section,
        body.description ? {description: body.description} : {},
      );
      section.updatedAt = new Date();

      //Update Module Update Date
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );
      if (!updatedVersion) {
        throw new InternalServerError('Failed to update Section');
      }
      return updatedVersion;
    });
  }

  async moveSection(
    versionId: string,
    moduleId: string,
    sectionId: string,
    afterSectionId: string,
    beforeSectionId: string,
  ): Promise<ICourseVersion> {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and cannot be modified.");
        }
      const version = await this.courseRepo.readVersion(versionId, session);

      //Find Module
      const module = version.modules.find(
        m => m.moduleId?.toString() === moduleId,
      );

      //Find Section
      const section = module.sections.find(
        s => s.sectionId?.toString() === sectionId,
      );

      //Sort Sections based on order
      const sortedSections = module.sections.sort((a, b) =>
        a.order.localeCompare(b.order),
      );

      //Calculate New Order
      const newOrder = calculateNewOrder(
        sortedSections,
        'sectionId',
        afterSectionId,
        beforeSectionId,
      );

      //Update Section Order
      section.order = newOrder;
      section.updatedAt = new Date();

      //Sort Sections based on order
      module.sections.sort((a, b) => a.order.localeCompare(b.order));

      //Update Module Update Date
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );

      if (!updatedVersion) {
        throw new InternalServerError('Failed to move Section');
      }

      return updatedVersion;
    });
  }

  async deleteSection(
    versionId: string,
    moduleId: string,
    sectionId: string,
  ): Promise<UpdateResult | null> {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and sections cannot be deleted");
        }
      const readCourseVersion = await this.courseRepo.readVersion(
        versionId,
        session,
      );

      if (!readCourseVersion) {
        throw new NotFoundError('Course Version not found');
      }

      const modules = readCourseVersion.modules;
      if (!modules) {
        throw new NotFoundError('../../../modules not found');
      }

      const deleteResult = await this.courseRepo.deleteSection(
        versionId,
        moduleId,
        sectionId,
        readCourseVersion,
        session,
      );

      if (!deleteResult) {
        throw new NotFoundError('Section not found');
      }

      const updatedVersion = await this.courseRepo.readVersion(
        versionId,
        session,
      );

      if (!updatedVersion) {
        throw new NotFoundError('Updated version not found');
      }

      const {totalItems, itemCounts} =
        await this.itemRepo.calculateItemCountsForVersion(
          updatedVersion._id.toString(),
          session,
        );

      updatedVersion.totalItems = totalItems;
      updatedVersion.itemCounts = itemCounts;
      updatedVersion.updatedAt = new Date();

      await this.courseRepo.updateVersion(
        updatedVersion._id.toString(),
        updatedVersion,
        session,
      );

      return deleteResult;
    });
  }

  async toggleSectionVisibility(
    versionId: string,
    moduleId: string,
    sectionId: string,
    hide: boolean,
  ): Promise<ICourseVersion> {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and cannot be modified.");
        }
      const version = await this.courseRepo.readVersion(versionId, session);

      // Find Module
      const module = version.modules.find(
        m => m.moduleId.toString() === moduleId,
      );
      if (!module) throw new InternalServerError('Module not found');

      // Find Section
      const section = module.sections.find(
        s => s.sectionId.toString() === sectionId,
      );
      if (!section) throw new InternalServerError('Section not found');

      section.isHidden = hide;
      section.updatedAt = new Date();

      // Update Module Update Date
      module.updatedAt = new Date();

      // Hide all items in the section
      const itemsGroupId = section.itemsGroupId.toString();
      const itemsGroup = await this.itemRepo.readItemsGroup(
        itemsGroupId,
        session,
      );
      if (itemsGroup) {
        itemsGroup.isHidden = hide;
        itemsGroup.items.forEach(item => {
          item.isHidden = hide;
        });
        await this.itemRepo.updateItemsGroup(itemsGroupId, itemsGroup, session);
      }

      await this.enrollmentRepo.setWatchTimeVisibility(
        itemsGroup.items.map(item => item._id.toString()),
        hide,
        session,
      );

      if (hide == true) {
        // Update currentSection for progress to next non-hidden section.
        const sections = module.sections;
        const currentIndex = sections.findIndex(s => s.sectionId === sectionId);
        let nextSection = null;
        for (let i = currentIndex + 1; i < sections.length; i++) {
          if (!sections[i].isHidden) {
            nextSection = sections[i];
            break;
          }
        }

        // fallback backward
        if (!nextSection) {
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (!sections[i].isHidden) {
              nextSection = sections[i];
              break;
            }
          }
        }

        if (nextSection) {
          // first item of the next section
          const nextItemsGroup = await this.itemRepo.readItemsGroup(
            nextSection.itemsGroupId.toString(),
            session,
          );
          if (nextItemsGroup && nextItemsGroup.items.length > 0) {
            const nextItemId = nextItemsGroup.items[0]._id.toString();
            await this.progressRepo.updateProgressBySectionId(
              section.sectionId.toString(),
              {currentSection: nextSection.sectionId, currentItem: nextItemId},
              session,
            );
          }
        }
      }

      // Update Version Update Date
      const {totalItems, itemCounts} =
        await this.itemRepo.calculateItemCountsForVersion(
          version._id.toString(),
          session,
        );

      version.totalItems = totalItems;
      version.itemCounts = {...itemCounts};

      version.updatedAt = new Date();
      // Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );
      if (!updatedVersion) {
        throw new InternalServerError('Failed to update Section');
      }

      return updatedVersion;
    });
  }
}
