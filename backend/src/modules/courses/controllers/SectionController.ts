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
} from '../classes/validators/SectionValidators';
import {calculateNewOrder} from '../utils/calculateNewOrder';

/**
 * Controller for managing sections within course modules.
 * Handles creation, update, and reordering of sections under modules in course versions.
 *
 * @category Courses/Controllers
 * @categoryDescription
 * Provides endpoints for managing "sections" in a module,
 * including creating sections, updating section metadata,
 * and adjusting section order within a module.
 */

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

  /**
   * Create a new section under a specific module within a course version.
   * Automatically generates and assigns a new ItemsGroup to the section.
   *
   * @param params - Route parameters including versionId and moduleId.
   * @param body - Payload for creating the section (e.g., name, description).
   * @returns The updated course version containing the new section.
   *
   * @throws HTTPError(500) on internal errors.
   *
   * @category Courses/Controllers
   */

  @Authorized(['admin'])
  @Post('/versions/:versionId/modules/:moduleId/sections')
  @HttpCode(201)
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

  /**
   * Update an existing section's metadata (name or description).
   *
   * @param params - Route parameters including versionId, moduleId, and sectionId.
   * @param body - Updated fields for the section.
   * @returns The updated course version with modified section.
   *
   * @throws HTTPError(500) if the section or module is not found or if update fails.
   *
   * @category Courses/Controllers
   */

  @Authorized(['admin'])
  @Put('/versions/:versionId/modules/:moduleId/sections/:sectionId')
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

  /**
   * Reorder a section within its module by calculating a new order key.
   *
   * @param params - Route parameters including versionId, moduleId, and sectionId.
   * @param body - Positioning details: beforeSectionId or afterSectionId.
   * @returns The updated course version with reordered sections.
   *
   * @throws UpdateError if neither beforeSectionId nor afterSectionId is provided.
   * @throws HTTPError(500) on internal processing errors.
   *
   * @category Courses/Controllers
   */

  @Authorized(['admin'])
  @Put('/versions/:versionId/modules/:moduleId/sections/:sectionId/move')
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
