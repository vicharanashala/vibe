import 'reflect-metadata';
import {
  Authorized,
  JsonController,
  Params,
  Body,
  Post,
  Put,
  Delete,
  HttpCode,
} from 'routing-controllers';
import {Service, Inject} from 'typedi';
import {instanceToPlain} from 'class-transformer';
import {ModuleService} from '../services/ModuleService';
import {
  CreateModuleParams,
  CreateModuleBody,
  UpdateModuleParams,
  UpdateModuleBody,
  MoveModuleParams,
  MoveModuleBody,
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
    @Inject(() => ModuleService)
    private service: ModuleService,
  ) {}

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
    const updated = await this.service.createModule(params.versionId, body);
    return {version: instanceToPlain(updated)};
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
    const updated = await this.service.updateModule(
      params.versionId,
      params.moduleId,
      body,
    );
    return {version: instanceToPlain(updated)};
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
    const updated = await this.service.moveModule(
      params.versionId,
      params.moduleId,
      body,
    );
    return {version: instanceToPlain(updated)};
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
    await this.service.deleteModule(params.versionId, params.moduleId);
    return {
      message: `Module ${params.moduleId} deleted in version ${params.versionId}`,
    };
  }
}
