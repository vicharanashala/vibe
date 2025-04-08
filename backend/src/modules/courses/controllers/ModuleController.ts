import {instanceToPlain} from 'class-transformer';
import 'reflect-metadata';
import {
  Authorized,
  Body,
  InternalServerError,
  JsonController,
  Params,
  Post,
  Put,
} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {ReadError, UpdateError} from 'shared/errors/errors';
import {HTTPError} from 'shared/middleware/ErrorHandler';
import {Inject, Service} from 'typedi';
import {Module} from '../classes/transformers/Module';
import {
  CreateModuleParams,
  CreateModuleBody,
  MoveModuleBody,
  MoveModuleParams,
  UpdateModuleBody,
  UpdateModuleParams,
} from '../classes/validators/ModuleValidators';
import {calculateNewOrder} from '../utils/calculateNewOrder';

/**
 *
 * @category Courses/Controllers
 */
@JsonController('/courses')
@Service()
export class ModuleController {
  constructor(
    @Inject('NewCourseRepo') private readonly courseRepo: CourseRepository,
  ) {
    if (!this.courseRepo) {
      throw new Error('CourseRepository is not properly injected');
    }
  }
  @Authorized(['admin'])
  @Post('/versions/:versionId/modules')
  async create(
    @Params() params: CreateModuleParams,
    @Body() body: CreateModuleBody,
  ) {
    try {
      const {versionId} = params;
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Create Module
      const module = new Module(body, version.modules);

      //Add Module to Version
      version.modules.push(module);

      //Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        params.versionId,
        version,
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      throw new InternalServerError(error.message);
    }
  }

  @Authorized(['admin'])
  @Put('/versions/:versionId/modules/:moduleId')
  async update(
    @Params() params: UpdateModuleParams,
    @Body() body: UpdateModuleBody,
  ) {
    try {
      const {versionId, moduleId} = params;
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);
      if (!module) throw new ReadError('Module not found');

      //Update Module
      Object.assign(module, body.name ? {name: body.name} : {});
      Object.assign(
        module,
        body.description ? {description: body.description} : {},
      );
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof ReadError) {
        throw new HTTPError(404, error);
      }
    }
  }

  @Authorized(['admin'])
  @Put('/versions/:versionId/modules/:moduleId/move')
  async move(@Params() params: MoveModuleParams, @Body() body: MoveModuleBody) {
    const {versionId, moduleId} = params;
    try {
      const {afterModuleId, beforeModuleId} = body;

      if (!afterModuleId && !beforeModuleId) {
        throw new UpdateError(
          'Either afterModuleId or beforeModuleId is required',
        );
      }

      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Sort Modules based on order
      const sortedModules = version.modules.sort((a, b) =>
        a.order.localeCompare(b.order),
      );

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);
      if (!module) throw new ReadError('Module not found');

      //Calculate New Order
      const newOrder = calculateNewOrder(
        sortedModules,
        'moduleId',
        afterModuleId,
        beforeModuleId,
      );

      //Update Module Order
      module.order = newOrder;
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }
}
