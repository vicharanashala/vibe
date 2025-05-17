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
  ModuleDataResponse,
  ModuleNotFoundErrorResponse,
  ModuleDeletedResponse,
} from '../classes/validators/ModuleValidators';
import {calculateNewOrder} from '../utils/calculateNewOrder';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';

@OpenAPI({
  tags: ['Course Modules'],
})
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

  @Authorized(['admin'])
  @Post('/versions/:versionId/modules')
  @HttpCode(201)
  @ResponseSchema(ModuleDataResponse, {
    description: 'Module created successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ModuleNotFoundErrorResponse, {
    description: 'Module not found',
    statusCode: 404,
  })
  @OpenAPI({
    summary: 'Create Module',
    description:
      'Creates a new module in the specified course version with the provided details.',
  })
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
      if (error instanceof NotFoundError) {
        throw new HttpError(404, error.message);
      }
      throw new InternalServerError(error.message);
    }
  }

  @Authorized(['admin'])
  @Put('/versions/:versionId/modules/:moduleId')
  @ResponseSchema(ModuleDataResponse, {
    description: 'Module updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ModuleNotFoundErrorResponse, {
    description: 'Module not found',
    statusCode: 404,
  })
  @OpenAPI({
    summary: 'Update Module',
    description:
      "Updates an existing module's name or description within a course version.",
  })
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

  @Authorized(['admin'])
  @Put('/versions/:versionId/modules/:moduleId/move')
  @ResponseSchema(ModuleDataResponse, {
    description: 'Module moved successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ModuleNotFoundErrorResponse, {
    description: 'Module not found',
    statusCode: 404,
  })
  @OpenAPI({
    summary: 'Move Module',
    description:
      'Reorders a module within its course version by placing it before or after another module.',
  })
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
      if (error instanceof ReadError) {
        throw new HttpError(404, error.message);
      }
      if (error instanceof UpdateError) {
        throw new BadRequestError(error.message);
      }
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
    }
  }

  @Authorized(['admin'])
  @Delete('/versions/:versionId/modules/:moduleId')
  @ResponseSchema(ModuleDeletedResponse, {
    description: 'Module deleted successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ModuleNotFoundErrorResponse, {
    description: 'Module not found',
    statusCode: 404,
  })
  @OpenAPI({
    summary: 'Delete Module',
    description: 'Permanently removes a module from a course version.',
  })
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
