import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import {
  CreateModuleBody,
  UpdateModuleBody,
  MoveModuleBody,
} from '../classes/validators/ModuleValidators.js';
import { Module } from '../classes/transformers/Module.js';
import {
  NotFoundError,
  InternalServerError,
  BadRequestError,
  ForbiddenError,
} from 'routing-controllers';
import { calculateNewOrder } from '../utils/calculateNewOrder.js';
import { ICourseVersion } from '#root/shared/interfaces/models.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { GLOBAL_TYPES } from '../../../types.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { COURSES_TYPES } from '../types.js';
import {
  ICourseRepository,
  IItemRepository,
} from '#root/shared/database/interfaces/index.js';
import { EnrollmentRepository } from '#root/shared/index.js';
import { ObjectId } from 'mongodb';

@injectable()
export class ModuleService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(GLOBAL_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,

    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  public async createModule(
    versionId: string,
    body: CreateModuleBody,
  ): Promise<ICourseVersion> {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
            
      if(versionStatus==="archived"){
        throw new ForbiddenError("This course version is archived and modules cannot be created");
      }
      const version = await this.courseRepo.readVersion(versionId, session);
      if (!version) throw new NotFoundError(`Version ${versionId} not found.`);

      // Prevent creation if there is empty section at last
      const modules = version.modules.filter(m => !m.isDeleted);

      if (modules.length > 0) {
        const lastModule = modules[modules.length - 1];

        const sections = lastModule.sections.filter(s => !s.isDeleted);

        // No sections at all
        if (sections.length === 0) {
          throw new BadRequestError(
            'Cannot create a new module. The previous module has no sections.',
          );
        }

        const lastSection = sections[sections.length - 1];

        // Section exists but no items group linked
        if (!lastSection.itemsGroupId) {
          throw new BadRequestError(
            'Cannot create a new module. The last section of the previous module is incomplete.',
          );
        }

        // Fetch items group
        const itemsGroup = await this.itemRepo.readItemsGroup(
          lastSection.itemsGroupId.toString(),
          session,
        );

        // Items group missing
        if (!itemsGroup) {
          throw new BadRequestError(
            'Cannot create a new module. The last section has no valid items group.',
          );
        }

        // Items group exists but empty
        if (!itemsGroup.items || itemsGroup.items.length === 0) {
          throw new BadRequestError(
            'Cannot create a new module. The last section contains no items.',
          );
        }
      }

      const module = new Module(body, version.modules);
      version.modules.push(module);
      version.updatedAt = new Date();

      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );

      return updatedVersion;
    });
  }

  public async updateModule(
    versionId: string,
    moduleId: string,
    body: UpdateModuleBody,
  ) {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and cannot be updated.");
        }
      const version = await this.courseRepo.readVersion(versionId, session);
      const module = version.modules.find(
        m => m.moduleId?.toString() === moduleId,
      );
      if (!module) throw new NotFoundError(`Module ${moduleId} not found.`);

      if (body.name) module.name = body.name;
      if (body.description) module.description = body.description;
      module.updatedAt = new Date();
      version.updatedAt = new Date();

      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );

      return updatedVersion;
    });
  }

  public async moveModule(
    versionId: string,
    moduleId: string,
    body: MoveModuleBody,
  ) {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);

      if(versionStatus==="archived"){
        throw new ForbiddenError("This course version is archived and cannot be modified.");
      }
      const { afterModuleId, beforeModuleId } = body;
      if (!afterModuleId && !beforeModuleId) {
        throw new BadRequestError(
          'Either afterModuleId or beforeModuleId is required',
        );
      }
      const version = await this.courseRepo.readVersion(versionId, session);
      const sorted = version.modules
        .slice()
        .sort((a, b) => a.order.localeCompare(b.order));
      const module = version.modules.find(
        m => m.moduleId?.toString() === moduleId,
      );
      if (!module) throw new NotFoundError(`Module ${moduleId} not found.`);

      module.order = calculateNewOrder(
        sorted,
        'moduleId',
        afterModuleId,
        beforeModuleId,
      );
      module.updatedAt = new Date();
      version.updatedAt = new Date();

      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );
      return updatedVersion;
    });
  }

  public async deleteModule(versionId: string, moduleId: string) {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and modules cannot be deleted.");
        }
      const deleted = await this.courseRepo.deleteModule(
        versionId,
        moduleId,
        session,
      );
      if (!deleted)
        throw new InternalServerError(`Failed to delete module ${moduleId}`);

      // update total item count
      const version = await this.courseRepo.readVersion(versionId, session);
      if (!version) throw new NotFoundError(`Version ${versionId} not found.`);
      // version.totalItems = await this.itemRepo.CalculateTotalItemsCount(
      //   version.courseId.toString(),
      //   version._id.toString(),
      //   session,
      // );

      const { totalItems, itemCounts } =
        await this.itemRepo.calculateItemCountsForVersion(
          version._id.toString(),
          session
        );

      version.totalItems = totalItems;
      version.itemCounts = itemCounts;
      version.updatedAt = new Date();

      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );

      if (!updatedVersion) {
        throw new InternalServerError(
          `Failed to update version ${versionId} after module deletion`,
        );
      }
    });
  }

  public async readModule(versionId: string, moduleId: string) {
    return this._withTransaction(async session => {
      const version = await this.courseRepo.readVersion(versionId, session);
      const module = version.modules.find(
        m => m.moduleId.toString() === moduleId,
      );
      if (!module) throw new NotFoundError(`Module ${moduleId} not found.`);
      return module;
    });
  }

  public async toggleModuleVisibility(
    versionId: string,
    moduleId: string,
    isHidden: boolean,
  ) {
    return this._withTransaction(async session => {
      const versionStatus=await this.courseRepo.getCourseVersionStatus(versionId,session);
      
      if(versionStatus==="archived"){
          throw new ForbiddenError("This course version is archived and cannot be modified.");
        }
      const version = await this.courseRepo.readVersion(versionId, session);
      const module = version.modules.find(
        m => m.moduleId.toString() === moduleId,
      );
      if (!module) throw new NotFoundError(`Module ${moduleId} not found.`);

      let itemGroupIds = [];

      module.sections.forEach(section => {
        section.isHidden = isHidden;
        section.updatedAt = new Date();
        itemGroupIds.push(section.itemsGroupId && section.itemsGroupId);
      });

      itemGroupIds = itemGroupIds.filter(id => id);

      const itemGroups = await this.itemRepo.getItemGroupsByIds(
        itemGroupIds,
        session,
      );

      itemGroups.map(async group => {
        group._id = new ObjectId(group._id);
        group.isHidden = isHidden;
        group.items = group.items.map(item => {
          item.isHidden = isHidden;
          return item;
        });
      });

      module.isHidden = isHidden;
      module.updatedAt = new Date();
      version.updatedAt = new Date();

      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );

      if (itemGroups.length > 0) {
        await this.itemRepo.updateItemsGroupsBulk(itemGroups, session);
      }
      const itemIds = itemGroups.reduce((acc, group) => {
        const ids = group.items.map(item => item._id);
        return acc.concat(ids);
      }, []);

      if (itemIds.length > 0) {
        await this.enrollmentRepo.setWatchTimeVisibility(
          itemIds,
          isHidden,
          session,
        );
      }

       const { totalItems, itemCounts } =
        await this.itemRepo.calculateItemCountsForVersion(
          version._id.toString(),
          session
        );

        version.totalItems = totalItems;
        version.itemCounts = itemCounts;

      const updatedVersionWithCounts = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );

      return updatedVersionWithCounts;
    });
  }
}
