import { ICourseRepository } from "shared/database/interfaces/ICourseRepository";
import { CourseRepository } from "./CourseRepository";
import {
  ICourse,
  ICourseVersion,
  IItemId,
  IModule,
  ISection,
} from "shared/interfaces/IUser";
import { Inject, Service } from "typedi";
import { IDatabase } from "shared/database/interfaces/IDatabase";
import { MongoDatabase } from "../MongoDatabase";
import {
  classToPlain,
  Expose,
  instanceToInstance,
  instanceToPlain,
  Transform,
  TransformFnParams,
  TransformOptions,
  Type,
} from "class-transformer";
import { Collection, ObjectId } from "mongodb";
import { calculateNewOrder } from "modules/courses/utils/calculateNewOrder";
import {
  DTOModulePayload,
  DTOSectionPayload,
} from "modules/courses/dtos/DTOCoursePayload";
import {
  UpdateError,
  CreateError,
  DeleteError,
  ReadError,
} from "shared/errors/errors";

type ID = string | ObjectId | null;

type TransformerOptions = {
  transformer: (params: TransformFnParams) => any;
};

/** Handles ObjectId transformation */
const ObjectIdToString: TransformerOptions = {
  transformer: ({ value }) =>
    value instanceof ObjectId ? value.toString() : value,
};

const StringToObjectId: TransformerOptions = {
  transformer: ({ value }) =>
    typeof value === "string" ? new ObjectId(value) : value,
};

const ObjectIdArrayToStringArray: TransformerOptions = {
  transformer: ({ value }) =>
    Array.isArray(value) ? value.map((v) => v.toString()) : value,
};

const StringArrayToObjectIdArray: TransformerOptions = {
  transformer: ({ value }) =>
    Array.isArray(value) ? value.map((v) => new ObjectId(v)) : value,
};

