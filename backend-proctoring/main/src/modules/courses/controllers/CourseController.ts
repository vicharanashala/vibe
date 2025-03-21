/**
 * @file CourseController.ts
 * @description Controller managing course-related routes.
 * @module courses
 *
 * @license MIT
 * @created 2025-03-08
 */

import "reflect-metadata";
import {
  JsonController,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Authorized,
  HttpError,
  Patch,
  BadRequestError,
} from "routing-controllers";
import { Inject, Service } from "typedi";
import {
  classToPlain,
  Expose,
  instanceToPlain,
  plainToClass,
  Transform,
  Type,
  TypeHelpOptions,
} from "class-transformer";
import { CoursePayload, ICourseService } from "../interfaces/ICourseService";
import {
  DTOCoursePayload,
  DTOCourseVersionPayload,
  DTOModulePayload,
  DTOSectionPayload,
} from "../dtos/DTOCoursePayload";
import {
  CreateCourseError,
  FetchCourseError,
  UpdateCourseError,
} from "../errors/CourseErrors";
import { ObjectId } from "mongodb";
import {
  IBaseItem,
  IBlogDetails,
  ICourse,
  ICourseVersion,
  IModule,
  IQuizDetails,
  ISection,
  ItemType,
  IVideoDetails,
} from "shared/interfaces/IUser";
import {
  IsArray,
  IsDate,
  IsDateString,
  IsDecimal,
  IsEmpty,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  isPositive,
  IsString,
  IsUrl,
  isURL,
  Matches,
  MaxLength,
  MinLength,
  validate,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  Course,
  CourseVersion,
  Item,
  ItemsGroup,
  Module,
  NewCourseRepository,
  Section,
} from "shared/database/providers/mongo/repositories/NewCourseRepository";
import { HTTPError } from "shared/middleware/ErrorHandler";
import { Version } from "firebase-admin/lib/remote-config/remote-config-api";
import { VersionService } from "../services/VersionService";
import { calculateNewOrder } from "../utils/calculateNewOrder";
import { ReadError, UpdateError, CreateError } from "shared/errors/errors";

class CoursePayloadNew implements ICourse {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @IsEmpty()
  instructors: string[];

  @IsEmpty()
  versions: string[];

  @IsEmpty()
  createdAt?: Date;

  @IsEmpty()
  updatedAt?: Date;
}

class CourseVersionPayloadNew implements ICourseVersion {
  @IsEmpty()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  version: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsEmpty()
  modules: IModule[];

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;
}

class ModulePayloadNew implements IModule {
  @IsEmpty()
  moduleId?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsEmpty()
  order: string;

  @IsEmpty()
  sections: ISection[];

  @IsEmpty()
  isLast: boolean;

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;
}

export class VideoDetailsPayload implements IVideoDetails {
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  URL: string;

  @IsNotEmpty()
  @Matches(/^(\d{1,2}:)?\d{1,2}:\d{2}$/)
  startTime: string;

  @IsNotEmpty()
  @Matches(/^(\d{1,2}:)?\d{1,2}:\d{2}$/)
  endTime: string;

  @IsNotEmpty()
  @IsDecimal()
  points: number;
}

export class QuizDetailsPayload implements IQuizDetails {
  @IsNotEmpty()
  @IsPositive()
  questionVisibility: number;

  @IsNotEmpty()
  @IsDateString()
  releaseTime: Date;

  @IsEmpty()
  questions: string[];

  @IsNotEmpty()
  @IsDateString()
  deadline: Date;
}

export class BlogDetailsPayload implements IBlogDetails {
  @IsEmpty()
  tags: string[];

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsDecimal()
  points: number;
}

export class ItemPayload implements IBaseItem {
  @IsEmpty()
  _id?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsEmpty()
  sectionId: string;

  @IsEmpty()
  order: string;

  @IsEmpty()
  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails;

  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;

  @IsNotEmpty()
  @IsEnum(ItemType)
  type: ItemType;

