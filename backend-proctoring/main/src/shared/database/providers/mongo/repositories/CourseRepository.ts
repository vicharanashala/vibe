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

type MongoCourse = Omit<ICourse, "id" | "instructors"> & {
  id?: ObjectId;
  instructors: ObjectId[];
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
  private transformCourse(course: WithId<ICourse> | null): ICourse | null {
    if (!course) return null;

    const transformedCourse: ICourse = {
      name: course.name,
      versions: course.versions,
      description: course.description,
      instructors: course.instructors,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      id: course._id.toString(),
    };
    transformedCourse.id = course._id.toString();

    return transformedCourse;
  }

  /**
   * Creates a new course in the database.
   */
  async create(course: ICourse): Promise<ICourse | null> {
    await this.init();
    const instructors: ObjectId[] = course.instructors.map(
      (id) => new ObjectId(id)
    );
    const mongoCourse: MongoCourse = {
      ...course,
      instructors,
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
    return courses.map(this.transformCourse) as ICourse[];
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
}
