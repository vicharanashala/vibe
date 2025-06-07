import {
  SectionDataResponse,
  SectionNotFoundErrorResponse,
  CreateSectionParams,
  CreateSectionBody,
  CourseVersion,
  UpdateSectionParams,
  UpdateSectionBody,
  MoveSectionParams,
  MoveSectionBody,
  SectionDeletedResponse,
  DeleteSectionParams,
} from '#courses/classes/index.js';
import {SectionService} from '#courses/services/SectionService.js';
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
  InternalServerError,
  HttpError,
  Put,
  Delete,
} from 'routing-controllers';
import {ResponseSchema} from 'routing-controllers-openapi';
import {COURSES_TYPES} from '#courses/types.js';
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
    @Params() params: CreateSectionParams,
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
    @Params() params: UpdateSectionParams,
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
    @Params() params: MoveSectionParams,
    @Body() body: MoveSectionBody,
  ): Promise<CourseVersion> {
    try {
      const {versionId, moduleId, sectionId} = params;
      const {afterSectionId, beforeSectionId} = body;

      if (!afterSectionId && !beforeSectionId) {
        throw new InternalServerError(
          'Either afterModuleId or beforeModuleId is required',
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
    @Params() params: DeleteSectionParams,
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
