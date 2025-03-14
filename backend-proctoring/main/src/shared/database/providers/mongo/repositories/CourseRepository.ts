import { ICourseRepository } from "shared/database/interfaces/ICourseRepository";

import { Collection, WithId, ObjectId } from "mongodb";
import { Inject, Service } from "typedi";
import { MongoDatabase } from "../MongoDatabase";
import {
  ICourse,
  ICourseVersion,
  IModule,
  ISection,
} from "shared/interfaces/IUser";

type MongoCourse = Omit<ICourse, "id" | "instructors" | "versions"> & {
  id?: ObjectId;
  instructors: ObjectId[];
  versions: ObjectId[];
};

type MongoCourseVersion = Omit<
  ICourseVersion,
  "id" | "modules" | "courseId"
> & { id?: ObjectId; modules: MongoModule[]; courseId: ObjectId };

type MongoModule = Omit<IModule, "moduleId" | "sections"> & {
  moduleId?: ObjectId;
  sections: MongoSection[];
};

type MongoSection = Omit<ISection, "sectionId" | "itemIds"> & {
  sectionId?: ObjectId;
  itemIds: ObjectId[];
};

@Service()
export class CourseRepository implements ICourseRepository {
  private coursesCollection!: Collection<MongoCourse>;
  private courseVersionCollection!: Collection<MongoCourseVersion>;

  constructor(@Inject(() => MongoDatabase) private db: MongoDatabase) {}

  /**
   * Ensures that `coursesCollection` is initialized before usage.
   */
  private async init(): Promise<void> {
    if (!this.coursesCollection) {
      this.coursesCollection = await this.db.getCollection<MongoCourse>(
        "courses"
      );
    }
    if (!this.courseVersionCollection) {
      this.courseVersionCollection =
        await this.db.getCollection<MongoCourseVersion>("courseVersions");
    }
  }

  /**
   * Converts `_id: ObjectId` to `id: string` in course objects.
   */
  private transformCourse(course: WithId<MongoCourse> | null): ICourse | null {
    return null;
  }

  /**
   * Creates a new course in the database.
   */
  async create(course: ICourse): Promise<ICourse | null> {
    await this.init();
    const instructors: ObjectId[] = course.instructors.map(
      (id) => new ObjectId(id)
    );

    const versions: ObjectId[] = course.versions.map((id) => new ObjectId(id));

    const mongoCourse: MongoCourse = {
      ...course,
      instructors,
      versions,
      createdAt: new Date(),
      updatedAt: new Date(),
      id: undefined,
    };
    const result = await this.coursesCollection.insertOne(mongoCourse);

    if (result) {
      return {
        ...course,
        id: result.insertedId.toString(),
      } as ICourse;
    }

    return null;
  }

  /**
   * Reads a course by ID.
   */
  async read(id: string): Promise<ICourse | null> {
    await this.init();
    const course = await this.coursesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (course) {
      const { _id, ...rest } = course;
      return {
        ...rest,
        id: _id.toString(),
        instructors: course.instructors.map((id: ObjectId) => id.toString()),
        versions: course.versions.map((id: ObjectId) => id.toString()),
      } as ICourse;
    }
    return null;
  }

