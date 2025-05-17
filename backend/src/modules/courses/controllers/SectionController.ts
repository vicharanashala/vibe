import {instanceToPlain} from 'class-transformer';
import 'reflect-metadata';
import {
  Authorized,
  Body,
  HttpCode,
  HttpError,
  JsonController,
  Params,
  Post,
  Put,
} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {ReadError, UpdateError} from 'shared/errors/errors';
import {Inject, Service} from 'typedi';
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
} from '../classes/validators/SectionValidators';
import {calculateNewOrder} from '../utils/calculateNewOrder';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';

@OpenAPI({
  tags: ['Course Sections'],
})
@JsonController('/courses')
@Service()
export class SectionController {
  constructor(
    @Inject('CourseRepo') private readonly courseRepo: CourseRepository,
  ) {
    if (!this.courseRepo) {
      throw new Error('CourseRepository is not properly injected');
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
  @OpenAPI({
    summary: 'Create Section',
    description:
      'Creates a new section in the specified module and automatically generates an associated items group.',
  })
  async create(
    @Params() params: CreateSectionParams,
    @Body() body: CreateSectionBody,
  ) {
    try {
      const {versionId, moduleId} = params;
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);

      //Create Section
      const section = new Section(body, module.sections);

      //Create ItemsGroup
      let itemsGroup = new ItemsGroup(section.sectionId);
      itemsGroup = await this.courseRepo.createItemsGroup(itemsGroup);

      //Assign ItemsGroup to Section
      section.itemsGroupId = itemsGroup._id;

      //Add Section to Module
      module.sections.push(section);

      //Update Module Update Date
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
  @OpenAPI({
    summary: 'Update Section',
    description:
      "Updates an existing section's name or description within a module.",
  })
  async update(
    @Params() params: UpdateSectionParams,
    @Body() body: UpdateSectionBody,
  ) {
    try {
      const {versionId, moduleId, sectionId} = params;
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);
      if (!module) throw new ReadError('Module not found');

      //Find Section
      const section = module.sections.find(s => s.sectionId === sectionId);
      if (!section) throw new ReadError('Section not found');

      //Update Section
      Object.assign(section, body.name ? {name: body.name} : {});
      Object.assign(
        section,
        body.description ? {description: body.description} : {},
      );
      section.updatedAt = new Date();

      //Update Module Update Date
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
  @OpenAPI({
    summary: 'Move Section',
    description:
      'Reorders a section within its module by placing it before or after another section.',
  })
  async move(
    @Params() params: MoveSectionParams,
    @Body() body: MoveSectionBody,
  ) {
    try {
      const {versionId, moduleId, sectionId} = params;
      const {afterSectionId, beforeSectionId} = body;

      if (!afterSectionId && !beforeSectionId) {
        throw new UpdateError(
          'Either afterModuleId or beforeModuleId is required',
        );
      }

      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find(m => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find(s => s.sectionId === sectionId);

      //Sort Sections based on order
      const sortedSections = module.sections.sort((a, b) =>
        a.order.localeCompare(b.order),
      );

      //Calculate New Order
      const newOrder = calculateNewOrder(
        sortedSections,
        'sectionId',
        afterSectionId,
        beforeSectionId,
      );

      //Update Section Order
      section.order = newOrder;
      section.updatedAt = new Date();

      //Update Module Update Date
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
}
