import { Course, CourseVersion } from "#root/modules/courses/classes/index.js";
import { IEnrollment, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { Collection, ObjectId } from "mongodb";

@injectable()
export class CohortRepository {
    private courseCollection: Collection<Course>;
    private courseVersionCollection: Collection<CourseVersion>;
    private enrollmentCollection: Collection<IEnrollment>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    private async init() {
        this.courseCollection = await this.db.getCollection<Course>('newCourse');
        this.courseVersionCollection = await this.db.getCollection<CourseVersion>(
            'newCourseVersion',
        );

        this.enrollmentCollection = await this.db.getCollection<IEnrollment>(
            'enrollment',
        );
    }

    async getTotalStudentsCountForCourseVersion(courseVersionId: string): Promise<number> {
        await this.init();
        return await this.enrollmentCollection.countDocuments({
            courseVersionId: new ObjectId(courseVersionId), isDeleted: { $ne: true },
        });
    } 


}