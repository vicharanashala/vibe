import {instanceToPlain} from 'class-transformer';
import 'reflect-metadata';
import {
  Authorized,
  BadRequestError,
  Body,
  Delete,
  HttpCode,
  HttpError,
  InternalServerError,
  JsonController,
  NotFoundError,
  Params,
  Post,
  Put,
} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {DeleteError, ReadError, UpdateError} from 'shared/errors/errors';
import {Inject, Service} from 'typedi';
import {Module} from '../classes/transformers/Module';
import {
  CreateModuleParams,
  CreateModuleBody,
  MoveModuleBody,
  MoveModuleParams,
  UpdateModuleBody,
  UpdateModuleParams,
  DeleteModuleParams,
} from '../classes/validators/ModuleValidators';
import {calculateNewOrder} from '../utils/calculateNewOrder';

/**
 * Controller for managing modules within a course version.
 * Handles creation, updating, and reordering of modules.
 *
 * @category Courses/Controllers
 * @categoryDescription
 * Provides endpoints for adding, modifying, and reordering course modules.
 * Modules are nested under specific versions and define core content units.
 */

@JsonController('/courses')
@Service()
export class ModuleController {
  constructor(
    @Inject('CourseRepo') private readonly courseRepo: CourseRepository,
  ) {
    if (!this.courseRepo) {
      throw new Error('CourseRepository is not properly injected');
    }
  }

  /**
   * Create a new module under a specific course version.
   *
   * @param params - Route parameters including the course version ID.
   * @param body - Payload containing module name, description, etc.
   * @returns The updated course version with the new module.
   *
   * @throws InternalServerError on any failure during module creation.
   *
   * @category Courses/Controllers
   */

  @Authorized(['admin'])
  @Post('/versions/:versionId/modules')
  @HttpCode(201)
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

  /**
   * Update an existing module's name or description.
   *
   * @param params - Route parameters including versionId and moduleId.
   * @param body - Fields to update such as name and/or description.
   * @returns The updated course version.
   *
   * @throws HTTPError(404) if the module is not found.
   *
   * @category Courses/Controllers
   */

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
        throw new HttpError(404, error.message);
      }
    }
  }

  /**
   * Reorder a module within its course version.
   * The new position is determined using beforeModuleId or afterModuleId.
   *
   * @param params - Route parameters including versionId and moduleId.
   * @param body - Positioning details: beforeModuleId or afterModuleId.
   * @returns The updated course version with modules in new order.
   *
   * @throws UpdateError if neither beforeModuleId nor afterModuleId is provided.
   * @throws HTTPError(500) for other internal errors.
   *
   * @category Courses/Controllers
   */

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
        throw new HttpError(500, error.message);
      }
    }
  }

  /**
   * Delete a module from a specific course version.
   *
   * @param params - Parameters including version ID and module ID
   * @returns The deleted module object
   *
   * @throws BadRequestError if version ID or module ID is missing
   * @throws HttpError(404) if the module is not found
   * @throws HttpError(500) for delete errors
   *
   * @category Courses/Controllers
   */
  @Delete('/versions/:versionId/modules/:moduleId')
  async delete(@Params() params: DeleteModuleParams) {
    const {versionId, moduleId} = params;
    if (!versionId || !moduleId) {
      throw new BadRequestError('Version ID and Module ID are required');
    }
    try {
      const isDeleted = await this.courseRepo.deleteModule(versionId, moduleId);

      if (!isDeleted) {
        throw new DeleteError('Internal server error');
      }
      return {
        message: `Module with the ID ${moduleId} in Version ${versionId} has been deleted successfully.`,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new HttpError(404, error.message);
      }
      if (error instanceof DeleteError) {
        throw new HttpError(500, error.message);
      }
      throw new HttpError(500, error.message);
    }
  }
}
