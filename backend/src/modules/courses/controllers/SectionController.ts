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
import { VersionModuleParams } from '../classes/validators/ModuleValidators.js';
@OpenAPI({
  tags: ['Course Sections'],
})
@injectable()
@JsonController('/courses')
export class SectionController {
  constructor(
    @inject(COURSES_TYPES.SectionService)
    private readonly sectionService: SectionService,
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
  @Authorized(['admin'])
  @Post('/versions/:versionId/modules/:moduleId/sections')
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
  ): Promise<CourseVersion> {
    try {
      const {versionId, moduleId} = params;
      const createdVersion = await this.sectionService.createSection(
        versionId,
        moduleId,
        body,
      );
      if (!createdVersion) {
        throw new InternalServerError('Failed to create section');
      }
      return {version: instanceToPlain(createdVersion)} as any;
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(500, error.message);
      }
    }
  }

  @OpenAPI({
  summary: 'Update a section',
  description: `Updates the title, description, or configuration of a section within a module of a specific course version.<br/>
Accessible to:
- Instructors or managers of the course.`,
})

  @Authorized(['admin'])
  @Put('/versions/:versionId/modules/:moduleId/sections/:sectionId')
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
  ): Promise<CourseVersion> {
    try {
      const {versionId, moduleId, sectionId} = params;
      const updatedVersion = await this.sectionService.updateSection(
        versionId,
        moduleId,
        sectionId,
        body,
      );
      if (!updatedVersion) {
        throw new InternalServerError('Failed to update section');
      }
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
  @Authorized(['admin'])
  @Put('/versions/:versionId/modules/:moduleId/sections/:sectionId/move')
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
  ): Promise<CourseVersion> {
    try {
      const {versionId, moduleId, sectionId} = params;
      const {afterSectionId, beforeSectionId} = body;

      if (!afterSectionId && !beforeSectionId) {
        throw new BadRequestError(
          'Either afterSectionId or beforeSectionId is required',
        );
      }

      const updatedVersion = await this.sectionService.moveSection(
        versionId,
        moduleId,
        sectionId,
        afterSectionId,
        beforeSectionId,
      );
      if (!updatedVersion) {
        throw new InternalServerError('Failed to move section');
      }

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
  @Authorized(['admin'])
  @Delete('/versions/:versionId/modules/:moduleId/sections/:sectionId')
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
  ): Promise<SectionDeletedResponse> {
    const {versionId, moduleId, sectionId} = params;
    const deletedSection = await this.sectionService.deleteSection(
      versionId,
      moduleId,
      sectionId,
    );
    if (!deletedSection) {
      throw new InternalServerError('Failed to delete section');
    }
    return {
      message: `Section ${params.sectionId} deleted in module ${params.moduleId}`,
    };
  }
}
