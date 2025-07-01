import {
  ModuleDataResponse,
  ModuleNotFoundErrorResponse,
  CreateModuleParams,
  CreateModuleBody,
  VersionModuleParams,
  UpdateModuleBody,
  MoveModuleBody,
  ModuleDeletedResponse,
} from '#courses/classes/validators/ModuleValidators.js';
import {ModuleService} from '#courses/services/ModuleService.js';
import {COURSES_TYPES} from '#courses/types.js';
import {BadRequestErrorResponse} from '#root/shared/middleware/errorHandler.js';
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
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import { CourseVersionActions } from '../abilities/index.js';

@OpenAPI({
  tags: ['Course Modules'],
})
@injectable()
@JsonController('/courses')
export class ModuleController {
  constructor(
    @inject(COURSES_TYPES.ModuleService)
    private service: ModuleService,
  ) {}

  @OpenAPI({
    summary: 'Create a module',
    description: `Creates a new module within a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized({action: CourseVersionActions.Modify, subject: 'CourseVersion'})
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

  @OpenAPI({
    summary: 'Update a module',
    description: `Updates the content or metadata of a module in a given course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized({action: CourseVersionActions.Modify, subject: 'CourseVersion'})
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
    @Params() params: VersionModuleParams,
    @Body() body: UpdateModuleBody,
  ) {
    const updated = await this.service.updateModule(
      params.versionId,
      params.moduleId,
      body,
    );
    return {version: instanceToPlain(updated)};
  }

  @OpenAPI({
    summary: 'Reorder a module',
    description: `Changes the position of a module within the sequence of modules in the course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized({action: CourseVersionActions.Modify, subject: 'CourseVersion'})
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
  async move(
    @Params() params: VersionModuleParams,
    @Body() body: MoveModuleBody,
  ) {
    const updated = await this.service.moveModule(
      params.versionId,
      params.moduleId,
      body,
    );
    return {version: instanceToPlain(updated)};
  }

  @OpenAPI({
    summary: 'Delete a module',
    description: `Deletes a module from a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized({action: CourseVersionActions.Modify, subject: 'CourseVersion'})
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
  async delete(@Params() params: VersionModuleParams) {
    await this.service.deleteModule(params.versionId, params.moduleId);
    return {
      message: `Module ${params.moduleId} deleted in version ${params.versionId}`,
    };
  }
}
