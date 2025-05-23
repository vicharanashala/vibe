import {
  DeleteResult,
  ObjectId,
  ReadConcern,
  ReadPreference,
  UpdateResult,
  WriteConcern,
} from 'mongodb';
import {ICourseRepository} from 'shared/database';
import {IItemRepository} from 'shared/database/';
import {Inject, Service} from 'typedi';
import {CourseVersion, ItemsGroup, Section} from '../classes/transformers';
import {CreateSectionBody, MoveSectionBody} from '../classes/validators';
import {NotFoundError} from 'routing-controllers';
import {ReadError, UpdateError} from 'shared/errors/errors';
import {ICourseVersion} from 'shared/interfaces/Models';
import {calculateNewOrder} from '../utils/calculateNewOrder';
@Service()
export class SectionService {
  constructor(
    @Inject('ItemRepo')
    private readonly itemRepo: IItemRepository,
    @Inject('CourseRepo')
    private readonly courseRepo: ICourseRepository,
  ) {}

  private readonly transactionOptions = {
    readPreference: ReadPreference.PRIMARY,
    readConcern: new ReadConcern('majority'),
    writeConcern: new WriteConcern('majority'),
  };

  async createSection(
    versionId: string,
    moduleId: string,
    body: CreateSectionBody,
  ): Promise<ICourseVersion> {
    const session = (await this.courseRepo.getDBClient()).startSession();

    try {
      await session.startTransaction(this.transactionOptions);

      //Fetch Version
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

      await session.commitTransaction();
      return updatedVersion;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async updateSection(
    versionId: string,
    moduleId: string,
    sectionId: string,
    body: CreateSectionBody,
  ): Promise<ICourseVersion> {
    const session = (await this.courseRepo.getDBClient()).startSession();

    try {
      await session.startTransaction(this.transactionOptions);

      //Fetch Version
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
      await session.commitTransaction();
      return updatedVersion;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async moveSection(
    versionId: string,
    moduleId: string,
    sectionId: string,
    afterSectionId: string,
    beforeSectionId: string,
  ): Promise<ICourseVersion> {
    const session = (await this.courseRepo.getDBClient()).startSession();

    try {
      await session.startTransaction(this.transactionOptions);

      //Fetch Version
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
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async deleteSection(
    versionId: string,
    moduleId: string,
    sectionId: string,
  ): Promise<UpdateResult | null> {
    const session = (await this.courseRepo.getDBClient()).startSession();

    try {
      await session.startTransaction(this.transactionOptions);

      const readCourseVersion = await this.courseRepo.readVersion(
        versionId,
        session,
      );

      if (!readCourseVersion) {
        throw new NotFoundError('Course Version not found');
      }

      const modules = readCourseVersion.modules;
      if (!modules) {
        throw new NotFoundError('Modules not found');
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

      await session.commitTransaction();
      return deleteResult;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
