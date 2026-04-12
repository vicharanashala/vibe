import {instanceToPlain} from 'class-transformer';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Authorized,
  Post,
  HttpCode,
  Params,
  Body,
  InternalServerError,
  HttpError,
  Put,
  Delete,
  BadRequestError,
  ForbiddenError,
  UseInterceptor,
  Req,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {COURSES_TYPES} from '#courses/types.js';
import {CourseVersion} from '#courses/classes/transformers/CourseVersion.js';
import {
  SectionDataResponse,
  SectionNotFoundErrorResponse,
  CreateSectionBody,
  VersionModuleSectionParams,
  UpdateSectionBody,
  MoveSectionBody,
  SectionDeletedResponse,
} from '#courses/classes/validators/SectionValidators.js';
import {SectionService} from '#courses/services/SectionService.js';
import {BadRequestErrorResponse} from '#root/shared/middleware/errorHandler.js';
import {
  HideModuleBody,
  VersionModuleParams,
} from '../classes/validators/ModuleValidators.js';
import {
  CourseVersionActions,
  getCourseVersionAbility,
} from '../abilities/versionAbilities.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {subject} from '@casl/ability';
import { AuditTrailsHandler } from '#root/shared/middleware/auditTrails.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';
import { after, before } from 'node:test';
import { ModuleService } from '../services/ModuleService.js';
import { title } from 'process';
@OpenAPI({
  tags: ['Course Sections'],
})
@injectable()
@JsonController('/courses')
export class SectionController {
  constructor(
    @inject(COURSES_TYPES.SectionService)
    private readonly sectionService: SectionService,

    @inject(COURSES_TYPES.ModuleService)
    private readonly moduleService: ModuleService,
  ) {
    if (!this.sectionService) {
      throw new Error('Course Service is not properly injected');
    }
  }