  // Conditional validation based on type
  @ValidateIf((o) => o.type === ItemType.VIDEO)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => VideoDetailsPayload)
  videoDetails?: VideoDetailsPayload;

  @ValidateIf((o) => o.type === ItemType.BLOG)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BlogDetailsPayload)
  blogDetails?: BlogDetailsPayload;

  @ValidateIf((o) => o.type === ItemType.QUIZ)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuizDetailsPayload)
  quizDetails?: QuizDetailsPayload;
}

export class UpdateItemPayload implements IBaseItem {
  @IsEmpty()
  _id?: string;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsEmpty()
  sectionId: string;

  @IsEmpty()
  order: string;

  @IsEmpty()
  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails;

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;

  @IsOptional()
  @IsEnum(ItemType)
  type: ItemType;

  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;

  // Conditional validation based on type
  @ValidateIf((o) => o.type === ItemType.VIDEO)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => VideoDetailsPayload)
  videoDetails?: VideoDetailsPayload;

  @ValidateIf((o) => o.type === ItemType.BLOG)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BlogDetailsPayload)
  blogDetails?: BlogDetailsPayload;

  @ValidateIf((o) => o.type === ItemType.QUIZ)
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuizDetailsPayload)
  quizDetails?: QuizDetailsPayload;
}

export class MoveItemPayload {
  @IsOptional()
  @IsMongoId()
  @IsString()
  afterItemId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeItemId?: string;
}

@JsonController("/courses")
@Service()
export class CourseController {
  constructor(
    @Inject("ICourseService") private readonly courseService: ICourseService,
    @Inject("NewCourseRepo") private readonly courseRepo: NewCourseRepository
  ) {
    console.log("ICourseService injected:", this.courseService !== undefined); // ✅ Debugging line
    if (!this.courseService) {
      throw new Error("CourseService is not properly injected");
    }
  }

  @Authorized(["admin", "instructor"])
  @Post("/")
  async createCourse(@Body({ validate: true }) payload: CoursePayloadNew) {
    let course = new Course(payload);
    try {
      course = await this.courseRepo.create(course);
      return instanceToPlain(course);
    } catch (error) {
      throw new HttpError(500, error.message);
    }
  }

  @Authorized(["admin", "instructor"])
  @Get("/:id")
  async readCourse(@Param("id") id: string) {
    try {
      const courses = await this.courseRepo.read(id);
      return instanceToPlain(courses);
    } catch (error) {
      throw new HTTPError(500, error.message);
    }
  }

  @Authorized(["admin", "instructor"])
  @Post("/:id/versions")
  async createVersion(
    @Param("id") id: string,
    @Body({ validate: true }) payload: CourseVersionPayloadNew
  ) {
    try {
      //Fetch Course from DB
      const course = await this.courseRepo.read(id);

      //Create Version
      let version = new CourseVersion(payload);
      version.courseId = new ObjectId(id);
      version = (await this.courseRepo.createVersion(version)) as CourseVersion;

      //Add Version to Course
      course.versions.push(version._id);
      course.updatedAt = new Date();

      //Update Course
      const updatedCourse = await this.courseRepo.update(id, course);

      return {
        course: instanceToPlain(updatedCourse),
        version: instanceToPlain(version),
      };
    } catch (error) {
      if (error instanceof CreateError) {
        throw new HTTPError(500, error);
      }
      if (error instanceof ReadError) {
        throw new HTTPError(404, error);
      }
      if (error instanceof UpdateError) {
        throw new HTTPError(500, error);
      }
      throw new HTTPError(500, error);
    }
  }

  @Authorized(["admin", "instructor", "student"])
  @Get("/versions/:id")
  async readVersion(@Param("id") id: string) {
    try {
      const version = await this.courseRepo.readVersion(id);
      return instanceToPlain(version);
    } catch (error) {
      if (error instanceof FetchCourseError) {
        throw new HTTPError(500, error);
      } else {
        throw new HTTPError(500, Error("Failed to retrieve course versions"));
      }
    }
  }

