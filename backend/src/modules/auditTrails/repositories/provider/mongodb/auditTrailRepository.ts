import { IAuditTrailsRepository } from "#root/modules/auditTrails/interfaces/IAuditTrailsRepository.js";
import { inject } from "inversify";
import { Collection, ClientSession, ObjectId } from "mongodb";
import { GLOBAL_TYPES } from "#root/types.js";
import { MongoDatabase } from "#root/shared/index.js";
import { InstructorAuditTrail } from "#root/modules/auditTrails/interfaces/IAuditTrails.js";

class AuditTrailsRepository implements IAuditTrailsRepository {
    private auditTrailsCollection: Collection<InstructorAuditTrail>
    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }
    private async init() {
        this.auditTrailsCollection = await this.db.getCollection<InstructorAuditTrail>('auditTrails');
    }

    async createAuditTrail(data: InstructorAuditTrail, session?: ClientSession): Promise<string> {
        await this.init();
        const result = await this.auditTrailsCollection.insertOne(data, { session });
        return result.insertedId.toString();
    }

    async getAllAuditTrailsByInstructorId(instructorId: string, session?: ClientSession): Promise<InstructorAuditTrail[]> {
        await this.init();
        const auditTrails = await this.auditTrailsCollection.find({ actor: new ObjectId(instructorId) }, { session }).toArray();
        return auditTrails;
    }

    async getAuditTrailsByCourseAndVersion(userId: string, courseId: string, versionId: string, session?: ClientSession): Promise<InstructorAuditTrail[]> {
        await this.init();
        const auditTrails = await this.auditTrailsCollection.find({
            actor: new ObjectId(userId),
            "context.courseId": new ObjectId(courseId),
            "context.courseVersionId": new ObjectId(versionId)
        }, { session }).toArray();
        return auditTrails;
    }
}


export { AuditTrailsRepository }