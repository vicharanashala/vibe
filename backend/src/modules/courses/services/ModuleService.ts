import 'reflect-metadata';
import {Service, Inject} from 'typedi';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {
  CreateModuleBody,
  UpdateModuleBody,
  MoveModuleBody,
} from '../classes/validators/ModuleValidators';
import {Module} from '../classes/transformers/Module';
import {ReadConcern, ReadPreference, WriteConcern} from 'mongodb';
import {NotFoundError, InternalServerError} from 'routing-controllers';
import {calculateNewOrder} from '../utils/calculateNewOrder';

@Service()
export class ModuleService {
  constructor(
    @Inject('CourseRepo')
    private readonly courseRepo: CourseRepository,
  ) {}

  public async createModule(versionId: string, body: CreateModuleBody) {
    const client = await this.courseRepo.getDBClient();
    const session = client.startSession();
    const txOptions = {
      readPreference: ReadPreference.primary,
      readConcern: new ReadConcern('snapshot'),
      writeConcern: new WriteConcern('majority'),
    };

    try {
      await session.startTransaction(txOptions);
      const version = await this.courseRepo.readVersion(versionId, session);
      if (!version) throw new NotFoundError(`Version ${versionId} not found.`);

      const module = new Module(body, version.modules);
      version.modules.push(module);
      version.updatedAt = new Date();

      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      await session.commitTransaction();
      return updatedVersion;
    } catch (error) {
      await session.abortTransaction();
      throw new InternalServerError(error.message);
    } finally {
      await session.endSession();
    }
  }

  public async updateModule(
    versionId: string,
    moduleId: string,
    body: UpdateModuleBody,
  ) {
    const client = await this.courseRepo.getDBClient();
    const session = client.startSession();
    const txOptions = {
      readPreference: ReadPreference.primary,
      readConcern: new ReadConcern('snapshot'),
      writeConcern: new WriteConcern('majority'),
    };

    try {
      await session.startTransaction(txOptions);
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
      );

      await session.commitTransaction();
      return updatedVersion;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof NotFoundError) throw error;
      throw new InternalServerError(error.message);
    } finally {
      await session.endSession();
    }
  }

  public async moveModule(
    versionId: string,
    moduleId: string,
    body: MoveModuleBody,
  ) {
    const {afterModuleId, beforeModuleId} = body;
    if (!afterModuleId && !beforeModuleId) {
      throw new InternalServerError(
        'Either afterModuleId or beforeModuleId is required',
      );
    }

    const client = await this.courseRepo.getDBClient();
    const session = client.startSession();
    const txOptions = {
      readPreference: ReadPreference.primary,
      readConcern: new ReadConcern('snapshot'),
      writeConcern: new WriteConcern('majority'),
    };

    try {
      await session.startTransaction(txOptions);
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
      );

      await session.commitTransaction();
      return updatedVersion;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof NotFoundError) throw error;
      throw new InternalServerError(error.message);
    } finally {
      await session.endSession();
    }
  }

  public async deleteModule(versionId: string, moduleId: string) {
    const client = await this.courseRepo.getDBClient();
    const session = client.startSession();
    const txOptions = {
      readPreference: ReadPreference.primary,
      readConcern: new ReadConcern('snapshot'),
      writeConcern: new WriteConcern('majority'),
    };

    try {
      await session.startTransaction(txOptions);
      const deleted = await this.courseRepo.deleteModule(versionId, moduleId);
      if (!deleted)
        throw new InternalServerError(`Failed to delete module ${moduleId}`);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof NotFoundError) throw error;
      throw new InternalServerError(error.message);
    } finally {
      await session.endSession();
    }
  }
}
