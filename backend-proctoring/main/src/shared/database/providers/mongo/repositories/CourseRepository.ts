import { ICourseRepository } from "shared/database/interfaces/ICourseRepository";

import { Collection, WithId, ObjectId } from "mongodb";
import { Inject, Service } from "typedi";
import { MongoDatabase } from "../MongoDatabase";
import { ICourse, ICourseVersion } from "shared/interfaces/IUser";


type MongoCourse = Omit<ICourse, "id" | "instructors"> & { id?: ObjectId; instructors: ObjectId[] };

type MongoCourseVersion = ICourseVersion & { id: ObjectId };



@Service()
export class CourseRepository implements ICourseRepository {
    private coursesCollection!: Collection<MongoCourse>;
    private courseVersionCollection!: Collection<MongoCourseVersion>;

    constructor(@Inject(() => MongoDatabase) private db: MongoDatabase) {}

    /**
     * Ensures that `coursesCollection` is initialized before usage.
     */
    private async init(): Promise<void> {
        if (!this.coursesCollection ) {
            this.coursesCollection = await this.db.getCollection<MongoCourse>("courses");
        }
        if (!this.courseVersionCollection) {
            this.courseVersionCollection = await this.db.getCollection<MongoCourseVersion>("courseVersions");
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
    async create(course: ICourse): Promise<ICourse> {
        await this.init();
        const instructors: ObjectId[] = course.instructors.map(id => new ObjectId(id));
        const mongoCourse: MongoCourse = {
            ...course,
            instructors,
            createdAt: new Date(),
            updatedAt: new Date(),
            id: undefined,  
        };
        const result = await this.coursesCollection.insertOne(mongoCourse);
        return {
            ...course,
            id: result.insertedId.toString(),
        } as ICourse;
    }

    /**
     * Reads a course by ID.
     */
    async read(id: string): Promise<ICourse | null> {
        await this.init();
        const course = await this.coursesCollection.findOne({ _id: new ObjectId(id) });
        
        if (course){
            const {_id, ...rest} = course;
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
            instructors: course.instructors ? course.instructors.map(id => new ObjectId(id)) : [],
            updatedAt: new Date(),
        };

        const result = await this.coursesCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: mongoCourse },
            { returnDocument: "after" }
        );

        if (result){
            const {_id, ...rest} = result;

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
        const result = await this.coursesCollection.deleteOne({ _id: new ObjectId(id) });
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

    async createVersion(courseVersion: ICourseVersion): Promise<ICourseVersion | null>{
        await this.init();
        const result = await this.courseVersionCollection.insertOne(courseVersion);
        return {
            ...courseVersion,
            id: result.insertedId.toString(),
        } as ICourseVersion;
    }
}
