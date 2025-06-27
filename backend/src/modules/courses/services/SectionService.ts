import {calculateNewOrder} from '#courses/utils/calculateNewOrder.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {UpdateResult} from 'mongodb';
import {NotFoundError, InternalServerError} from 'routing-controllers';
import {COURSES_TYPES} from '#courses/types.js';
import {ItemsGroup} from '#courses/classes/transformers/Item.js';
import {Section} from '#courses/classes/transformers/Section.js';
import {CreateSectionBody} from '#courses/classes/validators/SectionValidators.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {ICourseVersion} from '#root/shared/interfaces/models.js';
@injectable()
export class SectionService extends BaseService {
  constructor(
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
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
      const version = await this.courseRepo.readVersion(versionId, session);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);
      if (!module) {
        throw new NotFoundError('Module not found');
      }

      //Create Section
      const section = new Section(body, module.sections);

      //Create ItemsGroup
      let itemsGroup = new ItemsGroup(section.sectionId);
      itemsGroup = await this.itemRepo.createItemsGroup(itemsGroup, session);

      //Assign ItemsGroup to Section
      section.itemsGroupId = itemsGroup._id;

      //Add Section to Module
      module.sections.push(section);

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
      const version = await this.courseRepo.readVersion(versionId, session);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);
      if (!module) throw new InternalServerError('Module not found');

      //Find Section
      const section = module.sections.find(s => s.sectionId === sectionId);
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
      const version = await this.courseRepo.readVersion(versionId, session);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find(s => s.sectionId === sectionId);

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

      return deleteResult;
    });
  }
}