  @OpenAPI({
    summary: 'Create a section',
    description: `Creates a new section within a module of a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized()
  @Post('/versions/:versionId/modules/:moduleId/sections')
  @UseInterceptor(AuditTrailsHandler) // Add audit trail interceptor to log section creation
  @HttpCode(201)
  @ResponseSchema(SectionDataResponse, {
    description: 'Section created successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(SectionNotFoundErrorResponse, {
    description: 'Section not found',
    statusCode: 404,
  })
  async create(
    @Params() params: VersionModuleParams,
    @Body() body: CreateSectionBody,
    @Ability(getCourseVersionAbility) {ability, user },
    @Req() req: Request,
  ): Promise<CourseVersion> {
    const {versionId, moduleId} = params;

    // Create a course version resource object for permission checking
    const versionResource = subject('CourseVersion', {versionId});

    // Check permission using ability.can() with the actual version resource
    if (!ability.can(CourseVersionActions.Modify, versionResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this course version',
      );
    }

    const createdVersion = await this.sectionService.createSection(
      versionId,
      moduleId,
      body,
    );

    setAuditTrail(req, {
      category: AuditCategory.SECTION,
      action: AuditAction.SECTION_ADD,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        relatedIds:{
          afterSectionId: body.afterSectionId ? ObjectId.createFromHexString(body.afterSectionId) : null,
          beforeSectionId: body.beforeSectionId ? ObjectId.createFromHexString(body.beforeSectionId) : null,
        }
      },
      changes: {
        after: {
          sectionId: ObjectId.createFromHexString(createdVersion.modules.find(m => m.moduleId.toString() === moduleId)?.sections.slice(-1)[0].sectionId.toString()),
          title: body.name,
          description: body.description,
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS
      }
    })
    return {version: instanceToPlain(createdVersion)} as any;
  }

  @OpenAPI({
    summary: 'Update a section',
    description: `Updates the title, description, or configuration of a section within a module of a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized()
  @Put('/versions/:versionId/modules/:moduleId/sections/:sectionId')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(SectionDataResponse, {
    description: 'Section updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(SectionNotFoundErrorResponse, {
    description: 'Section not found',
    statusCode: 404,
  })
  async update(
    @Params() params: VersionModuleSectionParams,
    @Body() body: UpdateSectionBody,
    @Ability(getCourseVersionAbility) {ability, user },
    @Req() req: Request,
  ): Promise<CourseVersion> {
    const {versionId, moduleId, sectionId} = params;

    // Create a course version resource object for permission checking
    const versionResource = subject('CourseVersion', {versionId});

    // Check permission using ability.can() with the actual version resource
    if (!ability.can(CourseVersionActions.Modify, versionResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this course version',
      );
    }

    const getModule = await this.moduleService.readModule(versionId, moduleId);

    try {
      const updatedVersion = await this.sectionService.updateSection(
        versionId,
        moduleId,
        sectionId,
        body,
      );
      if (!updatedVersion) {
          setAuditTrail(req, {
            category: AuditCategory.SECTION,
            action: AuditAction.SECTION_UPDATE,
            actor: {
              id: ObjectId.createFromHexString(user._id.toString()),
              name: `${user.firstName} ${user.lastName}`,
              email: user.email,
              role: user.roles,
            },
            context: {
              courseVersionId: ObjectId.createFromHexString(versionId),
              moduleId: ObjectId.createFromHexString(moduleId),
              sectionId: ObjectId.createFromHexString(sectionId),
            },
            outcome: {
              status: OutComeStatus.FAILED,
              errorMessage: 'Failed to update section',
            }
          })

        throw new InternalServerError('Failed to update section');
      }

      setAuditTrail(req, {
        category: AuditCategory.SECTION,
        action: AuditAction.SECTION_UPDATE,
        actor: {
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },
        context: {
          courseVersionId: ObjectId.createFromHexString(versionId),
          moduleId: ObjectId.createFromHexString(moduleId),
          sectionId: ObjectId.createFromHexString(sectionId),
        },
        changes: {
          before: {
            title: getModule.sections.find(s => s.sectionId.toString() === sectionId)?.name ?? null,
            description: getModule.sections.find(s => s.sectionId.toString() === sectionId)?.description ?? null,
          },
          after: {
            title: body.name,
            description: body.description,
          }
        },
        outcome: {
          status: OutComeStatus.SUCCESS,
        }
      })
      return instanceToPlain(
        Object.assign(new CourseVersion(), updatedVersion),
      ) as CourseVersion;
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
    }
  }

  @OpenAPI({
    summary: 'Reorder a section',
    description: `Changes the position of a section within its module in a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized()
  @Put('/versions/:versionId/modules/:moduleId/sections/:sectionId/move')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(SectionDataResponse, {
    description: 'Section moved successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(SectionNotFoundErrorResponse, {
    description: 'Section not found',
    statusCode: 404,
  })
  async move(
    @Params() params: VersionModuleSectionParams,
    @Body() body: MoveSectionBody,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request,
  ): Promise<CourseVersion> {
    const {versionId, moduleId, sectionId} = params;

    // Create a course version resource object for permission checking
    const versionResource = subject('CourseVersion', {versionId});

    // Check permission using ability.can() with the actual version resource
    if (!ability.can(CourseVersionActions.Modify, versionResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this course version',
      );
    }

    try {
      const {afterSectionId, beforeSectionId} = body;

      if (!afterSectionId && !beforeSectionId) {
        setAuditTrail(req, {
          category: AuditCategory.SECTION,
          action: AuditAction.SECTION_REORDER,
          actor: {
            id: ObjectId.createFromHexString(user._id.toString()),
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.roles,
          },
          context: {
            courseVersionId: ObjectId.createFromHexString(versionId),
            moduleId: ObjectId.createFromHexString(moduleId),
            sectionId: ObjectId.createFromHexString(sectionId),
            relatedIds: {
              afterSectionId: afterSectionId ? ObjectId.createFromHexString(afterSectionId) : null,
              beforeSectionId: beforeSectionId ? ObjectId.createFromHexString(beforeSectionId) : null,
            }
          },
          outcome: {
            status: OutComeStatus.FAILED,
            errorMessage: 'Either afterSectionId or beforeSectionId is required',
          }
        })

        throw new BadRequestError(
          'Either afterSectionId or beforeSectionId is required',
        );
      }
      const getModule = await this.moduleService.readModule(versionId, moduleId);
      const sortedSections = [...getModule.sections].sort((a, b)=> a.order.localeCompare(b.order));
      const sectionPostions = sortedSections.findIndex(s => s.sectionId.toString() === sectionId);
      const beforeSection = sortedSections[sectionPostions - 1] ?? null;
      const afterSection = sortedSections[sectionPostions + 1] ?? null;
      const orderBefore = sectionPostions !== -1 ? sortedSections[sectionPostions]?.order : null;

      const updatedVersion = await this.sectionService.moveSection(
        versionId,
        moduleId,
        sectionId,
        afterSectionId,
        beforeSectionId,
      );

      if (!updatedVersion) {
        setAuditTrail(req, {
          category: AuditCategory.SECTION,
          action: AuditAction.SECTION_REORDER,
          actor: {
            id: ObjectId.createFromHexString(user._id.toString()),
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.roles,
          },
          context: {
            courseVersionId: ObjectId.createFromHexString(versionId),
            moduleId: ObjectId.createFromHexString(moduleId),
            sectionId: ObjectId.createFromHexString(sectionId),
            relatedIds: {
              afterSectionId: afterSectionId ? ObjectId.createFromHexString(afterSectionId) : null,
              beforeSectionId: beforeSectionId ? ObjectId.createFromHexString(beforeSectionId) : null,
            }
          },
          outcome: {
            status: OutComeStatus.FAILED,
            errorMessage: 'Failed to move section',
          }
        })
        throw new InternalServerError('Failed to move section');
      }

      const sortAfter = [... updatedVersion.modules.find(m => m.moduleId.toString() === moduleId)?.sections ?? []].sort((a, b)=> a.order.localeCompare(b.order));
      const newPosition = sortAfter.findIndex(s => s.sectionId.toString() === sectionId);
      const newBeforeSection = sortAfter[newPosition-1] ?? null;
      const newAfterSection = sortAfter[newPosition+1] ?? null;
      const orderAfter = newPosition !== -1 ? sortAfter[newPosition]?.order : null;


      setAuditTrail(req, {
        category: AuditCategory.SECTION,
        action: AuditAction.SECTION_REORDER,
        actor: {
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },
        context: {
          courseVersionId: ObjectId.createFromHexString(versionId),
          moduleId: ObjectId.createFromHexString(moduleId),
          sectionId: ObjectId.createFromHexString(sectionId),
          relatedIds: {
            afterSectionId: afterSectionId ? ObjectId.createFromHexString(afterSectionId) : null,
            beforeSectionId: beforeSectionId ? ObjectId.createFromHexString(beforeSectionId) : null,
          }
        },
        changes: {
          before:{
            beforeSectionId: beforeSection ? ObjectId.createFromHexString(beforeSection.sectionId.toString()) : null,
            afterSectionId: afterSection ? ObjectId.createFromHexString(afterSection.sectionId.toString()) : null,
            order: orderBefore,
          },
          after:{
            beforeSectionId: newBeforeSection ? ObjectId.createFromHexString(newBeforeSection.sectionId.toString()) : null,
            afterSectionId: newAfterSection ? ObjectId.createFromHexString(newAfterSection.sectionId.toString()) : null,
            order: orderAfter,
          }
        },
        outcome: {
          status: OutComeStatus.SUCCESS,
        }
      });

      return instanceToPlain(
        Object.assign(new CourseVersion(), updatedVersion),
      ) as CourseVersion;
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
    }
  }

  @OpenAPI({
    summary: 'Delete a section',
    description: `Deletes a section from a module in a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized()
  @Delete('/versions/:versionId/modules/:moduleId/sections/:sectionId')
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(SectionDeletedResponse, {
    description: 'Section deleted successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(SectionNotFoundErrorResponse, {
    description: 'Section not found',
    statusCode: 404,
  })
  async delete(
    @Params() params: VersionModuleSectionParams,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request,
  ): Promise<SectionDeletedResponse> {
    const {versionId, moduleId, sectionId} = params;

    // Create a course version resource object for permission checking
    const versionResource = subject('CourseVersion', {versionId});

    // Check permission using ability.can() with the actual version resource
    if (!ability.can(CourseVersionActions.Modify, versionResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this course version',
      );
    }

    const getModule = await this.moduleService.readModule(versionId, moduleId);
    const sectionToDelete = getModule.sections.find(s => s.sectionId.toString() === sectionId);

    const deletedSection = await this.sectionService.deleteSection(
      versionId,
      moduleId,
      sectionId,
    );
    if (!deletedSection) {
      setAuditTrail(req, {
        category: AuditCategory.SECTION,
        action: AuditAction.SECTION_DELETE,
        actor: {
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },
        context: {
          courseVersionId: ObjectId.createFromHexString(versionId),
          moduleId: ObjectId.createFromHexString(moduleId),
          sectionId: ObjectId.createFromHexString(sectionId),
        },
        outcome: {
          status: OutComeStatus.FAILED,
          errorMessage: 'Failed to delete section',
        }
      })

      throw new InternalServerError('Failed to delete section');
    }

    setAuditTrail(req, {
      category: AuditCategory.SECTION,
      action: AuditAction.SECTION_DELETE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        sectionId: ObjectId.createFromHexString(sectionId),
      },
      changes: {
        before: {
          title: sectionToDelete?.name ?? null,
          description: sectionToDelete?.description ?? null,
        }
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      }
    })
    return {
      message: `Section ${sectionId} deleted in module ${moduleId}`,
    };
  }
  @OpenAPI({
    summary: 'Hides/Unhide a section',
    description: `Toggles the visibility of a section within a module of a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
  })
  @Authorized()
  @HttpCode(200)
  @Put(
    '/versions/:versionId/modules/:moduleId/sections/:sectionId/toggle-visibility',
  )
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(SectionDataResponse, {
    description: 'Section visibility toggled successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(SectionNotFoundErrorResponse, {
    description: 'Section not found',
    statusCode: 404,
  })
  async toggleVisibility(
    @Params() params: VersionModuleSectionParams,
    @Body() body: HideModuleBody,
    @Ability(getCourseVersionAbility) {ability, user},
    @Req() req: Request,
  ): Promise<CourseVersion> {
    const {versionId, moduleId, sectionId} = params;

    // Create a course version resource object for permission checking
    const versionResource = subject('CourseVersion', {versionId});

    // Check permission using ability.can() with the actual version resource
    if (!ability.can(CourseVersionActions.Modify, versionResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this course version',
      );
    }

    const updatedVersion = await this.sectionService.toggleSectionVisibility(
      versionId,
      moduleId,
      sectionId,
      body.hide,
    );

    if (!updatedVersion) {

      setAuditTrail(req, {
        category: AuditCategory.SECTION,
        action: AuditAction.SECTION_HIDE ,
        actor: {
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },
        context: {
          courseVersionId: ObjectId.createFromHexString(versionId),
          moduleId: ObjectId.createFromHexString(moduleId),
          sectionId: ObjectId.createFromHexString(sectionId),
        },
        outcome: {
          status: OutComeStatus.FAILED,
          errorMessage: 'Failed to toggle section visibility',
        }
      })

      throw new InternalServerError('Failed to toggle section visibility');
    }

    setAuditTrail(req, {
      category: AuditCategory.SECTION,
      action: AuditAction.SECTION_HIDE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseVersionId: ObjectId.createFromHexString(versionId),
        moduleId: ObjectId.createFromHexString(moduleId),
        sectionId: ObjectId.createFromHexString(sectionId),
      },
      changes: {
        before: {
          isHidden: !body.hide,
        },
        after: {
          isHidden: body.hide,
        }
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      }
    });

    return instanceToPlain(updatedVersion) as CourseVersion;
  }
}
