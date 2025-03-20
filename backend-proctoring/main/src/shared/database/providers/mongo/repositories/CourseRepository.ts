import { ICourseRepository } from "shared/database/interfaces/ICourseRepository";

import { Collection, WithId, ObjectId } from "mongodb";
import { Inject, Service } from "typedi";
import { MongoDatabase } from "../MongoDatabase";
import {
  ICourse,
  ICourseVersion,
  IItem,
  IModule,
  ISection,
} from "shared/interfaces/IUser";
import { th } from "@faker-js/faker/.";

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
  itemIds: MongoItem[];
};

type MongoItem = Omit<IItem, "itemId"> & {
  itemId?: ObjectId;
  order: string;
  isLast: boolean;
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
        _id: result.insertedId.toString(),
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
        _id: _id.toString(),
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
      id: course._id ? new ObjectId(course._id) : undefined,
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
        _id: result._id.toString(),
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
      _id: result.insertedId.toString(),
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
      _id: version._id.toString(),
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
          itemIds: section.itemIds.map((item) => ({
            itemId: item.itemId?.toString() || "",
            order: item.order,
          })),
        })),
      })),
    } as ICourseVersion;
  }

  // /**
  //  * Updates a course version by ID.
  //  */
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

    // Convert all relevant IDs in `updatePayload`
    const convertedPayload = convertIdsToObjectId(updatePayload, [
      "courseId",
      "moduleId",
      "sectionId",
      "itemId",
    ]) as Partial<MongoCourseVersion>;

    // Update the version in MongoDB
    const result = await this.courseVersionCollection.findOneAndUpdate(
      { _id: versionObjectId },
      { $set: convertedPayload },
      { returnDocument: "after" }
    );

    if (!result) {
      return null;
    }

    console.log("DEBUG: Updated version", convertedPayload.modules[0].sections[0].itemIds);

    return {
      _id: result._id.toString(),
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
          itemIds: section.itemIds.map((item) => ({
            ...item,
            itemId: item.itemId?.toString() || ""
          })), // Preserve itemIds
        })),
      })),
    } as ICourseVersion;
  }

  // async updateVersion(
  //   versionId: string,
  //   updatePayload: Partial<ICourseVersion>
  // ): Promise<ICourseVersion | null> {
  //   await this.init();

  //   const versionObjectId = new ObjectId(versionId);

  //   // Fetch the existing version from the database
  //   const existingVersion = await this.courseVersionCollection.findOne({
  //     _id: versionObjectId,
  //   });
  //   if (!existingVersion) {
  //     return null;
  //   }

  //   // Convert all relevant IDs in `updatePayload`
  //   const convertedPayload = convertIdsToObjectId(updatePayload, [
  //     "courseId",
  //     "moduleId",
  //     "sectionId",
  //     "itemId",
  //   ]);

  //   // Merge with existing data
  //   const updatedModules: MongoModule[] = (
  //     convertedPayload.modules ?? existingVersion.modules
  //   ).map((module) => {
  //     const existingModule = existingVersion.modules.find(
  //       (m) => m.moduleId?.toString() === module.moduleId?.toString()
  //     );

  //     return {
  //       ...existingModule,
  //       ...module,
  //       sections: module.sections.map((section) => {
  //         const existingSection = existingModule?.sections.find(
  //           (s) => s.sectionId?.toString() === section.sectionId?.toString()
  //         );

  //         return {
  //           ...existingSection,
  //           ...section,
  //           itemIds: existingSection?.itemIds ?? [],
  //         };
  //       }),
  //     };
  //   });

  //   const updatedVersion: Partial<MongoCourseVersion> = {
  //     ...existingVersion,
  //     ...convertedPayload,
  //     id: versionObjectId,
  //     courseId: new ObjectId(existingVersion.courseId),
  //     modules: updatedModules,
  //   };

  //   // Update the version in MongoDB
  //   const result = await this.courseVersionCollection.findOneAndUpdate(
  //     { _id: versionObjectId },
  //     { $set: updatedVersion },
  //     { returnDocument: "after" }
  //   );

  //   if (!result) {
  //     return null;
  //   }

  //   console.log(
  //     "DEBUG: Updated version",
  //     updatedVersion.modules[0].sections[0].itemIds
  //   );

  //   return {
  //     id: result._id.toString(),
  //     courseId: result.courseId.toString(),
  //     version: result.version,
  //     description: result.description,
  //     createdAt: result.createdAt,
  //     updatedAt: result.updatedAt,
  //     modules: result.modules.map((module) => ({
  //       ...module,
  //       moduleId: module.moduleId?.toString(),
  //       sections: module.sections.map((section) => ({
  //         ...section,
  //         sectionId: section.sectionId?.toString(),
  //         itemIds: section.itemIds.map((item) => ({
  //           itemId: item.itemId?.toString() || "",
  //           order: item.order,
  //           isLast: item.isLast,
  //         })),
  //       })),
  //     })),
  //   } as ICourseVersion;
  // }

  async readSection(sectionId: string): Promise<ISection | null> {
    await this.init();

    // Find the course version that contains this section
    const version = await this.courseVersionCollection.findOne({
      "modules.sections.sectionId": new ObjectId(sectionId).toString(),
    });

    if (!version) return null;

    // Extract the section
    for (const module of version.modules) {
      console.log(module.sections);
      const section = module.sections.find(
        (s) => s.sectionId?.toString() === sectionId
      );
      if (section) {
        console.log("DEBUG: Found section");
        if (!section.sectionId) {
          throw new Error("Section ID is undefined");
        }

        return {
          ...section,
          sectionId: section.sectionId.toString(),
          itemIds: section.itemIds.map((itemId) => ({
            itemId: itemId.toString(),
          })),
        } as unknown as ISection;
      }
    }

    return null;
  }

  async updateSection(
    sectionId: string,
    sectionData: Partial<ISection>
  ): Promise<ISection | null> {
    await this.init();

    const result = await this.courseVersionCollection.findOneAndUpdate(
      { "modules.sections.sectionId": sectionId },
      { $set: { "modules.$[].sections.$[s]": sectionData } },
      {
        arrayFilters: [{ "s.sectionId": new ObjectId(sectionId) }],
        returnDocument: "after",
      }
    );

    if (!result) throw new Error("Section not found from reppo");

    const updatedSection = result.modules
      .flatMap((module) => module.sections)
      .find((s) => s.sectionId.toString() === sectionId);

    return updatedSection
      ? {
          ...updatedSection,
          sectionId: updatedSection.sectionId.toString(),
          itemIds: updatedSection.itemIds.map((item) => ({
            itemId: item.itemId?.toString() || "",
            order: item.order,
            isLast: item.isLast,
          })),
        }
      : null;
  }
}

function convertIdsToObjectId(obj: any, idFields: string[]): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertIdsToObjectId(item, idFields));
  } else if (typeof obj === "object" && obj !== null) {
    return Object.keys(obj).reduce((acc, key) => {
      const value = obj[key];

      // Convert if key is in the idFields array and value is a valid string ID
      if (
        idFields.includes(key) &&
        typeof value === "string" &&
        ObjectId.isValid(value)
      ) {
        acc[key] = new ObjectId(value);
      } else {
        acc[key] = convertIdsToObjectId(value, idFields);
      }
      return acc;
    }, {} as Record<string, any>);
  }
  return obj;
}
