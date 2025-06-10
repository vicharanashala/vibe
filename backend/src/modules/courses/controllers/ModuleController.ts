import {
  ModuleDataResponse,
  ModuleNotFoundErrorResponse,
  CreateModuleParams,
  CreateModuleBody,
  UpdateModuleParams,
  UpdateModuleBody,
  MoveModuleParams,
  MoveModuleBody,
  ModuleDeletedResponse,
  DeleteModuleParams,
} from '#courses/classes/index.js';
import {ModuleService} from '#courses/services/ModuleService.js';
import {BadRequestErrorResponse} from '#shared/index.js';
import {instanceToPlain} from 'class-transformer';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Authorized,
  Post,
  HttpCode,
  Params,
  Body,
  Put,
  Delete,
} from 'routing-controllers';
import {ResponseSchema} from 'routing-controllers-openapi';
import {COURSES_TYPES} from '#courses/index.js';
@injectable()
@JsonController('/courses')
export class ModuleController {
  constructor(
    @inject(COURSES_TYPES.ModuleService)
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
  async delete(@Params() params: DeleteModuleParams) {
    await this.service.deleteModule(params.versionId, params.moduleId);
    return {
      message: `Module ${params.moduleId} deleted in version ${params.versionId}`,
    };
  }
}
