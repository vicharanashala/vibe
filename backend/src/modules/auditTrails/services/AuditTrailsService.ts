import { BaseService, MongoDatabase } from "#root/shared/index.js";
import { inject } from "inversify";
import { AUDIT_TRAILS_TYPES } from "../types.js";
import { AuditTrailsRepository } from "../repositories/index.js";
import { GLOBAL_TYPES } from "#root/types.js";

class AuditTrailsService extends BaseService{
    constructor(
        @inject(AUDIT_TRAILS_TYPES.AuditTrailsRepository) 
        private auditTrailsRepository: AuditTrailsRepository,

        @inject(GLOBAL_TYPES.Database)
         private readonly mongoDatabase: MongoDatabase,

    ){
           super(mongoDatabase);
    }

    async getAllAuditTrails(instructorId: string){
        return this._withTransaction(async (session)=>{
            return this.auditTrailsRepository.getAllAuditTrailsByInstructorId(instructorId, session);
        })
    }

    async getAuditTrailsByCourseAndVersion(userId: string, courseId: string, versionId: string, page: number, limit: number, startDate?: string, endDate?: string){
        return this._withTransaction(async (session)=>{
            return this.auditTrailsRepository.getAuditTrailsByCourseAndVersion(userId, courseId, versionId, page, limit, startDate, endDate, session);
        })
    }
}


export {AuditTrailsService}