export class Course implements ICourse {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true }) // Convert ObjectId -> string when serializing
  @Transform(StringToObjectId.transformer, { toClassOnly: true }) // Convert string -> ObjectId when deserializing
  _id?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  @Transform(ObjectIdArrayToStringArray.transformer, { toPlainOnly: true }) // Convert ObjectId[] -> string[] when serializing
  @Transform(StringArrayToObjectIdArray.transformer, { toClassOnly: true }) // Convert string[] -> ObjectId[] when deserializing
  versions: ID[];

  @Expose()
  @Transform(ObjectIdArrayToStringArray.transformer, { toPlainOnly: true }) // Convert ObjectId[] -> string[] when serializing
  @Transform(StringArrayToObjectIdArray.transformer, { toClassOnly: true }) // Convert string[] -> ObjectId[] when deserializing
  instructors: ID[];

  @Expose()
  @Type(() => Date)
  createdAt?: Date | null;

  @Expose()
  @Type(() => Date)
  updatedAt?: Date | null;

  constructor(coursePayload?: ICourse) {
    if (coursePayload) {
      this.name = coursePayload.name;
      this.description = coursePayload.description;
    }

    this.versions = [];
    this.instructors = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export class CourseVersion implements ICourseVersion {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  courseId: ID;

  @Expose()
  version: string;

  @Expose()
  description: string;

  @Expose()
  @Type(() => Module)
  modules: Module[];

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  constructor(courseVersionPayload?: ICourseVersion) {
    if (courseVersionPayload) {
      this.courseId = courseVersionPayload.courseId;
      this.version = courseVersionPayload.version;
      this.description = courseVersionPayload.description;
    }
    this.modules = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export class Module implements IModule {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  moduleId?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  order: string;

  @Expose()
  @Type(() => Section)
  sections: Section[];

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  constructor(modulePayload: DTOModulePayload, existingModules: IModule[]) {
    if (modulePayload) {
      this.name = modulePayload.name;
      this.description = modulePayload.description;
    }
    const sortedModules = existingModules.sort((a, b) =>
      a.order.localeCompare(b.order)
    );
    this.moduleId = new ObjectId();
    this.order = calculateNewOrder(
      sortedModules,
      "moduleId",
      modulePayload.afterModuleId,
      modulePayload.beforeModuleId
    );
    this.sections = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

export class Section implements ISection {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  sectionId?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  order: string;

  @Expose()
  itemIds: IItemId[];

  @Expose()
  isLast: boolean;

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  constructor(sectionPayload: DTOSectionPayload, existingSections: ISection[]) {
    if (sectionPayload) {
      this.name = sectionPayload.name;
      this.description = sectionPayload.description;
    }
    this.sectionId = new ObjectId();
    this.order = calculateNewOrder(
      existingSections,
      "sectionId",
      sectionPayload.afterSectionId,
      sectionPayload.beforeSectionId
    );
    this.itemIds = [];
    this.isLast = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

@Service()
export class NewCourseRepository implements ICourseRepository {
  private courseCollection: Collection<Course>;
  private courseVersionCollection: Collection<CourseVersion>;

  constructor(@Inject(() => MongoDatabase) private db: MongoDatabase) {}

  private async init() {
    this.courseCollection = await this.db.getCollection<Course>("newCourse");
    this.courseVersionCollection = await this.db.getCollection<CourseVersion>(
      "newCourseVersion"
    );
  }
  async create(course: Course): Promise<Course | null> {
    await this.init();
    try {
      const result = await this.courseCollection.insertOne(course);
      if (result.acknowledged) {
        const newCourse = await this.courseCollection.findOne({
          _id: result.insertedId,
        });
        return instanceToPlain(
          Object.assign(new Course(), newCourse)
        ) as Course;
      } else {
        throw new CreateError("Failed to create course");
      }
    } catch (error) {
      throw new CreateError(
        "Failed to create course.\n More Details: " + error
      );
    }
  }
  async read(id: string): Promise<ICourse | null> {
    await this.init();
    try {
      const course = await this.courseCollection.findOne({
        _id: new ObjectId(id),
      });
      return instanceToPlain(Object.assign(new Course(), course)) as Course;
    } catch (error) {
      throw new ReadError("Failed to read course.\n More Details: " + error);
    }
  }
  async update(id: string, course: Partial<ICourse>): Promise<ICourse | null> {
    await this.init();
    try {
      const { _id, ...fields } = course;
      const result = await this.courseCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: fields }
      );
      if (result.modifiedCount === 1) {
        const updatedCourse = await this.courseCollection.findOne({
          _id: new ObjectId(id),
        });
        return instanceToPlain(
          Object.assign(new Course(), updatedCourse)
        ) as Course;
      } else {
        throw new UpdateError("Failed to update course");
      }
    } catch (error) {
      throw new UpdateError(
        "Failed to update course.\n More Details: " + error
      );
    }
  }
  async delete(id: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  async getAll(): Promise<ICourse[]> {
    throw new Error("Method not implemented.");
  }
  async createVersion(
    courseVersion: CourseVersion
  ): Promise<ICourseVersion | null> {
    await this.init();
    try {
      const result = await this.courseVersionCollection.insertOne(
        courseVersion
      );
      if (result.acknowledged) {
        const newCourseVersion = await this.courseVersionCollection.findOne({
          _id: result.insertedId,
        });

        return instanceToPlain(
          Object.assign(new CourseVersion(), newCourseVersion)
        ) as CourseVersion;
      } else {
        throw new CreateError("Failed to create course version");
      }
    } catch (error) {
      throw new CreateError(
        "Failed to create course version.\n More Details: " + error
      );
    }
  }
  async readVersion(versionId: string): Promise<ICourseVersion | null> {
    await this.init();
    try {
      const courseVersion = await this.courseVersionCollection.findOne({
        _id: new ObjectId(versionId),
      });
      return instanceToPlain(
        Object.assign(new CourseVersion(), courseVersion)
      ) as CourseVersion;
    } catch (error) {
      throw new ReadError(
        "Failed to read course version.\n More Details: " + error
      );
    }
  }
  async updateVersion(
    versionId: string,
    courseVersion: CourseVersion
  ): Promise<ICourseVersion | null> {
    await this.init();
    try {
      const { _id, ...fields } = courseVersion;
      const result = await this.courseVersionCollection.updateOne(
        { _id: new ObjectId(versionId) },
        { $set: fields }
      );
      if (result.modifiedCount === 1) {
        const updatedCourseVersion = await this.courseVersionCollection.findOne(
          {
            _id: new ObjectId(versionId),
          }
        );
        return instanceToPlain(
          Object.assign(new CourseVersion(), updatedCourseVersion)
        ) as CourseVersion;
      } else {
        throw new UpdateError("Failed to update course version");
      }
    } catch (error) {
      throw new UpdateError(
        "Failed to update course version.\n More Details: " + error
      );
    }
  }
  async readSection(sectionId: string): Promise<ISection | null> {
    throw new Error("Method not implemented.");
  }
  async updateSection(
    sectionId: string,
    section: Partial<ISection>
  ): Promise<ISection | null> {
    throw new Error("Method not implemented.");
  }
}