  /**
   * Updates a course by ID.
   */
  async update(id: string, course: Partial<ICourse>): Promise<ICourse | null> {
    await this.init();

    let mongoCourse: Partial<MongoCourse> = {
      ...course,
      id: course.id ? new ObjectId(course.id) : undefined,
      instructors: course.instructors
        ? course.instructors.map((id) => new ObjectId(id))
        : [],
      versions: course.versions
        ? course.versions.map((id) => new ObjectId(id))
        : [],
      updatedAt: new Date(),
    };

    const result = await this.coursesCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: mongoCourse },
      { returnDocument: "after" }
    );

    if (result) {
      const { _id, ...rest } = result;

      return {
        ...rest,
        id: result._id.toString(),
        instructors: result.instructors.map((id: ObjectId) => id.toString()),
        versions: result.versions.map((id: ObjectId) => id.toString()),
      } as ICourse;
    }

    return null;
  }

  /**
   * Deletes a course by ID.
   */
  async delete(id: string): Promise<boolean> {
    await this.init();
    const result = await this.coursesCollection.deleteOne({
      _id: new ObjectId(id),
    });
    return result.deletedCount > 0;
  }

  /**
   * Retrieves all courses.
   */
  async getAll(): Promise<ICourse[]> {
    await this.init();
    const courses = await this.coursesCollection.find().toArray();
    return courses.map((course) => this.transformCourse(course)) as ICourse[];
  }

  /**
   * Creates a new course version in the database.
   */
  async createVersion(
    courseVersion: ICourseVersion
  ): Promise<ICourseVersion | null> {
    await this.init();

    // Convert `courseId` to ObjectId
    const courseObjectId = new ObjectId(courseVersion.courseId);

    // Process modules and sections, adds unique ObjectIds
    const processedModules = courseVersion.modules.map((module) => {
      const moduleObjectId = new ObjectId(); // Generate a unique ObjectId for each module
      const processedSections = module.sections.map((section) => ({
        ...section,
        sectionId: new ObjectId(), // Assign a unique ObjectId for each section
        itemIds: [],
      }));

      return {
        ...module,
        moduleId: moduleObjectId,
        sections: processedSections,
      };
    });

    // Construct version document with valid ids
    const mongoCourseVersion: MongoCourseVersion = {
      ...courseVersion,
      courseId: courseObjectId,
      id: undefined,
      modules: processedModules,
    };

    // Insert into MongoDB
    const result = await this.courseVersionCollection.insertOne(
      mongoCourseVersion
    );
    if (!result.insertedId) {
      return null;
    }

    return {
      ...courseVersion,
      id: result.insertedId.toString(),
      courseId: courseVersion.courseId, // Keep it as a string
      modules: processedModules.map((module) => ({
        moduleId: module.moduleId.toString(),
        name: module.name,
        description: module.description,
        order: module.order,
        isLast: module.isLast,
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
        sections: module.sections.map((section) => ({
          sectionId: section.sectionId.toString(),
          name: section.name,
          description: section.description,
          order: section.order,
          itemIds: section.itemIds,
          isLast: section.isLast,
          createdAt: section.createdAt,
          updatedAt: section.updatedAt,
        })),
      })),
    } as ICourseVersion;
  }

  /**
   * Reads a course version by ID.
   */
  async readVersion(versionId: string): Promise<ICourseVersion | null> {
    await this.init();

    const versionObjectId = new ObjectId(versionId);

    const version = await this.courseVersionCollection.findOne({
      _id: versionObjectId,
    });

    if (!version) {
      return null;
    }

    return {
      id: version._id.toString(),
      courseId: version.courseId.toString(),
      version: version.version,
      description: version.description,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      modules: version.modules.map((module) => ({
        ...module,
        moduleId: module.moduleId?.toString(),
        sections: module.sections.map((section) => ({
          ...section,
          sectionId: section.sectionId?.toString(),
          itemIds: section.itemIds.map((itemId) => itemId.toString()),
        })),
      })),
    } as ICourseVersion;
  }

  /**
   * Updates a course version by ID.
   */
  async updateVersion(
    versionId: string,
    updatePayload: Partial<ICourseVersion>
  ): Promise<ICourseVersion | null> {
    await this.init();

    const versionObjectId = new ObjectId(versionId);

    // Fetch the existing version from the database
    const existingVersion = await this.courseVersionCollection.findOne({
      _id: versionObjectId,
    });
    if (!existingVersion) {
      return null;
    }

    // Convert `courseId` to ObjectId
    const updatedModules: MongoModule[] = (
      updatePayload.modules ?? existingVersion.modules
    ).map((module) => {
      const existingModule = existingVersion.modules.find(
        (m) => m.moduleId?.toString() === module.moduleId
      );

      const moduleObjectId =
        module.moduleId && ObjectId.isValid(module.moduleId)
          ? new ObjectId(module.moduleId)
          : existingModule?.moduleId || new ObjectId();

      const updatedSections: MongoSection[] = module.sections.map((section) => {
        const existingSection = existingModule?.sections.find(
          (s) => s.sectionId?.toString() === section.sectionId
        );

        return {
          ...existingSection,
          ...section,
          sectionId:
            section.sectionId && ObjectId.isValid(section.sectionId)
              ? new ObjectId(section.sectionId)
              : existingSection?.sectionId || new ObjectId(),
          itemIds: existingSection?.itemIds ?? [], // Preserve itemIds
          updatedAt: section.updatedAt,
        };
      });

      return {
        ...existingModule,
        ...module,
        moduleId: moduleObjectId,
        sections: updatedSections,
        updatedAt: module.updatedAt,
      };
    });

    const updatedVersion: Partial<MongoCourseVersion> = {
      ...existingVersion,
      ...updatePayload,
      id: versionObjectId,
      courseId: new ObjectId(existingVersion.courseId),
      modules: updatedModules,
      updatedAt: updatePayload.updatedAt, // Preserve `updatedAt`
    };

    // Update the version in MongoDB
    const result = await this.courseVersionCollection.findOneAndUpdate(
      { _id: versionObjectId },
      { $set: updatedVersion },
      { returnDocument: "after" }
    );

    if (!result) {
      return null;
    }

    return {
      id: result._id.toString(),
      courseId: result.courseId.toString(),
      version: result.version,
      description: result.description,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      modules: result.modules.map((module) => ({
        ...module,
        moduleId: module.moduleId?.toString(),
        sections: module.sections.map((section) => ({
          ...section,
          sectionId: section.sectionId?.toString(),
          itemIds: section.itemIds.map((itemId) => itemId.toString()), // Preserve itemIds
        })),
      })),
    } as ICourseVersion;
  }
}
