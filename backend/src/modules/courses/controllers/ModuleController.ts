import {
  ModuleDataResponse,
  ModuleNotFoundErrorResponse,
  CreateModuleParams,
  CreateModuleBody,
  VersionModuleParams,
  UpdateModuleBody,
  MoveModuleBody,
  ModuleDeletedResponse,
  HideModuleParams,
  HideModuleBody,
} from '#courses/classes/validators/ModuleValidators.js';
import {ModuleService} from '#courses/services/ModuleService.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {COURSES_TYPES} from '#courses/types.js';
import {BadRequestErrorResponse} from '#root/shared/middleware/errorHandler.js';
import {instanceToPlain} from 'class-transformer';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Body,
  Put,
  Delete,
  ForbiddenError,
  Authorized,
  UseInterceptor,
  Req,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {
  CourseVersionActions,
  getCourseVersionAbility,
} from '../abilities/versionAbilities.js';
import {subject} from '@casl/ability';
import { AuditTrailsHandler } from '#root/shared/index.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';
import { CourseVersionService } from '../services/CourseVersionService.js';
import { get } from 'http';

@OpenAPI({
  tags: ['Course Modules'],
})
@injectable()
@JsonController('/courses')
export class ModuleController {
  constructor(
    @inject(COURSES_TYPES.ModuleService)
    private service: ModuleService,

    @inject(COURSES_TYPES.CourseVersionService)
    private courseVersionService: CourseVersionService
  ) {}

  @OpenAPI({
    summary: 'Create a module',
    description: `Creates a new module within a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized()
  @Post('/versions/:versionId/modules')
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request
  ) {
    const {versionId} = params;

    // Build the subject context first
    const courseVersionSubject = subject('CourseVersion', {versionId});

    if (!ability.can(CourseVersionActions.Modify, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to create modules in this course version',
      );
    }

    const getCourse = await this.courseVersionService.readCourseVersion(versionId, user._id);



    const updated = await this.service.createModule(params.versionId, body);

    setAuditTrail(req, {
      category: AuditCategory.MODULE,
      action: AuditAction.MODULE_ADD,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseId: ObjectId.createFromHexString(getCourse.courseId.toString()),
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(updated._id.toString()),
      },
      changes:{
        after: {
          name: body.name,
          description: body.description,
          afterModuleId: body.afterModuleId,
          beforeModuleId: body.beforeModuleId,
        }
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return {version: instanceToPlain(updated)};
  }

  @OpenAPI({
    summary: 'Update a module',
    description: `Updates the content or metadata of a module in a given course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized()
  @Put('/versions/:versionId/modules/:moduleId')
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request
  ) {
    const {versionId, moduleId} = params;

    // Build the subject context first
    const courseVersionSubject = subject('CourseVersion', {versionId});

    if (!ability.can(CourseVersionActions.Modify, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to update modules in this course version',
      );
    }
    const getCourse = await this.courseVersionService.readCourseVersion(versionId, user._id);
        const getNameAndDescription = getCourse.modules.filter((module)=>{
      return module.moduleId === moduleId;
    })
    const updated = await this.service.updateModule(versionId, moduleId, body);

    setAuditTrail(req, {
      category: AuditCategory.MODULE,
      action: AuditAction.MODULE_UPDATE,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseId: ObjectId.createFromHexString(getCourse.courseId.toString()),
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
      },
      changes:{
        before: {
          name: getNameAndDescription[0].name,
          description: getNameAndDescription[0].description,
        },
        after: {
          name: body.name,
          description: body.description,
        }
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return {version: instanceToPlain(updated)};
  }

  @OpenAPI({
    summary: 'Hide or Unhide a module',
    description: `Toggles the visibility of a module within a specific course version.<br/>
Accessible to:
- Instructors, students and all of the course.`,
  })
  @Authorized()
  @HttpCode(200)
  @Put('/versions/:versionId/modules/:moduleId/toggle-visibility')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(ModuleDataResponse, {
    description: 'Module visibility toggled successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(ModuleNotFoundErrorResponse, {
    description: 'Module not found',
    statusCode: 404,
  })
  async toggleVisibility(
    @Params() params: HideModuleParams,
    @Body() body: HideModuleBody,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request
  ) {
    const {versionId, moduleId} = params;

    const {hide} = body;
    // Build the subject context first
    const courseVersionSubject = subject('CourseVersion', {versionId});

    if (!ability.can(CourseVersionActions.View, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to toggle module visibility in this course version',
      );
    }

    const updated = await this.service.toggleModuleVisibility(
      versionId,
      moduleId,
      hide,
    );
    return {version: instanceToPlain(updated)};
  }

  @OpenAPI({
    summary: 'Reorder a module',
    description: `Changes the position of a module within the sequence of modules in the course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized()
  @Put('/versions/:versionId/modules/:moduleId/move')
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request
  ) {
    const {versionId, moduleId} = params;

    // Build the subject context first
    const courseVersionSubject = subject('CourseVersion', {versionId});

    if (!ability.can(CourseVersionActions.Modify, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to move modules in this course version',
      );
    }
    const getCourse = await this.courseVersionService.readCourseVersion(versionId, user._id);
    const getOrder = getCourse.modules.find((module)=>{
      return module.moduleId === moduleId;
    })
    const updated = await this.service.moveModule(versionId, moduleId, body);

    const updatedOrder = updated.modules.find((module)=>{
      return module.moduleId?.toString() === moduleId;
     })

    setAuditTrail(req, {
      category: AuditCategory.MODULE,
      action: AuditAction.MODULE_REORDER,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseId: ObjectId.createFromHexString(getCourse.courseId.toString()),
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        relatedIds:{
            afterModuleId: body.afterModuleId,
            beforeModuleId: body.beforeModuleId,
        },
      },
      changes:{
        before: {
          order: getOrder ? getOrder.order : null
        },
        after: {
          order: updatedOrder ? updatedOrder.order : null
        }
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      }

    })
    return {version: instanceToPlain(updated)};
  }

  @OpenAPI({
    summary: 'Delete a module',
    description: `Deletes a module from a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized()
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
  async delete(
    @Params() params: VersionModuleParams,
    @Ability(getCourseVersionAbility) {ability},
  ) {
    const {versionId, moduleId} = params;

    // Build the subject context first
    const courseVersionSubject = subject('CourseVersion', {versionId});

    if (!ability.can(CourseVersionActions.Modify, courseVersionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to delete modules in this course version',
      );
    }

    await this.service.deleteModule(versionId, moduleId);
    return {
      message: `Module ${moduleId} deleted in version ${versionId}`,
    };
  }
}
