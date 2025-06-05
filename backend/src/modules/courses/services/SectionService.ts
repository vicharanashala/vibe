import {
  DeleteResult,
  ObjectId,
  ReadConcern,
  ReadPreference,
  UpdateResult,
  WriteConcern,
} from 'mongodb';
import {ICourseRepository} from '../../../shared/database';
import {IItemRepository} from '../../../shared/database/';
import {inject, injectable} from 'inversify';
import {CourseVersion, ItemsGroup, Section} from '../classes/transformers';
import {CreateSectionBody, MoveSectionBody} from '../classes/validators';
import {NotFoundError} from 'routing-controllers';
import {ReadError, UpdateError} from '../../../shared/errors/errors';
import {ICourseVersion} from '../../../shared/interfaces/Models';
import {calculateNewOrder} from '../utils/calculateNewOrder';
import {BaseService} from '../../../shared/classes/BaseService';
import {MongoDatabase} from '../../../shared/database/providers/MongoDatabaseProvider';
import TYPES from '../types';
import GLOBAL_TYPES from '../../../types';

@injectable()
export class SectionService extends BaseService {
  constructor(
    @inject(TYPES.ItemRepo)
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
        throw new UpdateError('Failed to update course version');
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
      if (!module) throw new ReadError('Module not found');

      //Find Section
      const section = module.sections.find(s => s.sectionId === sectionId);
      if (!section) throw new ReadError('Section not found');

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
        throw new UpdateError('Failed to update Section');
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
        throw new UpdateError('Failed to move Section');
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
