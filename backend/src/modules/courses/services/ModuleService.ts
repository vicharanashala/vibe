import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {CourseRepository} from '../../../shared/database/providers/mongo/repositories/CourseRepository';
import {
  CreateModuleBody,
  UpdateModuleBody,
  MoveModuleBody,
} from '../classes/validators/ModuleValidators';
import {Module} from '../classes/transformers/Module';
import {ReadConcern, ReadPreference, WriteConcern} from 'mongodb';
import {NotFoundError, InternalServerError} from 'routing-controllers';
import {calculateNewOrder} from '../utils/calculateNewOrder';
import {ICourseVersion} from 'shared/interfaces/Models';
import {BaseService} from 'shared/classes/BaseService';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import TYPES from '../types';
import GLOBAL_TYPES from '../../../types';
@injectable()
export class ModuleService extends BaseService {
  constructor(
    @inject(TYPES.CourseRepo)
    private readonly courseRepo: CourseRepository,

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
      const version = await this.courseRepo.readVersion(versionId, session);
      if (!version) throw new NotFoundError(`Version ${versionId} not found.`);

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
      const version = await this.courseRepo.readVersion(versionId, session);
      const module = version.modules.find(m => m.moduleId === moduleId);
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
      const {afterModuleId, beforeModuleId} = body;
      if (!afterModuleId && !beforeModuleId) {
        throw new InternalServerError(
          'Either afterModuleId or beforeModuleId is required',
        );
      }
      const version = await this.courseRepo.readVersion(versionId, session);
      const sorted = version.modules
        .slice()
        .sort((a, b) => a.order.localeCompare(b.order));
      const module = version.modules.find(m => m.moduleId === moduleId);
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
      const deleted = await this.courseRepo.deleteModule(
        versionId,
        moduleId,
        session,
      );
      if (!deleted)
        throw new InternalServerError(`Failed to delete module ${moduleId}`);
    });
  }
}
