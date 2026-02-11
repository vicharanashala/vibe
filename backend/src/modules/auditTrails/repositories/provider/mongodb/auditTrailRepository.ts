import { IAuditTrailsRepository } from "#root/modules/auditTrails/interfaces/IAuditTrailsRepository.js";
import { inject } from "inversify";
import { Collection, ClientSession, ObjectId } from "mongodb";
import { GLOBAL_TYPES } from "#root/types.js";
import { MongoDatabase } from "#root/shared/index.js";
import { InstructorAuditTrail } from "#root/modules/auditTrails/interfaces/IAuditTrails.js";

class AuditTrailsRepository implements IAuditTrailsRepository{
    private auditTrailsCollection: Collection<InstructorAuditTrail>
    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ){}
    private async init(){
        this.auditTrailsCollection = await this.db.getCollection<InstructorAuditTrail>('auditTrails');
    }

    async createAuditTrail(data: InstructorAuditTrail, session?: ClientSession): Promise<string> {
        await this.init();
        const result = await this.auditTrailsCollection.insertOne(data, {session});
        return result.insertedId.toString();
    }
}


export {AuditTrailsRepository}