  @Authorized(["admin"])
  @Post("/versions/:versionId/modules")
  async createModule(
    @Param("versionId") versionId: string,
    @Body({ validate: true }) payload: DTOModulePayload
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Create Module
      const module = new Module(payload, version.modules);
      console.log(module);

      //Add Module to Version
      version.modules.push(module);

      //Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      throw new HTTPError(500, error);
    }
  }

  @Authorized(["admin"])
  @Put("/versions/:versionId/modules/:moduleId")
  async updateModule(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Body({ validate: true }) payload: Partial<DTOModulePayload>
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);
      if (!module) throw new ReadError("Module not found");

      //Update Module
      Object.assign(module, payload.name ? { name: payload.name } : {});
      Object.assign(
        module,
        payload.description ? { description: payload.description } : {}
      );
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof ReadError) {
        throw new HTTPError(404, error);
      }
    }
  }

  @Authorized(["admin"])
  @Put("/versions/:versionId/modules/:moduleId/move")
  async moveModule(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Body() body: { afterModuleId?: string; beforeModuleId?: string }
  ) {
    try {
      const { afterModuleId, beforeModuleId } = body;

      if (!afterModuleId && !beforeModuleId) {
        throw new UpdateError(
          "Either afterModuleId or beforeModuleId is required"
        );
      }

      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Sort Modules based on order
      const sortedModules = version.modules.sort((a, b) =>
        a.order.localeCompare(b.order)
      );

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);
      if (!module) throw new ReadError("Module not found");

      //Calculate New Order
      const newOrder = calculateNewOrder(
        sortedModules,
        "moduleId",
        afterModuleId,
        beforeModuleId
      );

      //Update Module Order
      module.order = newOrder;
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }

  @Authorized(["admin"])
  @Post("/versions/:versionId/modules/:moduleId/sections")
  async createSection(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Body({ validate: true }) payload: DTOSectionPayload
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);

      //Create Section
      const section = new Section(payload, module.sections);

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
        version
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }

  @Authorized(["admin"])
  @Put("/versions/:versionId/modules/:moduleId/sections/:sectionId")
  async updateSection(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Param("sectionId") sectionId: string,
    @Body({ validate: true }) payload: Partial<DTOSectionPayload>
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);
      if (!module) throw new ReadError("Module not found");

      //Find Section
      const section = module.sections.find((s) => s.sectionId === sectionId);
      if (!section) throw new ReadError("Section not found");

      //Update Section
      Object.assign(section, payload.name ? { name: payload.name } : {});
      Object.assign(
        section,
        payload.description ? { description: payload.description } : {}
      );
      section.updatedAt = new Date();

      //Update Module Update Date
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }

  @Authorized(["admin"])
  @Put("/versions/:versionId/modules/:moduleId/sections/:sectionId/move")
  async moveSection(
    @Param("versionId") versionId: string,
    @Param("moduleId") moduleId: string,
    @Param("sectionId") sectionId: string,
    @Body() body: { afterSectionId?: string; beforeSectionId?: string }
  ) {
    try {
      const { afterSectionId, beforeSectionId } = body;

      if (!afterSectionId && !beforeSectionId) {
        throw new UpdateError(
          "Either afterModuleId or beforeModuleId is required"
        );
      }

      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find((s) => s.sectionId === sectionId);

      //Sort Sections based on order
      const sortedSections = module.sections.sort((a, b) =>
        a.order.localeCompare(b.order)
      );

      //Calculate New Order
      const newOrder = calculateNewOrder(
        sortedSections,
        "sectionId",
        afterSectionId,
        beforeSectionId
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
        version
      );

      return {
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }

  @Authorized(["admin", "instructor", "student"])
  @Get("/versions/:versionId/modules/:moduleId/sections/:sectionId/items")
  async readItems(
    @Param("sectionId") sectionId: string,
    @Param("moduleId") moduleId: string,
    @Param("versionId") versionId: string
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find((s) => s.sectionId === sectionId);

      //Fetch Items
      const itemsGroup = await this.courseRepo.readItemsGroup(
        section.itemsGroupId.toString()
      );

      return {
        itemsGroup: itemsGroup,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }

  @Authorized(["admin"])
  @Post("/versions/:versionId/modules/:moduleId/sections/:sectionId/items")
  async createItem(
    @Param("sectionId") sectionId: string,
    @Param("moduleId") moduleId: string,
    @Param("versionId") versionId: string,
    @Body({ validate: true }) item: ItemPayload
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find((s) => s.sectionId === sectionId);

      //Fetch ItemGroup
      const itemsGroup = await this.courseRepo.readItemsGroup(
        section.itemsGroupId.toString()
      );

      //Create Item
      const newItem = new Item(item, itemsGroup.items);

      //Add Item to ItemsGroup
      itemsGroup.items.push(newItem);

      //Update Section Update Date
      section.updatedAt = new Date();

      //Update Module Update Date
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      const updatedItemsGroup = await this.courseRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup
      );

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version
      );

      return {
        itemsGroup: instanceToPlain(updatedItemsGroup),
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }

  @Authorized(["admin"])
  @Put(
    "/versions/:versionId/modules/:moduleId/sections/:sectionId/items/:itemId"
  )
  async updateItem(
    @Param("sectionId") sectionId: string,
    @Param("moduleId") moduleId: string,
    @Param("versionId") versionId: string,
    @Param("itemId") itemId: string,
    @Body({ validate: true }) payload: UpdateItemPayload
  ) {
    try {
      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find((s) => s.sectionId === sectionId);

      //Fetch ItemsGroup
      const itemsGroup = await this.courseRepo.readItemsGroup(
        section.itemsGroupId.toString()
      );

      //Find Item
      const item = itemsGroup.items.find((i) => i.itemId === itemId);

      //Update Item
      Object.assign(item, payload.name ? { name: payload.name } : {});
      Object.assign(
        item,
        payload.description ? { description: payload.description } : {}
      );
      Object.assign(item, payload.type ? { type: payload.type } : {});



      //Update Item Details
      Object.assign(
        item,
        payload.videoDetails
          ? { itemDetails: payload.videoDetails }
          : payload.blogDetails
          ? { itemDetails: payload.blogDetails }
          : payload.quizDetails
          ? { itemDetails: payload.quizDetails }
          : {}
      );

      //Update Section Update Date
      section.updatedAt = new Date();

      //Update Module Update Date
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update ItemsGroup
      const updatedItemsGroup = await this.courseRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup
      );

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version
      );

      return {
        itemsGroup: instanceToPlain(updatedItemsGroup),
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }

  @Authorized(["admin"])
  @Put(
    "/versions/:versionId/modules/:moduleId/sections/:sectionId/items/:itemId/move"
  )
  async moveItem(
    @Param("sectionId") sectionId: string,
    @Param("moduleId") moduleId: string,
    @Param("versionId") versionId: string,
    @Param("itemId") itemId: string,
    @Body({validate: true}) body: MoveItemPayload
  ) {
    try {
      const { afterItemId, beforeItemId } = body;

      if (!afterItemId && !beforeItemId) {
        throw new UpdateError(
          "Either afterItemId or beforeItemId is required"
        );
      }

      //Fetch Version
      const version = await this.courseRepo.readVersion(versionId);

      //Find Module
      const module = version.modules.find((m) => m.moduleId === moduleId);

      //Find Section
      const section = module.sections.find((s) => s.sectionId === sectionId);

      //Fetch ItemsGroup
      const itemsGroup = await this.courseRepo.readItemsGroup(
        section.itemsGroupId.toString()
      );

      //Find Item
      const item = itemsGroup.items.find((i) => i.itemId === itemId);

      //Sort Items based on order
      const sortedItems = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order)
      );

      //Calculate New Order
      const newOrder = calculateNewOrder(
        sortedItems,
        "itemId",
        afterItemId,
        beforeItemId
      );

      //Update Item Order
      item.order = newOrder;

      //Update Section Update Date
      section.updatedAt = new Date();

      //Update Module Update Date
      module.updatedAt = new Date();

      //Update Version Update Date
      version.updatedAt = new Date();

      //Update ItemsGroup
      const updatedItemsGroup = await this.courseRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup
      );

      //Update Version
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version
      );

      return {
        itemsGroup: instanceToPlain(updatedItemsGroup),
        version: instanceToPlain(updatedVersion),
      };
    } catch (error) {
      if (error instanceof UpdateError){
        throw new BadRequestError(error.message);
      }
      if (error instanceof Error) {
        throw new HTTPError(500, error);
      }
    }
  }


}
