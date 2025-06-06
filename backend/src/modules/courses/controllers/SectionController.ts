import {instanceToPlain} from 'class-transformer';
import 'reflect-metadata';
import {
  Authorized,
  Body,
  Delete,
  HttpCode,
  HttpError,
  JsonController,
  Params,
  Post,
  Put,
} from 'routing-controllers';
import {CourseRepository} from '../../../shared/database/providers/mongo/repositories/CourseRepository';
import {ItemRepository} from '../../../shared/database/providers/mongo/repositories/ItemRepository';
import {
  DeleteError,
  ReadError,
  UpdateError,
} from '../../../shared/errors/errors';
import {inject, injectable} from 'inversify';
import {ItemsGroup} from '../classes/transformers/Item';
import {Section} from '../classes/transformers/Section';
import {
  CreateSectionBody,
  CreateSectionParams,
  MoveSectionBody,
  MoveSectionParams,
  UpdateSectionBody,
  UpdateSectionParams,
  SectionDataResponse,
  SectionNotFoundErrorResponse,
  SectionDeletedResponse,
  DeleteSectionParams,
} from '../classes/validators/SectionValidators';
import {calculateNewOrder} from '../utils/calculateNewOrder';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {BadRequestErrorResponse} from '../../../shared/middleware/errorHandler';
import {SectionService} from '../services/SectionService';
import {CourseVersion} from '../classes/transformers';
import TYPES from '../types';
import GLOBAL_TYPES from '../../../types';

@injectable()
@JsonController('/courses')
export class SectionController {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: CourseRepository,
    @inject(TYPES.ItemRepo) private readonly itemRepo: ItemRepository,
    @inject(TYPES.SectionService)
    private readonly sectionService: SectionService,
  ) {
    if (!this.sectionService) {
      throw new Error('Course Service is not properly injected');
    }
    if (!this.itemRepo) {
      throw new Error('ItemRepository is not properly injected');
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
        throw new UpdateError('Failed to create section');
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
        throw new UpdateError('Failed to update section');
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
        throw new UpdateError(
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
        throw new UpdateError('Failed to move section');
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
      throw new DeleteError('Failed to delete section');
    }
    return {
      message: `Section ${params.sectionId} deleted in module ${params.moduleId}`,
    };
  }
}
